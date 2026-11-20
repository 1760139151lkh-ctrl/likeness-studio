"""Accounts and private spaces.

Every visitor has an account from their first request: a *guest* account, held by a session cookie, with its own
private space (its uploads, its pictures, its records). Signing up turns that same guest account into a member
account, so nothing moves and nothing is lost. Logging in to an existing member account from a guest session moves
the guest's records and pictures into the member's space (newer record wins), then retires the guest.

  accounts  id, kind (guest | member), handle (unique, members only), nickname, password hash (scrypt), created
  sessions  sha256(token) -> account; the token itself only ever lives in the visitor's cookie
  records   (account, collection, id) -> JSON data, updated, deleted: the app's history, favourites, drafts and edit
            trails, synced last-writer-wins so a refresh, a second device or a cleared browser loses nothing

The database lives in the private folder, which git ignores.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import shutil
import sqlite3
import threading
import time
from pathlib import Path

HANDLE = re.compile(r"^[a-z0-9_.]{3,20}$")
COLLECTIONS = {"works", "sources", "favs", "drafts", "prefs", "threads", "styles"}
MAX_RECORD = 96 * 1024
MAX_BATCH = 200


class AccountError(ValueError):
    """Something the person can fix: the message is shown to them as it is."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def _check_password(password: str, stored: str) -> bool:
    try:
        scheme, salt, digest = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    return hmac.compare_digest(_hash_password(password, bytes.fromhex(salt)).split("$")[2], digest)


def _token_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class Accounts:
    def __init__(self, home: Path) -> None:
        self.home = home
        home.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(home / "accounts.db", check_same_thread=False, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.Lock()
        with self.lock:
            self.db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, kind TEXT NOT NULL, handle TEXT UNIQUE,
                    nickname TEXT NOT NULL DEFAULT '', pw TEXT, created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account TEXT NOT NULL, created REAL NOT NULL, seen REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS records (account TEXT NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
                    updated REAL NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (account, coll, id));
                CREATE INDEX IF NOT EXISTS records_seq ON records (account, seq);
            """)
            self._seq = int(self.db.execute("SELECT COALESCE(MAX(seq), 0) FROM records").fetchone()[0])
        self._failures: dict[str, list[float]] = {}

    def _next(self) -> int:
        """The server's own cursor (callers hold the lock): sync asks for what changed after it, whatever the devices' clocks say."""
        self._seq += 1
        return self._seq

    # ---- spaces ----
    def space(self, account_id: str) -> Path:
        """The account's private folder (its pictures live in assets/ under it)."""
        if not re.fullmatch(r"[0-9a-f]{24}", account_id):
            raise AccountError("Unknown account.", 401)
        return self.home / "spaces" / account_id

    # ---- sessions ----
    def guest(self) -> tuple[dict, str]:
        """A new guest account and a session for it."""
        account_id, token, now = secrets.token_hex(12), secrets.token_urlsafe(32), time.time()
        with self.lock:
            self.db.execute("INSERT INTO accounts (id, kind, created) VALUES (?, 'guest', ?)", (account_id, now))
            self.db.execute("INSERT INTO sessions VALUES (?, ?, ?, ?)", (_token_key(token), account_id, now, now))
        return self.get(account_id), token

    def session(self, token: str) -> dict | None:
        if not token or len(token) > 128:
            return None
        key = _token_key(token)
        with self.lock:
            row = self.db.execute("SELECT account, seen FROM sessions WHERE token = ?", (key,)).fetchone()
            if row is None:
                return None
            if time.time() - row["seen"] > 3600:
                self.db.execute("UPDATE sessions SET seen = ? WHERE token = ?", (time.time(), key))
        return self.get(row["account"])

    def _attach(self, token: str, account_id: str) -> None:
        with self.lock:
            self.db.execute("UPDATE sessions SET account = ?, seen = ? WHERE token = ?", (account_id, time.time(), _token_key(token)))

    def logout(self, token: str) -> None:
        with self.lock:
            self.db.execute("DELETE FROM sessions WHERE token = ?", (_token_key(token),))

    def get(self, account_id: str) -> dict | None:
        with self.lock:
            row = self.db.execute("SELECT id, kind, handle, nickname, created FROM accounts WHERE id = ?", (account_id,)).fetchone()
        return dict(row) if row else None

    @staticmethod
    def public(account: dict) -> dict:
        return {"id": account["id"], "kind": account["kind"], "handle": account["handle"] or "", "nickname": account["nickname"] or "",
                "created": account["created"]}

    # ---- sign up, log in ----
    def _throttle(self, who: str) -> None:
        now = time.time()
        recent = [t for t in self._failures.get(who, []) if now - t < 300]
        self._failures[who] = recent
        if len(recent) >= 8:
            raise AccountError("尝试次数太多啦，5 分钟后再试试。", 429)

    def signup(self, account_id: str, handle: str, password: str, nickname: str = "") -> dict:
        """Turns the guest account into a member account in place: everything it holds stays where it is."""
        handle = handle.strip().lower()
        if not HANDLE.fullmatch(handle):
            raise AccountError("账号名用 3–20 位小写字母、数字、下划线或点。")
        if len(password) < 6 or len(password) > 128:
            raise AccountError("密码至少 6 位哦。")
        account = self.get(account_id)
        if account is None:
            raise AccountError("会话过期了，刷新一下再试。", 401)
        if account["kind"] != "guest":
            raise AccountError("你已经登录啦。", 409)
        with self.lock:
            try:
                self.db.execute("UPDATE accounts SET kind = 'member', handle = ?, nickname = ?, pw = ? WHERE id = ?",
                                (handle, (nickname.strip() or handle)[:24], _hash_password(password), account_id))
            except sqlite3.IntegrityError:
                raise AccountError("这个账号名被抢先注册了，换一个吧。", 409) from None
        return self.get(account_id)

    def login(self, token: str, current: dict, handle: str, password: str, who: str = "") -> tuple[dict, int]:
        """Logs this session in to a member account. A guest's records and pictures come along into it."""
        self._throttle(who or "-")
        with self.lock:
            row = self.db.execute("SELECT id, pw FROM accounts WHERE handle = ? AND kind = 'member'", (handle.strip().lower(),)).fetchone()
        if row is None or not _check_password(password, row["pw"] or ""):
            self._failures.setdefault(who or "-", []).append(time.time())
            raise AccountError("账号或密码不对，再检查一下。", 401)
        moved = 0
        if current["id"] != row["id"] and current["kind"] == "guest":
            moved = self.merge(current["id"], row["id"])
        self._attach(token, row["id"])
        return self.get(row["id"]), moved

    def rename(self, account_id: str, nickname: str) -> dict:
        with self.lock:
            self.db.execute("UPDATE accounts SET nickname = ? WHERE id = ?", (nickname.strip()[:24], account_id))
        return self.get(account_id)

    def merge(self, source: str, target: str) -> int:
        """Moves a guest's records (newer wins) and private pictures into another account, then retires the guest."""
        with self.lock:
            rows = self.db.execute("SELECT coll, id, data, updated, deleted FROM records WHERE account = ?", (source,)).fetchall()
            moved = 0
            for r in rows:
                have = self.db.execute("SELECT updated FROM records WHERE account = ? AND coll = ? AND id = ?", (target, r["coll"], r["id"])).fetchone()
                if have is None or have["updated"] < r["updated"]:
                    self.db.execute("INSERT OR REPLACE INTO records VALUES (?, ?, ?, ?, ?, ?, ?)", (target, r["coll"], r["id"], r["data"], r["updated"], r["deleted"], self._next()))
                    moved += 1
            self.db.execute("DELETE FROM records WHERE account = ?", (source,))
            self.db.execute("UPDATE sessions SET account = ? WHERE account = ?", (target, source))
            self.db.execute("DELETE FROM accounts WHERE id = ? AND kind = 'guest'", (source,))
        src, dst = self.space(source) / "assets", self.space(target) / "assets"
        if src.is_dir():
            dst.mkdir(parents=True, exist_ok=True)
            for f in src.iterdir():
                if not (dst / f.name).exists():
                    shutil.move(str(f), dst / f.name)
            shutil.rmtree(self.space(source), ignore_errors=True)
        return moved

    # ---- records ----
    def since(self, account_id: str, cursor: int = 0, limit: int = 1000) -> tuple[list[dict], int]:
        """Records changed after the cursor, and the cursor to ask from next time."""
        with self.lock:
            rows = self.db.execute("SELECT coll, id, data, updated, deleted, seq FROM records WHERE account = ? AND seq > ? ORDER BY seq LIMIT ?",
                                   (account_id, cursor, limit)).fetchall()
        out = [{"coll": r["coll"], "id": r["id"], "data": json.loads(r["data"]), "updated": r["updated"], "deleted": bool(r["deleted"])} for r in rows]
        return out, (rows[-1]["seq"] if rows else cursor)

    def put(self, account_id: str, records: list[dict]) -> int:
        if len(records) > MAX_BATCH:
            raise AccountError("一次同步的内容太多了。", 413)
        applied = 0
        with self.lock:
            for rec in records:
                coll, rid = str(rec.get("coll", "")), str(rec.get("id", ""))
                if coll not in COLLECTIONS or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,80}", rid):
                    continue
                data = json.dumps(rec.get("data") or {}, ensure_ascii=False, separators=(",", ":"))
                if len(data.encode("utf-8")) > MAX_RECORD:
                    continue
                updated = float(rec.get("updated") or time.time() * 1000)
                have = self.db.execute("SELECT updated FROM records WHERE account = ? AND coll = ? AND id = ?", (account_id, coll, rid)).fetchone()
                if have is not None and have["updated"] >= updated:
                    continue
                self.db.execute("INSERT OR REPLACE INTO records VALUES (?, ?, ?, ?, ?, ?, ?)", (account_id, coll, rid, data, updated, int(bool(rec.get("deleted"))), self._next()))
                applied += 1
        return applied

    def counts(self, account_id: str) -> dict:
        with self.lock:
            rows = self.db.execute("SELECT coll, COUNT(*) AS n FROM records WHERE account = ? AND deleted = 0 GROUP BY coll", (account_id,)).fetchall()
        return {r["coll"]: r["n"] for r in rows}
