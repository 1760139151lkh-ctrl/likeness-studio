"""哈基秀's front door: the app's files, one turn API that every engine answers, a stream of events per job, and an
account (with its own private space) for every visitor.

  GET  /studio.json                 which studio this is, and who is asking (their account)
  POST /api/assets                  a picture or a mask, sent once (multipart: file, kind), into the account's space
  GET  /api/assets/{id}             a picture back, only to the account that owns it
  POST /api/turns                   a turn: answers {job, eta}
  GET  /api/jobs/{id}/events        what happens, as it happens (server-sent events); GET /api/jobs/{id} for polling
  POST /api/jobs/{id}/cancel        stop it
  GET  /api/history                 every picture the studio made for this account, newest first (nothing is lost)
  GET  /api/me                      the account, and how much it holds
  POST /api/auth/signup | login | logout | profile     guest → member in place; logging in brings a guest's work along
  GET  /api/sync?cursor=N, POST /api/sync              the app's records (works, sources, favourites, drafts, prefs)
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import __version__, engines, paths, settings
from .accounts import AccountError, Accounts
from .engines import EngineError, Work
from .estimates import Estimates
from .jobs import Job, Jobs, QueueFull, SubmissionConflict
from .store import MAX_UPLOAD, Store
from .turns import Inputs, StyleAsk, Turn
from .rooms import normalise_style

LOOPBACK = {"127.0.0.1", "::1", "localhost"}
NOT_PAIRED = """<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Likeness</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#121110;color:#ede6da;font:17px/1.5 Georgia,serif">
<p style="max-width:20em;padding:2em">This studio only opens for devices it has paired with.<br><br>Scan the code that <code>likeness serve</code> prints to pair this one.</p>"""
OWNER_OPEN = """<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Likeness Studio</title>
<p id="status" role="status">Opening Likeness Studio...</p>
<script>
const statusLine = document.getElementById("status");
const key = location.hash.slice(1);
history.replaceState(null, "", location.pathname);
if (/^[0-9a-f]{64}$/.test(key)) {
  fetch(location.pathname, { method: "POST", headers: { "Content-Type": "text/plain" }, body: key })
    .then(response => { if (!response.ok) throw Error(); location.replace("/"); })
    .catch(() => { statusLine.textContent = "Could not open the studio. Reopen your access link."; });
} else {
  fetch("/api/health", { cache: "no-store" }).then(response => {
    if (response.ok) location.replace("/");
    else statusLine.textContent = "Open your private Likeness link to pair this browser.";
  }).catch(() => { statusLine.textContent = "Could not reach the studio. Try again."; });
}
</script>"""
OWNER_HEADERS = {"Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
                 "X-Frame-Options": "DENY", "Permissions-Policy": "geolocation=()",
                 "X-Content-Type-Options": "nosniff"}
OWNER_COOKIE = "__Host-likeness"
SESSION_COOKIE = "hjx_sid"
STATIC_GROUPS = ("css/", "js/", "fonts/", "vendor/", "img/", "bundle/")
ROOT_FILES = {"icon.svg", "manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png", "apple-touch-icon.png"}
PUBLIC_ASSET_TYPES = {".js", ".mjs", ".css", ".woff2", ".webp", ".png", ".task", ".tflite", ".wasm", ".json"}


class SignUp(BaseModel):
    handle: str = Field(max_length=40)
    password: str = Field(max_length=128)
    nickname: str = Field("", max_length=40)


class LogIn(BaseModel):
    handle: str = Field(max_length=40)
    password: str = Field(max_length=128)


class Profile(BaseModel):
    nickname: str = Field(max_length=40)


class SyncIn(BaseModel):
    records: list[dict] = Field(default_factory=list, max_length=200)


class StudioFiles(StaticFiles):
    """Keep the shell current while the browser reuses the unchanged public assets."""

    def __init__(self, builds: dict[str, str], bundle: Path | None) -> None:
        super().__init__(directory=paths.WEB)
        self.builds = builds
        self.bundle = bundle

    def lookup_path(self, path):
        if path == os.path.join("bundle", "studio.js") and self.bundle and self.bundle.is_file():
            return str(self.bundle), self.bundle.stat()
        return super().lookup_path(path)

    def get_path(self, scope):
        path = super().get_path(scope)
        head, sep, tail = path.partition(os.sep)
        if sep and len(head) == 17 and head.startswith("v") and all(c in "0123456789abcdef" for c in head[1:]):
            return tail
        return path

    async def get_response(self, path, scope):
        if not path.replace(os.sep, "/").startswith(STATIC_GROUPS) and path not in ROOT_FILES:
            raise HTTPException(404)
        response = await super().get_response(path, scope)
        # Windows does not always register a media type for WebP.
        if path.endswith(".webp") and response.status_code in (200, 206):
            response.headers["Content-Type"] = "image/webp"
        if path == "sw.js":   # the service worker is always checked afresh, and may look after the whole site
            response.headers["Cache-Control"] = "no-cache"
            response.headers["Service-Worker-Allowed"] = "/"
            return response
        supplied = scope["path"].lstrip("/").partition("/")[0]
        if supplied == self.builds.get(path.partition(os.sep)[0]) and response.status_code in (200, 304):
            visibility = "public" if scope.get("state", {}).get("public_asset") else "private"
            response.headers["Cache-Control"] = f"{visibility}, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "private, no-cache"
        return response


def public_build(directory: Path) -> str:
    digest = hashlib.sha256()
    for file in sorted(directory.rglob("*")):
        if file.is_file():
            digest.update(file.relative_to(directory).as_posix().encode())
            digest.update(hashlib.sha256(file.read_bytes()).digest())
    return "v" + digest.hexdigest()[:16]


def app_shell(builds: dict[str, str], bundled: bool) -> str:
    template = (paths.WEB / "index.html").read_text(encoding="utf-8")
    support = ""
    catalog = paths.WEB / "img" / "manifest.json"
    if catalog.is_file():
        data = json.dumps(json.loads(catalog.read_text(encoding="utf-8")), separators=(",", ":"), ensure_ascii=False).replace("<", "\\u003c")
        support += f'<script id="asset-manifest" type="application/json">{data}</script>'
    versions = json.dumps(builds, separators=(",", ":"))
    support += f'<script id="studio-versions" type="application/json">{versions}</script>'
    for directory in ("css", "fonts", "js", "img"):
        template = template.replace(f'"{directory}/', f'"/{builds[directory]}/{directory}/')
    if bundled:
        template = template.replace(f'"/{builds["js"]}/js/main.js"', f'"/{builds["bundle"]}/bundle/studio.js"')
    return template.replace("<!-- studio-state -->", support + "<!-- studio-state -->", 1)


def owner_link_token(secret: bytes) -> str:
    return hmac.new(secret, b"likeness-owner-open-v1", hashlib.sha256).hexdigest()


def owner_authenticated(header: str, secret: bytes) -> bool:
    scheme, _, encoded = header.partition(" ")
    if scheme.lower() != "basic" or len(encoded) > 256:
        return False
    try:
        credentials = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        return False
    return secrets.compare_digest(credentials, b"likeness:" + secret)


def pairing_key(home: Path) -> str:
    path = home / "pairing.key"
    if not path.exists():
        home.mkdir(parents=True, exist_ok=True)
        path.write_text(secrets.token_urlsafe(9), encoding="utf-8")
    return path.read_text(encoding="utf-8").strip()


def create_app(engine: engines.Engine | None = None, home: Path | None = None, open_door: bool | None = None, config: dict | None = None) -> FastAPI:
    home = home or paths.home()
    home.mkdir(parents=True, exist_ok=True)
    config = settings.load(home) if config is None else config
    engine = engine or engines.create(os.environ.get("LIKENESS_ENGINE") or config["studio"].get("engine", "auto"), config, home)
    owner_file = os.environ.get("LIKENESS_OWNER_SECRET_FILE")
    link_only = os.environ.get("LIKENESS_OWNER_LINK") == "1"
    if link_only and not owner_file:
        raise ValueError("Passwordless owner access requires a local owner secret file.")
    owner_secret = Path(owner_file).read_bytes().strip() if owner_file else b""
    if owner_file and (not owner_secret.isascii() or not 32 <= len(owner_secret) <= 90):
        raise ValueError("The owner secret must contain 32 to 90 ASCII bytes.")
    link_key = owner_link_token(owner_secret) if link_only else ""
    session_key = hmac.new(owner_secret, b"likeness-owner-session-v2", hashlib.sha256).digest() if link_only else b""
    accounts = Accounts(home)
    jobs, key = Jobs(int(config["studio"].get("workers", 4))), pairing_key(home)
    estimates = Estimates(home / f"estimates-{engine.kind}.json", engine.kind)
    open_door = bool(os.environ.get("LIKENESS_OPEN")) if open_door is None else open_door
    app = FastAPI(title="哈基秀", version=__version__, docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
    app.state.engine, app.state.accounts, app.state.jobs, app.state.key = engine, accounts, jobs, key
    app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=3)
    css = public_build(paths.WEB / "css")
    fonts = public_build(paths.WEB / "fonts")
    style_build = "v" + hashlib.sha256((css + fonts).encode()).hexdigest()[:16]
    builds = {name: public_build(paths.WEB / name) for name in ("js", "vendor", "img")}
    builds.update(css=style_build, fonts=style_build)
    bundled = paths.ROOT / "workstation" / "bundle" / "studio.js"
    manifest = bundled.with_name("source.txt")
    bundle = bundled if bundled.is_file() and manifest.is_file() and manifest.read_text(encoding="ascii").strip() == builds["js"] else None
    if bundle:
        builds["bundle"] = "v" + hashlib.sha256(bundle.read_bytes()).hexdigest()[:16]
    shell = app_shell(builds, bundle is not None)
    # The shared cache serves only shipped assets in explicitly versioned groups.
    public_assets = {
        f"/{version}/{file.relative_to(paths.WEB).as_posix()}"
        for group, version in builds.items()
        if group != "bundle"
        for file in (paths.WEB / group).rglob("*")
        if file.is_file() and file.suffix in PUBLIC_ASSET_TYPES and file.resolve().is_relative_to(paths.WEB.resolve())
    }
    if bundle:
        public_assets.add(f'/{builds["bundle"]}/bundle/studio.js')

    def owner_device(cookie: str) -> str | None:
        device, sep, mac = cookie.partition(".")
        if sep and len(device) == 32 and len(mac) == 64 and device.isascii() and all(c in "0123456789abcdef" for c in device):
            signed = hmac.new(session_key, device.encode("ascii"), hashlib.sha256).hexdigest()
            if secrets.compare_digest(mac.encode("utf-8"), signed.encode("ascii")):
                return device
        return None

    def owner_session(request: Request, response, device: str | None = None):
        device = device or owner_device(request.cookies.get(OWNER_COOKIE, "")) or secrets.token_hex(16)
        signed = hmac.new(session_key, device.encode("ascii"), hashlib.sha256).hexdigest()
        response.set_cookie(OWNER_COOKIE, f"{device}.{signed}", max_age=31536000,
                            secure=True, httponly=True, samesite="strict", path="/")
        return response

    def studio_store(request: Request) -> Store:
        """The asking account's own pictures: nobody else's are ever found through it."""
        return Store(accounts.space(request.state.account["id"]), isolated=True)

    def wants_account(request: Request) -> bool:
        path = request.url.path
        return path.startswith("/api/") or path in ("/", "/index.html", "/studio.json") or path.startswith("/open/")

    @app.middleware("http")
    async def account(request: Request, call_next):
        """Every visitor has an account from the first page: a guest one until they sign up (in place) or log in."""
        if not wants_account(request):
            return await call_next(request)
        token = request.cookies.get(SESSION_COOKIE, "")
        who = await run_in_threadpool(accounts.session, token) if token else None
        fresh = None
        if who is None:
            who, fresh = await run_in_threadpool(accounts.guest)
            token = fresh
        request.state.account, request.state.token = who, token
        response = await call_next(request)
        if fresh:
            response.set_cookie(SESSION_COOKIE, fresh, max_age=2 * 31536000, httponly=True, samesite="lax",
                                secure=request.url.scheme == "https", path="/")
        return response

    @app.middleware("http")
    async def paired(request: Request, call_next):
        """Only this machine, or a device that has scanned the pairing code, may come in."""
        if owner_secret:
            if request.method in {"GET", "HEAD"} and request.url.path in public_assets:
                request.state.public_asset = True
                response = await call_next(request)
                response.headers["X-Content-Type-Options"] = "nosniff"
                return response
            if link_only and request.method == "GET" and request.url.path.startswith("/open/"):
                supplied = request.url.path[len("/open/"):]
                if len(supplied) == 64 and secrets.compare_digest(supplied.encode("utf-8"), link_key.encode("ascii")):
                    # Start the app in the authenticated response; its assets are relative to the site root.
                    device = owner_device(request.cookies.get(OWNER_COOKIE, "")) or secrets.token_hex(16)
                    request.state.device = device
                    response = page_response(request, entered=True)
                    response.headers.update(OWNER_HEADERS)
                    return owner_session(request, response, device)
                return HTMLResponse("Open your access link again.", status_code=403, headers=OWNER_HEADERS)
            if link_only and request.url.path == "/open":
                if request.method == "GET":
                    return HTMLResponse(OWNER_OPEN, headers=OWNER_HEADERS)
                if request.method == "POST":
                    expected_origin = f"{request.url.scheme}://{request.url.netloc}"
                    if request.headers.get("origin") == expected_origin:
                        async for chunk in request.stream():
                            if len(chunk) == 64 and secrets.compare_digest(chunk, link_key.encode("ascii")):
                                return owner_session(request, HTMLResponse("", status_code=204, headers=OWNER_HEADERS))
                            break
                    return HTMLResponse("Open your access link again.", status_code=403, headers=OWNER_HEADERS)
            if link_only:
                device = owner_device(request.cookies.get(OWNER_COOKIE, ""))
                if not device:
                    return HTMLResponse("Open Likeness Studio using your access link.", status_code=401, headers=OWNER_HEADERS)
                request.state.device = device
            elif not owner_authenticated(request.headers.get("authorization", ""), owner_secret):
                return HTMLResponse("Sign in to Likeness Studio.", status_code=401, headers={
                    "WWW-Authenticate": 'Basic realm="Likeness Studio", charset="UTF-8"', "Cache-Control": "no-store",
                })
            origin = request.headers.get("origin")
            if request.method not in {"GET", "HEAD"} and origin and origin != f"{request.url.scheme}://{request.url.netloc}":
                return HTMLResponse("Open Likeness Studio to make changes.", status_code=403)
            response = await call_next(request)
            cache = response.headers.get("Cache-Control", "")
            response.headers.update(OWNER_HEADERS)
            if cache.startswith("private, max-age=") and not request.url.path.startswith("/api/"):
                response.headers["Cache-Control"] = cache
            return response
        offered = request.query_params.get("pair")
        if offered and secrets.compare_digest(offered.encode("utf-8"), key.encode("utf-8")):
            response = RedirectResponse(str(request.url.remove_query_params("pair")))
            response.set_cookie("likeness_key", key, max_age=31536000, secure=request.url.scheme == "https", httponly=True, samesite="lax")
            return response
        host = request.client.host if request.client else ""
        cookie = request.cookies.get("likeness_key", "").encode("utf-8")
        if not (open_door or host in LOOPBACK or secrets.compare_digest(cookie, key.encode("utf-8"))):
            return HTMLResponse(NOT_PAIRED, status_code=401)
        response = await call_next(request)
        response.headers["Permissions-Policy"] = "geolocation=()"
        if "Cache-Control" not in response.headers:
            response.headers["cache-control"] = "no-cache"
        return response

    @app.exception_handler(EngineError)
    async def engine_failed(request: Request, error: EngineError):
        return JSONResponse({"detail": str(error), "hint": error.hint}, status_code=502)

    def describe(request: Request) -> dict:
        who = getattr(request.state, "account", None)
        return {"ok": True, "edition": "live", "version": __version__, "engine": engine.describe(),
                **({"account": Accounts.public(who)} if who else {}),
                "events": "poll" if owner_secret else "stream",
                "eta": {pace: estimates.expect("edit", pace) for pace in ("quick", "fine", "deep")},
                "portraitEta": {pace: estimates.expect("restyle", pace) for pace in ("quick", "fine", "deep")}}

    app.get("/studio.json")(describe)
    app.get("/api/health")(describe)

    def page_response(request: Request, *, entered: bool = False):
        info = json.dumps(describe(request), ensure_ascii=True).replace("<", "\\u003c")
        embedded = f'<script id="studio-state" type="application/json">{info}</script>'
        page = shell.replace("<!-- studio-state -->", embedded, 1)
        if entered:
            page = page.replace("<head>", """<head>
<base href="/">
<script>history.replaceState(null, "", "/");</script>""", 1)
        return HTMLResponse(page,
                            headers={"cache-control": "private, no-store"})

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    @app.get("/index.html", response_class=HTMLResponse, include_in_schema=False)
    @app.head("/", response_class=HTMLResponse, include_in_schema=False)
    def home_page(request: Request):
        return page_response(request)

    @app.post("/api/assets")
    async def upload(request: Request, file: UploadFile = File(...), kind: Literal["image", "mask"] = Form("image")):
        data = await file.read(MAX_UPLOAD + 1)
        try:
            note = await run_in_threadpool(studio_store(request).add_bytes, data, kind)
        except ValueError as error:
            raise HTTPException(413 if len(data) > MAX_UPLOAD else 415, str(error)) from None
        return {"id": note["id"], "kind": note["kind"], "w": note["w"], "h": note["h"], "url": Store.url(note["id"])}

    @app.get("/api/assets/{asset_id}")
    def asset(request: Request, asset_id: str):
        path = studio_store(request).path(asset_id)
        if path is None or not path.exists():
            raise HTTPException(404, "找不到这张图")
        return FileResponse(path, media_type="image/jpeg" if path.suffix == ".jpg" else "image/png", headers={"cache-control": "private, max-age=31536000, immutable"})

    def inputs_for(turn: Turn, assets: Store) -> Inputs:
        pictures = {a: assets.path(a) for a in turn.asset_ids()}
        if any(path is None or not path.is_file() for path in pictures.values()):
            raise HTTPException(409, "照片需要重新上传一下")
        return Inputs(
            pictures={h: pictures[a] for h, a in turn.handles.items()},
            subject=turn.handle_of(turn.intent.subject) if turn.intent.subject else None,
            refs=[(h, r.role) for r in turn.intent.refs if (h := turn.handle_of(r.asset))],
            pins=[(p.n, p.note, pictures.get(p.mask)) for p in turn.pins],
            subject_mask=pictures.get(turn.subject_mask),
        )

    @app.post("/api/turns")
    def turn(body: Turn, request: Request):
        assets = studio_store(request)
        device = request.state.account["id"]
        inputs = inputs_for(body, assets)
        eta = estimates.expect(body.intent.op, body.pace, body.n)

        def work(job: Job) -> None:
            started = time.monotonic()
            progress = Work(job, assets, engine.provenance(body))
            engine.turn(body, inputs, progress)
            if not progress.results:
                raise EngineError("这次没有出图", "再试一次，或者换个说法")
            ms = int((time.monotonic() - started) * 1000)
            estimates.record(body.intent.op, body.pace, body.n, ms)
            job.emit("done", ms=ms)

        submission = None
        if body.id:   # the same turn sent twice (a retry after a dropped connection) is the same job, never a second one
            wire = json.dumps(body.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()
            submission = (f"{device}:{body.id}", hashlib.sha256(wire).hexdigest())
        try:
            job = jobs.submit(work, submission, owner=device)
            return {"job": job.id, "eta": eta}
        except SubmissionConflict:
            raise HTTPException(422, "这个请求号已经用过了，刷新一下再试") from None
        except QueueFull:
            raise HTTPException(429, "排队的人有点多，等前面的出片再试", headers={"Retry-After": "10"}) from None

    def find(request: Request, job_id: str) -> Job:
        job = jobs.jobs.get(job_id)
        if job is None or job.owner != request.state.account["id"]:
            raise HTTPException(404, "找不到这个任务，可能服务器刚重启过")
        return job

    @app.get("/api/jobs/{job_id}")
    def job_state(request: Request, job_id: str):
        job = find(request, job_id)
        return {"state": job.state, "events": job.events}

    @app.get("/api/jobs/{job_id}/events")
    async def job_events(request: Request, job_id: str):
        job = find(request, job_id)

        async def stream():
            sent = 0
            while True:
                while sent < len(job.events):
                    event = dict(job.events[sent])
                    sent += 1
                    yield f"event: {event.pop('type')}\ndata: {json.dumps(event)}\n\n"
                if job.finished and sent >= len(job.events):
                    return
                await asyncio.sleep(0.05)

        return StreamingResponse(stream(), media_type="text/event-stream", headers={"cache-control": "no-store", "x-accel-buffering": "no"})

    @app.post("/api/jobs/{job_id}/cancel")
    def cancel(request: Request, job_id: str):
        find(request, job_id)
        return {"ok": jobs.cancel(job_id)}

    @app.post("/api/styles")
    def invent_style(ask: StyleAsk, request: Request):
        """自创风格: a whole new style (name, theme, live filter, prompt, details) from words or a picture."""
        if not ask.text.strip() and not ask.asset:
            raise HTTPException(400, "说一句你想要的风格，或者传一张参考图")
        picture = studio_store(request).path(ask.asset) if ask.asset else None
        if ask.asset and picture is None:
            raise HTTPException(409, "参考图需要重新上传一下")
        maker = getattr(engine, "style", None)
        if maker is None:
            raise HTTPException(501, "这个工作室还不会自创风格")
        return {"style": normalise_style(maker(ask, picture), ask.text.strip())}

    @app.get("/api/history")
    def history(request: Request, limit: int = 120):
        return {"made": studio_store(request).made(max(1, min(limit, 500)))}

    # ---- the account and its private space ----
    @app.exception_handler(AccountError)
    async def account_failed(request: Request, error: AccountError):
        return JSONResponse({"detail": str(error)}, status_code=error.status)

    def me(request: Request) -> dict:
        who = request.state.account
        return {"account": Accounts.public(who), "counts": accounts.counts(who["id"])}

    app.get("/api/me")(me)

    @app.post("/api/auth/signup")
    def signup(body: SignUp, request: Request):
        request.state.account = accounts.signup(request.state.account["id"], body.handle, body.password, body.nickname)
        return me(request)

    @app.post("/api/auth/login")
    def login(body: LogIn, request: Request):
        who = request.client.host if request.client else ""
        request.state.account, moved = accounts.login(request.state.token, request.state.account, body.handle, body.password, who)
        return {**me(request), "moved": moved}

    @app.post("/api/auth/logout")
    def logout(request: Request):
        accounts.logout(request.state.token)
        response = JSONResponse({"ok": True})
        response.delete_cookie(SESSION_COOKIE, path="/")
        return response

    @app.post("/api/auth/profile")
    def profile(body: Profile, request: Request):
        request.state.account = accounts.rename(request.state.account["id"], body.nickname)
        return me(request)

    @app.get("/api/sync")
    def pull(request: Request, cursor: int = 0):
        records, at = accounts.since(request.state.account["id"], max(0, cursor))
        return {"records": records, "cursor": at, "account": request.state.account["id"]}

    @app.post("/api/sync")
    def push(body: SyncIn, request: Request):
        return {"applied": accounts.put(request.state.account["id"], body.records)}

    app.mount("/", StudioFiles(builds, bundle), name="web")
    return app
