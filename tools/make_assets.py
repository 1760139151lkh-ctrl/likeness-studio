"""哈基秀 · 全站视觉资产批量生成（GPT Image）。

    uv run python tools/make_assets.py [--only people,styles,bg,stickers,icon] [--force] [--lanes 6] [--pick dragon,giant]

生成的原图放在 private/assets-raw/（git 忽略），之后由 tools/process_assets.py 裁切压缩进 web/img/。

- people    6 位虚构的亚太年轻创作者自拍（不是真人），作为所有样张的「原图」
- styles    每个风格：mei（首屏引导用同一张脸贯穿全部风格）+ 风格主推人物 + 另一位人物，全部用 images/edits 从原图变身
- bg        每个风格专属的界面背景氛围图（无人物）
- stickers  实时镜头贴纸与界面装饰（透明底 PNG）
- icon      应用图标

Prompt 与 App 发出去的完全一致：通过 node 读取 web/js/presets.js 的 promptFor。
Key 只从环境变量 OPENAI_API_KEY 或 .env.local 读取，不写进任何产物。
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "private" / "assets-raw"
API = "https://api.openai.com/v1"
MODEL = "gpt-image-2.6-sunburst"
LOG_LOCK = threading.Lock()


def key() -> str:
    k = os.environ.get("OPENAI_API_KEY", "").strip()
    env = ROOT / ".env.local"
    if not k and env.is_file():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("OPENAI_API_KEY="):
                k = line.split("=", 1)[1].strip()
    if not k:
        sys.exit("Set OPENAI_API_KEY (or put it in .env.local).")
    return k


def log(*a) -> None:
    with LOG_LOCK:
        print(time.strftime("%H:%M:%S"), *a, flush=True)


def presets() -> dict:
    code = ("import('./web/js/presets.js').then(m => console.log(JSON.stringify({"
            "presets: m.PRESETS.map(p => ({ id: p.id, hero: p.hero, also: p.also, prompt: m.promptFor(p, m.defaultsOf(p), { format: 'portrait' }) })),"
            "people: m.PEOPLE })))")
    out = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


SELFIE = ("A natural, unfiltered smartphone selfie taken at arm's length, photorealistic with true-to-life skin texture, "
          "looking straight at the camera, head and shoulders, face evenly lit and clearly visible. A fictional person. No text.")
PEOPLE = {
    "mei": "A 22-year-old Chinese Singaporean young woman, long straight black hair, light natural makeup, gentle smile, casual white t-shirt, soft even window daylight, plain light wall behind.",
    "aiman": "A 24-year-old Malay Malaysian young man, short neat black hair with a slight fade, light stubble, warm friendly grin, olive-green overshirt over a white tee, soft daylight, light grey wall behind.",
    "priya": "A 21-year-old Indian Singaporean young woman, long wavy dark-brown hair, small gold stud earrings, bright confident smile, mustard-yellow top, warm afternoon window light, cream wall behind.",
    "jun": "A 20-year-old Chinese Malaysian young man, fluffy black two-block haircut with soft bangs, thin round silver glasses, shy half-smile, navy hoodie, cool daylight, pale blue wall behind.",
    "nur": "A 23-year-old Malay young woman wearing a neatly pinned dusty-pink hijab, soft natural makeup, gentle smile, cream blouse, soft daylight, warm beige wall behind.",
    "kai": "A 19-year-old Filipino young woman, copper-dyed short bob with blunt bangs, small silver hoop earrings, playful smirk, oversized plain black tee, bright daylight, white wall behind.",
}

NO_PEOPLE = "No people, no faces, no characters, no text, no logos. Soft, plenty of calm space in the middle for interface elements, tall phone-wallpaper composition."
BACKGROUNDS = {
    "dragon": "A cheerful abstract backdrop: soft custard-yellow and peach gradients, floating glossy candy bubbles, tiny rounded stars and sparkles, squishy and playful.",
    "bighead": "A punchy comic-art backdrop: warm cream paper with bold orange-red and cobalt halftone dots, radial comic burst lines from the centre, pop-art energy.",
    "faceart": "A manga-style backdrop: white paper with dramatic black speed lines radiating from the centre, dotted screentone gradients and a few hot-pink impact bursts.",
    "clay": "A handmade clay diorama backdrop: soft pastel plasticine shapes, rounded candy blobs, tiny clay clouds and stars, faint fingerprints, warm miniature lighting with gentle depth of field.",
    "pet": "A cosy, adorable backdrop: soft blush-pink and apricot gradients, fluffy cloud shapes, tiny paw prints, little hearts and sparkles, warm and gentle.",
    "giant": "An epic Ultraman tokusatsu backdrop: a city at dusk under a deep blue sky, a giant kaiju silhouette far away in the haze, silver and red light streaks, a brilliant blue beam of light and lens flares, cinematic Showa-era film still.",
    "robocat": "A bright Doraemon-anime backdrop in retro 1980s cel animation style: a sky-blue sky with round puffy white clouds over a grassy field, the pink Anywhere Door standing open, a little yellow Take-copter flying, cheerful flat colours.",
    "pilot": "A sci-fi mecha cockpit backdrop: dark teal-black interior, glowing cyan holographic HUD rings, grids and reticles, a few warm orange indicator lights, shallow depth of field.",
    "figure": "A premium designer-toy studio backdrop: a soft lavender seamless sweep, glossy pastel pedestals, little floating sparkles, softbox reflections, clean product-photography mood.",
    "arcade": "A 1990s arcade backdrop in detailed 16-bit pixel art: a purple-to-magenta sunset gradient, a distant pixel city, glowing yellow and pink energy sparks, CRT scanline glow.",
    "princess": "A fairy-tale princess backdrop: soft blush-pink and champagne-gold bokeh, floating translucent hearts, satin ribbons, rose petals and pearls, an elegant arched window of warm light.",
    "gothic": "A dark gothic backdrop: deep plum and black velvet shadows, a glowing gothic stained-glass rose window, antique silver filigree, candle glow, drifting dark rose petals.",
    "anime": "An anime film background painting: a towering summer sky with luminous cumulus clouds, lens flare, a few drifting cherry-blossom petals, breathtaking and airy.",
    "toon3d": "A 3D animated-film backdrop: a warm whimsical storybook town at golden hour, soft round shapes, glowing orbs of light and gentle bokeh, high-end studio render.",
    "ccd": "An early-2000s CCD camera night backdrop: a dark city street at night shot with harsh flash, blooming cold highlights, fine digital noise, blurred orange and blue street lights.",
    "film": "A fresh film-photography backdrop: soft sunlight through green leaves on a quiet lane, creamy lifted shadows, fine 35mm grain, dreamy shallow depth of field, airy and calm.",
    "neon": "A cyberpunk backdrop: a rain-soaked night city with glowing magenta and cyan neon signs dissolved into bokeh, rain streaks, wet reflections, cinematic.",
    "magical": "A 90s magical-girl anime backdrop: a starry pastel night sky with a huge glowing crescent moon, swirling ribbons of light, falling stars, tiny hearts and sparkles, pink and lavender gradients, cel-shaded 2D anime.",
    "shonen": "A shonen battle-anime backdrop: a dark ruined battlefield at a blood-red sunset, erupting golden energy aura and flames, dramatic speed lines radiating outwards, flying debris, bold cel-shaded 2D anime key frame.",
    "ghibli": "A hand-painted Studio Ghibli style backdrop: a lush green summer countryside with rice fields, a little country bus stop, towering fluffy cumulus clouds in a bright blue sky, soft gouache and watercolour, warm nostalgic light.",
    "vtuber": "A VTuber livestream backdrop: a cosy pastel streamer room with glowing LED strips, a soft ring light, floating hearts and stars, cyber-pop neon cyan and pink, clean anime illustration style.",
    "brand": "A vibrant creative-app backdrop: flowing gradients of hot pink, violet and electric cyan, soft glowing light trails and a few sparkles, glossy and energetic.",
}

ISO = "Isolated on a fully transparent background, front view, centred, crisp high-quality product render, no shadow on the ground, no text."
HEADWEAR = ("Only the accessory itself, as a standalone object: no head, no hair, no face, no person, no mannequin. "
            "Seen from the front as it would be worn, its bottom edge where it would meet the hairline.")
STICKERS = {
    "tiara": f"A delicate pearl and rose-gold princess tiara with small diamond sparkles and a heart-shaped centre pearl. {HEADWEAR}",
    "gothic-crown": f"An ornate antique-silver gothic filigree crown with a short black lace veil and tiny dark-purple gems. {HEADWEAR}",
    "nailong-hood": f"A cute plush headband in the style of Nailong, the chubby milky-yellow baby dragon: two tiny orange nub horns and soft round yellow ears on a squishy yellow band. {HEADWEAR}",
    "cat-ears": f"A pair of fluffy cream-and-pink kitten ears on a thin headband, soft fur, pink inner ears. {HEADWEAR}",
    "dog-ears": f"A pair of floppy golden puppy ears on a thin headband, soft fur. {HEADWEAR}",
    "beanie": f"A chunky hand-knitted beanie made of soft coral and mint plasticine clay, with a pom-pom, visible fingerprints, stop-motion style. {HEADWEAR}",
    "ultra-crest": f"The silver Ultraman crest fin: the iconic smooth silver central fin of Ultraman's head with its red side stripes, as a headpiece worn above the forehead. {HEADWEAR}",
    "take-copter": f"Doraemon's yellow Take-copter (bamboo-copter): a small yellow propeller on a short stalk with a round base, seen from the front, flat retro anime cel style. {HEADWEAR}",
    "magic-tiara": f"A 90s magical-girl tiara: a golden tiara with a glowing pink crescent moon jewel in the centre, tiny stars and two small ribbon bows. {HEADWEAR}",
    "ninja-band": f"A ninja forehead-protector headband: a dark blue cloth band with a polished engraved metal plate in the centre (a simple swirl leaf symbol), tails fluttering. {HEADWEAR}",
    "leaf-umbrella": f"A huge glossy green taro leaf held over the head like an umbrella, its stem pointing down, hand-painted anime style. {HEADWEAR}",
    "cat-headset": f"A cute pastel gaming headset with glowing pink cat ears on top and a small boom microphone, anime style. {HEADWEAR}",
    "bow": "A glossy blush-pink satin ribbon bow with long tails and a tiny pearl in the knot.",
    "heart": "A glossy, puffy pink heart gem with soft highlights and a tiny sparkle.",
    "bolt": "A glowing electric-blue energy lightning bolt with silver metallic edges and light streaks.",
    "candy": "A cute pastel clay candy star with fingerprints and a glossy finish.",
    "paw": "A cute fluffy pink cat paw print shaped cushion.",
    "sparkle": "A four-pointed anime sparkle star in white and light blue with a soft glow.",
    "neon-heart": "A glowing magenta and cyan neon-tube heart sign.",
}
ICON = ("A glossy, modern app icon: a playful magic sparkle star with a tiny camera shutter ring around it, over a vibrant "
        "gradient of hot pink, violet and electric cyan, rounded-square icon shape filling the frame, soft 3D depth, no text.")


class Client:
    def __init__(self, k: str) -> None:
        self.k = k

    def _call(self, path: str, body: bytes, ctype: str, timeout: float = 300) -> dict:
        req = urllib.request.Request(API + path, data=body, method="POST", headers={"Authorization": "Bearer " + self.k, "Content-Type": ctype})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))

    def generate(self, prompt: str, size: str, quality: str = "high", transparent: bool = False) -> bytes:
        body = {"model": MODEL, "prompt": prompt, "size": size, "quality": quality, "output_format": "png" if transparent else "webp"}
        if transparent:
            body["background"] = "transparent"
        else:
            body["output_compression"] = 90
        return base64.b64decode(self._call("/images/generations", json.dumps(body).encode(), "application/json")["data"][0]["b64_json"])

    def edit(self, prompt: str, image: bytes, filename: str, size: str, quality: str = "high") -> bytes:
        boundary = "hjx" + uuid.uuid4().hex
        parts = []
        for name, value in (("model", MODEL), ("prompt", prompt), ("size", size), ("quality", quality), ("output_format", "webp"), ("output_compression", "90")):
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        kind = "image/webp" if filename.endswith(".webp") else "image/png"
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="{filename}"\r\nContent-Type: {kind}\r\n\r\n'.encode() + image + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        return base64.b64decode(self._call("/images/edits", b"".join(parts), f"multipart/form-data; boundary={boundary}")["data"][0]["b64_json"])


def retry(fn, label: str):
    for attempt in range(5):
        try:
            return fn()
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                log(label, "retry", e.code)
                time.sleep(6 * (attempt + 1))
                continue
            raise RuntimeError(f"{e.code} {detail}") from None
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < 4:
                log(label, "retry", e)
                time.sleep(6 * (attempt + 1))
                continue
            raise


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="people,styles,bg,stickers,icon")
    ap.add_argument("--pick", default="", help="only these preset ids / sticker names")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--lanes", type=int, default=6)
    ap.add_argument("--variant", default="", help="write alternates as name.<variant>.webp, for picking the best")
    ap.add_argument("--people", default="", help="'all' paints every style on all six people (default: mei, the hero and one more)")
    ap.add_argument("--who", default="", help="only these people (comma list)")
    a = ap.parse_args()
    only, pick = set(a.only.split(",")), set(filter(None, a.pick.split(",")))
    c = Client(key())
    data = presets()
    suffix = f".{a.variant}" if a.variant else ""
    for sub in ("people", "styles", "bg", "stickers", "brand"):
        (RAW / sub).mkdir(parents=True, exist_ok=True)
    meta_path = RAW / "provenance.json"
    meta = json.loads(meta_path.read_text()) if meta_path.is_file() else {}
    meta_lock = threading.Lock()

    def remember(name: str, **info) -> None:
        with meta_lock:
            meta[name] = {"model": MODEL, "made": time.strftime("%Y-%m-%d"), **info}
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1))

    def todo(path: Path) -> bool:
        return a.force or not path.exists()

    def people_job(pid: str, desc: str):
        out = RAW / "people" / f"{pid}{suffix}.webp"
        if not todo(out):
            return
        prompt = f"{desc} {SELFIE}"
        t = time.time()
        out.write_bytes(retry(lambda: c.generate(prompt, "1024x1536"), pid))
        remember(f"people/{pid}", prompt=prompt)
        log("people", pid, f"{time.time() - t:.0f}s")

    def style_job(preset: dict, person: str):
        out = RAW / "styles" / preset["id"] / f"{person}{suffix}.webp"
        if not todo(out):
            return
        src = RAW / "people" / f"{person}.webp"
        for _ in range(240):   # people are being made in the same run
            if src.exists():
                break
            time.sleep(2)
        out.parent.mkdir(parents=True, exist_ok=True)
        t = time.time()
        out.write_bytes(retry(lambda: c.edit(preset["prompt"], src.read_bytes(), f"{person}.webp", "1024x1536"), f"{preset['id']}/{person}"))
        remember(f"styles/{preset['id']}/{person}", prompt=preset["prompt"], source=f"people/{person}")
        log("style", preset["id"], person, f"{time.time() - t:.0f}s")

    def bg_job(sid: str, desc: str):
        out = RAW / "bg" / f"{sid}{suffix}.webp"
        if not todo(out):
            return
        prompt = f"{desc} {NO_PEOPLE}"
        t = time.time()
        out.write_bytes(retry(lambda: c.generate(prompt, "1024x1536"), "bg " + sid))
        remember(f"bg/{sid}", prompt=prompt)
        log("bg", sid, f"{time.time() - t:.0f}s")

    def sticker_job(name: str, desc: str):
        out = RAW / "stickers" / f"{name}{suffix}.png"
        if not todo(out):
            return
        prompt = f"{desc} {ISO}"
        t = time.time()
        out.write_bytes(retry(lambda: c.generate(prompt, "1024x1024", transparent=True), "sticker " + name))
        remember(f"stickers/{name}", prompt=prompt)
        log("sticker", name, f"{time.time() - t:.0f}s")

    def icon_job():
        out = RAW / "brand" / f"icon{suffix}.webp"
        if not todo(out):
            return
        out.write_bytes(retry(lambda: c.generate(ICON, "1024x1024"), "icon"))
        remember("brand/icon", prompt=ICON)
        log("icon done")

    jobs = []
    if "people" in only:
        jobs += [(people_job, pid, desc) for pid, desc in PEOPLE.items() if not pick or pid in pick]
    if "bg" in only:
        jobs += [(bg_job, sid, desc) for sid, desc in BACKGROUNDS.items() if not pick or sid in pick]
    if "stickers" in only:
        jobs += [(sticker_job, n, desc) for n, desc in STICKERS.items() if not pick or n in pick]
    if "icon" in only:
        jobs.append((icon_job,))
    if "styles" in only:
        for p in data["presets"]:
            if pick and p["id"] not in pick:
                continue
            cast = ["mei", p["hero"], *p["also"]] + (list(PEOPLE) if a.people == "all" else [])
            for person in dict.fromkeys(cast):
                if a.who and person not in a.who.split(","):
                    continue
                jobs.append((style_job, p, person))

    failures = []

    def run(job):
        try:
            job[0](*job[1:])
        except Exception as e:   # keep going; report at the end
            label = " ".join(str(x.get("id") if isinstance(x, dict) else x)[:20] for x in job[1:])
            failures.append((label, str(e)[:300]))
            log("FAILED", label, str(e)[:300])

    log(f"{len(jobs)} jobs, {a.lanes} lanes")
    with ThreadPoolExecutor(max_workers=a.lanes) as pool:
        list(pool.map(run, jobs))
    log("done", f"{len(failures)} failed")
    for f in failures:
        log(" -", *f)


if __name__ == "__main__":
    main()
