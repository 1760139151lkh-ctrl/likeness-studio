"""openai: GPT Image through the OpenAI Images API, straight from the studio, with no Codex in between.

The quickest way the studio has to make a picture: one HTTP request per picture, streamed, so the picture can be shown
as it develops (partial images) where the model sends them. The pace chosen in the app picks [openai.pace.*] in
studio.toml (model, quality, how many partial pictures). Rooms, looks and backdrop ideas are asked of a text model
with strict JSON schemas, like the Codex engine's.

The key is read from OPENAI_API_KEY, or from the file [openai].key_file names (keep it under private/). It is sent to
the API and nowhere else: never logged, never written into a job, never returned to the app.
"""

from __future__ import annotations

import base64
import io
import json
import os
import secrets
import socket
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageChops

from .. import brief
from ..rooms import BACKDROPS_SCHEMA, LOOK_SCHEMA, ROOM_SCHEMA, STYLE_SCHEMA

REPLY_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["reply", "suggestions"],
                "properties": {"reply": {"type": "string"}, "suggestions": {"type": "array", "items": {"type": "string"}}}}
from ..turns import SIZES, BackdropAsk, Inputs, LookAsk, RoomAsk, StyleAsk, Turn
from . import EngineError, Work, shaped
from .codex import _composite_region

PACES = {"quick": "Quick", "fine": "Fine", "deep": "Deep"}
DEFAULT_PACES = {
    "quick": {"model": "gpt-image-2.6-flare", "quality": "low", "partials": 1, "timeout": 90},
    "fine": {"model": "gpt-image-2.6-flare", "quality": "medium", "partials": 2, "timeout": 120},
    "deep": {"model": "gpt-image-2.6-sunburst", "quality": "high", "partials": 2, "timeout": 300},
}
EDIT_OPS = {"edit", "restyle", "reference", "blend", "region", "backdrop", "remove", "vary", "angles"}
# one picture per call: each angle is asked for on its own, in this order
ANGLES = [
    "a three-quarter view, the head turned so the nose points toward the right edge of the picture",
    "a full side profile facing the right edge of the picture",
    "a three-quarter view, the head turned so the nose points toward the left edge of the picture",
    "a slightly high angle, looking up at the camera with the chin a little lowered",
]


def _key(config: dict) -> str:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key and config.get("key_file"):
        path = Path(str(config["key_file"])).expanduser()
        key = path.read_text(encoding="utf-8").strip() if path.is_file() else ""
    return key


def _multipart(fields: list[tuple[str, str]], files: list[tuple[str, str, bytes, str]]) -> tuple[bytes, str]:
    """A multipart/form-data body: plain fields, then files (name, filename, bytes, type)."""
    boundary = "likeness" + secrets.token_hex(12)
    out = io.BytesIO()
    for name, value in fields:
        out.write(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    for name, filename, data, kind in files:
        out.write(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\nContent-Type: {kind}\r\n\r\n'.encode())
        out.write(data)
        out.write(b"\r\n")
    out.write(f"--{boundary}--\r\n".encode())
    return out.getvalue(), f"multipart/form-data; boundary={boundary}"


def _jpeg(path: Path) -> bytes:
    """A picture as the API takes it with the fewest bytes: the stored JPEG as it is, anything else re-encoded."""
    if path.suffix == ".jpg":
        return path.read_bytes()
    with Image.open(path) as image:
        buf = io.BytesIO()
        image.convert("RGB").save(buf, "JPEG", quality=92)
        return buf.getvalue()


def _png(path: Path, size: tuple[int, int] | None = None) -> bytes:
    with Image.open(path) as image:
        image = image.convert("RGB")
        if size and image.size != size:
            image = image.resize(size)
        buf = io.BytesIO()
        image.save(buf, "PNG")
        return buf.getvalue()


def _picture(b64: str) -> Image.Image:
    with Image.open(io.BytesIO(base64.b64decode(b64))) as image:
        image.load()
        return image.convert("RGB")


def _said(error: urllib.error.HTTPError) -> EngineError:
    """The API's refusal, in a sentence the person can act on."""
    try:
        detail = json.loads(error.read().decode("utf-8", "replace")).get("error", {})
    except (ValueError, OSError):
        detail = {}
    message, code = str(detail.get("message") or ""), str(detail.get("code") or detail.get("type") or "")
    if error.code == 401:
        return EngineError("生图服务的 Key 不可用", "检查一下服务器上的 OPENAI_API_KEY")
    if error.code == 429:
        return EngineError("生图服务太忙或额度用完了", "等一会儿再试")
    if "moderation" in code or "safety" in code or "safety" in message.lower():
        return EngineError("这张被生图模型的安全审核拦下了", "换个说法或换张照片试试")
    return EngineError("这张没生成出来" + (f"（{message[:120]}）" if message else ""), "再试一次，或者换个说法")


class OpenAIImages:
    id = "openai"
    kind = "openai"

    def __init__(self, config: dict | None = None) -> None:
        self.config = dict(config or {})
        self.base = (os.environ.get("OPENAI_BASE_URL") or self.config.get("base_url") or "https://api.openai.com/v1").rstrip("/")
        self.key = _key(self.config)
        if not self.key:
            raise SystemExit("The openai engine needs a key: set OPENAI_API_KEY (or [openai].key_file in private/studio.toml).")

    # ---- what the app is told ----
    def pace(self, name: str) -> dict:
        return {**DEFAULT_PACES.get(name, DEFAULT_PACES["fine"]), **(self.config.get("pace", {}).get(name) or {})}

    def describe(self) -> dict:
        return {"id": self.id, "kind": self.kind, "label": "GPT Image",
                "paces": {name: {k: self.pace(name).get(k, "") for k in ("model", "quality")} for name in PACES}}

    def provenance(self, turn: Turn) -> dict:
        return {"kind": "render", "label": "Render", "detail": f"GPT Image · {PACES.get(turn.pace, turn.pace)} · {self.pace(turn.pace)['model']}"}

    # ---- HTTP ----
    def _open(self, path: str, body: bytes, kind: str, timeout: float):
        request = urllib.request.Request(self.base + path, data=body, method="POST", headers={
            "Authorization": "Bearer " + self.key, "Content-Type": kind, "Accept": "text/event-stream, application/json"})
        try:
            return urllib.request.urlopen(request, timeout=timeout)
        except urllib.error.HTTPError as error:
            raise _said(error) from None
        except (urllib.error.URLError, socket.timeout, TimeoutError) as error:
            raise EngineError("连不上生图服务", "检查一下服务器的网络") from error

    def _stream(self, response, work: Work, index: int, prompt: str, aspect: str | None, keep=lambda picture: picture) -> bool:
        """Reads the server-sent events of one picture: partial pictures as they come, then the picture itself."""
        data: list[str] = []
        made = False
        for raw in response:
            work.check()
            line = raw.decode("utf-8", "replace").rstrip("\r\n")
            if line.startswith("data:"):
                data.append(line[5:].strip())
                continue
            if line or not data:
                continue
            event, data = json.loads("\n".join(data)), []
            kind = str(event.get("type", ""))
            if kind.endswith("partial_image") and event.get("b64_json"):
                work.stage("draw")
                work.partial(index, shaped(_picture(event["b64_json"]), aspect))
            elif kind.endswith("completed") and event.get("b64_json"):
                work.stage("finish")
                work.result(index, keep(shaped(_picture(event["b64_json"]), aspect)), prompt)
                made = True
            elif event.get("error"):
                raise EngineError("生成到一半停了：" + str(event["error"].get("message", ""))[:120], "再试一次")
        return made

    def _one(self, turn: Turn, inputs: Inputs, work: Work, index: int, prompt: str) -> None:
        pace = self.pace(turn.pace)
        size = SIZES.get(turn.aspect or "", "") or str(self.config.get("size") or "1024x1536")
        if turn.intent.op in EDIT_OPS and inputs.pictures and not turn.aspect:
            with Image.open(inputs.pictures[inputs.subject or next(iter(inputs.pictures))]) as im:   # edit a photo in its own shape
                size = "1536x1024" if im.width > im.height * 1.15 else "1024x1024" if im.width > im.height * .85 else "1024x1536"
        common = [("model", str(pace["model"])), ("prompt", prompt), ("size", size), ("quality", str(pace["quality"])),
                  ("output_format", "jpeg"), ("output_compression", "90"), ("stream", "true"), ("partial_images", str(int(pace.get("partials", 0))))]
        subject = inputs.subject or next(iter(inputs.pictures), None)
        if turn.intent.op in EDIT_OPS and subject:
            first = inputs.pictures[subject]
            with Image.open(first) as im:
                base_size = im.size
            mask = self._mask(inputs, base_size)
            if mask is None:   # no mask: JPEG goes up in a fraction of the time a PNG does
                files = [("image[]", f"{subject}.jpg", _jpeg(first), "image/jpeg")]
                files += [("image[]", f"{h}.jpg", _jpeg(p), "image/jpeg") for h, p in inputs.pictures.items() if h != subject][:7]
            else:
                files = [("image[]", f"{subject}.png", _png(first), "image/png")]
                files += [("image[]", f"{h}.png", _png(p), "image/png") for h, p in inputs.pictures.items() if h != subject][:7]
                files.append(("mask", "mask.png", mask, "image/png"))
            body, kind = _multipart(common, files)
            path = "/images/edits"
        else:
            body = json.dumps({k: (v if k not in ("stream", "partial_images", "output_compression") else (v == "true" if k == "stream" else int(v))) for k, v in common}).encode()
            kind, path = "application/json", "/images/generations"
        work.stage("plan")
        keep = self._keeper(turn, inputs)
        with self._open(path, body, kind, float(pace.get("timeout", 180))) as response:
            if "text/event-stream" in (response.headers.get("Content-Type") or ""):
                if self._stream(response, work, index, prompt, turn.aspect, keep):
                    return
                raise EngineError("这次没有出图", "再试一次")
            answer = json.loads(response.read().decode("utf-8"))
            work.result(index, keep(shaped(_picture(answer["data"][0]["b64_json"]), turn.aspect)), prompt)

    def _keeper(self, turn: Turn, inputs: Inputs):
        """A region edit changes only the marked regions: the new picture is laid into the original through the
        (feathered) union of the masks, so everything outside them stays exactly as it was, pixel for pixel."""
        subject = inputs.subject or next(iter(inputs.pictures), None)
        if turn.intent.op != "region" or not subject:
            return lambda picture: picture
        with Image.open(inputs.pictures[subject]) as im:
            original = im.convert("RGB")
        region = self._region(inputs, original.size)
        if region is None or not region.getbbox():
            return lambda picture: picture
        return lambda picture: _composite_region(picture, original, region)

    @staticmethod
    def _region(inputs: Inputs, size: tuple[int, int]) -> Image.Image | None:
        """The marked regions as one greyscale mask at the picture's size: white where it may change."""
        masks = [m for _, _, m in inputs.pins if m] + ([inputs.subject_mask] if inputs.subject_mask else [])
        if not inputs.pins or not masks:
            return None
        region = Image.new("L", size, 0)
        for path in masks[: len(inputs.pins)]:
            with Image.open(path) as m:
                region = ImageChops.lighter(region, m.convert("L").resize(size))
        return region

    @classmethod
    def _mask(cls, inputs: Inputs, size: tuple[int, int]) -> bytes | None:
        """The marked regions, as the API wants them: transparent where the picture may change."""
        region = cls._region(inputs, size)
        if region is None:
            return None
        out = Image.new("RGBA", size, (0, 0, 0, 255))
        out.putalpha(ImageChops.invert(region))
        buf = io.BytesIO()
        out.save(buf, "PNG")
        return buf.getvalue()

    def turn(self, turn: Turn, inputs: Inputs, work: Work) -> None:
        work.stage("read")
        prompt = brief.direct_brief(turn, inputs)
        work.plan("GPT Image, " + PACES.get(turn.pace, turn.pace).lower() + (f", {turn.n} pictures" if turn.n > 1 else ""), prompt)
        talk = self._talk(turn)   # the reply is written while the picture is made, so it costs no time
        prompts = [prompt] * turn.n
        if turn.intent.op == "angles":
            prompts = [brief.angle_brief(turn, inputs, ANGLES[i % len(ANGLES)]) for i in range(turn.n)]
        if turn.n == 1:
            self._one(turn, inputs, work, 0, prompts[0])
        else:
            with ThreadPoolExecutor(max_workers=min(4, turn.n)) as pool:
                for future in [pool.submit(self._one, turn, inputs, work, i, prompts[i]) for i in range(turn.n)]:
                    future.result()
        work.reply(*self._answer(turn, talk))

    def _talk(self, turn: Turn):
        """Ask the words model for the studio's reply, in the background. None when there is no words model."""
        if not self.config.get("text_model", "gpt-5.4-mini"):
            return None
        pool = ThreadPoolExecutor(max_workers=1)
        try:
            return pool.submit(self._words, brief.reply_brief(turn), REPLY_SCHEMA, None, 30.0)
        finally:
            pool.shutdown(wait=False)

    @staticmethod
    def _answer(turn: Turn, talk) -> tuple[str, list[str]]:
        """The reply and three ideas: the words model's when it answered in time, else the style's own voice."""
        voice = turn.room.voice if turn.room and turn.room.voice else ["出片啦"]
        fallback = (voice[secrets.randbelow(len(voice))], brief.IDEAS.get(turn.intent.op, brief.IDEAS["edit"]))
        if talk is None:
            return fallback
        try:
            answer = talk.result(timeout=5)   # the picture took seconds already: the words get a few more, never longer
        except Exception:
            talk.cancel()
            return fallback
        reply = str(answer.get("reply") or "").strip()
        ideas = [str(s).strip() for s in answer.get("suggestions") or [] if str(s).strip()]
        return reply or fallback[0], (ideas[:3] if len(ideas) >= 2 else fallback[1])

    # ---- words only ----
    def _words(self, text: str, schema: dict, picture: Path | None = None, timeout: float = 90.0) -> dict:
        content: list[dict] = [{"type": "text", "text": text}]
        if picture is not None:
            content.append({"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(_png(picture)).decode()}})
        body = json.dumps({"model": str(self.config.get("text_model") or "gpt-5.4-mini"), "messages": [{"role": "user", "content": content}],
                           "response_format": {"type": "json_schema", "json_schema": {"name": "answer", "strict": True, "schema": schema}}}).encode()
        with self._open("/chat/completions", body, "application/json", timeout) as response:
            answer = json.loads(response.read().decode("utf-8"))
        try:
            return json.loads(answer["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise EngineError("没读懂模型的回答", "再试一次") from error

    def room(self, ask: RoomAsk) -> dict:
        return self._words(brief.room_brief(ask.text, ask.palette), ROOM_SCHEMA)

    def look(self, ask: LookAsk, picture: Path | None) -> dict:
        return self._words(brief.look_brief(ask.text, picture is not None), LOOK_SCHEMA, picture)

    def style(self, ask: StyleAsk, picture: Path | None) -> dict:
        return self._words(brief.style_brief(ask.text, picture is not None), STYLE_SCHEMA, picture)

    def backdrops(self, ask: BackdropAsk, picture: Path | None) -> list[dict]:
        return self._words(brief.backdrops_brief(ask.text, ask.near, ask.dream, ask.room, picture is not None), BACKDROPS_SCHEMA, picture).get("backdrops") or []


# ---- likeness probe openai ----
PROBLEMS = {
    401: "Key 无效、已删除或已过期（401）：换一个新 Key 放进 .env.local，再重启服务。",
    403: "这个 Key 没有权限（403）：检查 OpenAI 项目 / 组织对这个 Key 的限制。",
    429: "额度用完或被限流（429）：到 OpenAI 后台看看余额和每月预算上限。",
}


def probe(config: dict | None = None) -> dict:
    """Is the key here and good, and may it use the models this studio asks for? GET /models costs nothing and makes
    nothing. The report says only whether a key was found, never the key itself."""
    config = dict(config or {})
    base = (os.environ.get("OPENAI_BASE_URL") or config.get("base_url") or "https://api.openai.com/v1").rstrip("/")
    key = _key(config)
    paces = {name: {**DEFAULT_PACES[name], **(config.get("pace", {}).get(name) or {})} for name in PACES}
    images = sorted({str(p["model"]) for p in paces.values() if p.get("model")})
    text = str(config.get("text_model") or "gpt-5.4-mini")
    report: dict = {"engine": "openai", "base": base, "key": "found" if key else "missing", "image_models": {}, "text_model": {}, "ok": False}
    if not key:
        report["problem"] = "没找到 OPENAI_API_KEY：在仓库根目录的 .env.local 里写一行 OPENAI_API_KEY=...（git 会忽略这个文件）。"
        return report
    request = urllib.request.Request(base + "/models", headers={"Authorization": f"Bearer {key}", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            listed = {str(m.get("id")) for m in json.loads(response.read().decode("utf-8")).get("data", []) if isinstance(m, dict)}
    except urllib.error.HTTPError as error:
        report["status"] = error.code
        report["problem"] = PROBLEMS.get(error.code, f"OpenAI 回了 {error.code}，稍后再试。")
        return report
    except (urllib.error.URLError, TimeoutError, socket.timeout, OSError, ValueError):
        report["problem"] = "连不上 OpenAI：检查这台电脑的网络；要走代理或别的地址时设置 OPENAI_BASE_URL。"
        return report
    # some gateways do not list models: then nothing can be checked, and nothing is held against the key
    report["image_models"] = {m: (m in listed) if listed else None for m in images}
    report["text_model"] = {text: (text in listed) if listed else None}
    missing = [m for m, ok in report["image_models"].items() if ok is False]
    report["ok"] = not missing
    if missing:
        report["problem"] = "这个 Key 用不了 " + "、".join(missing) + "：在 private/studio.toml 的 [openai.pace.*] 里换成它能用的型号。"
    elif report["text_model"].get(text) is False:
        report["note"] = f"这个 Key 用不了文字模型 {text}：出图照常，每一步的回复改用本地的口吻。"
    return report
