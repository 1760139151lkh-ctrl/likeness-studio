"""哈基秀 · 把 private/assets-raw/ 里的生成原图裁切压缩成网页用的尺寸，写进 web/img/，并生成 web/img/manifest.json。

    uv run python tools/process_assets.py

每张样张三个尺寸：大图（720×1080，成片展示/首屏引导）、卡片（360×540）、头像缩略（192×192，脸部居中）。
贴纸裁掉透明边，保留透明通道。应用图标导出 192/512/180 三个 PNG。
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "private" / "assets-raw"
WEB = ROOT / "web"
IMG = WEB / "img"
FACE_Y = 0.36   # the portraits are composed head-and-shoulders: the face sits about a third of the way down


def save(im: Image.Image, path: Path, quality: int, **kw) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=6, **kw)


def fit(im: Image.Image, w: int, h: int) -> Image.Image:
    """Cover-crop to w × h, keeping the face (a little above the middle) in frame."""
    scale = max(w / im.width, h / im.height)
    r = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (r.width - w) // 2
    top = max(0, min(r.height - h, int(r.height * FACE_Y - h * 0.42)))
    return r.crop((left, top, left + w, top + h))


def face_square(im: Image.Image, size: int, span: float = 0.66) -> Image.Image:
    side = int(im.width * span)
    cx, cy = im.width // 2, int(im.height * FACE_Y)
    top = max(0, min(im.height - side, cy - side // 2))
    left = max(0, min(im.width - side, cx - side // 2))
    return im.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)


def portrait_set(src: Path, dest: Path) -> dict:
    with Image.open(src) as raw:
        im = raw.convert("RGB")
    save(fit(im, 720, 1080), dest.with_suffix(".webp"), 80)
    save(fit(im, 360, 540), dest.with_name(dest.name + "-m.webp"), 76)
    save(face_square(im, 192), dest.with_name(dest.name + "-t.webp"), 80)
    return {"w": 720, "h": 1080}


def main() -> None:
    started = time.time()
    provenance = json.loads((RAW / "provenance.json").read_text()) if (RAW / "provenance.json").is_file() else {}
    manifest: dict = {"by": "GPT Image (gpt-image-2.6-sunburst)", "made": time.strftime("%Y-%m-%d"), "people": [], "styles": {}, "bg": [], "stickers": {}, "scenes": []}
    # start clean: a picture taken out of private/assets-raw (a retired style, a replaced sticker) leaves the site too
    for sub in ("people", "styles", "bg", "stickers", "scenes"):
        shutil.rmtree(IMG / sub, ignore_errors=True)

    for src in sorted((RAW / "people").glob("*.webp")):
        if "." in src.stem:
            continue
        portrait_set(src, IMG / "people" / src.stem)
        manifest["people"].append(src.stem)

    for folder in sorted((RAW / "styles").iterdir()):
        if not folder.is_dir():
            continue
        made = []
        for src in sorted(folder.glob("*.webp")):
            if "." in src.stem:
                continue
            portrait_set(src, IMG / "styles" / folder.name / src.stem)
            made.append(src.stem)
        manifest["styles"][folder.name] = made

    for src in sorted((RAW / "bg").glob("*.webp")):
        if "." in src.stem:
            continue
        with Image.open(src) as raw:
            save(fit(raw.convert("RGB"), 540, 810), IMG / "bg" / f"{src.stem}.webp", 70)
        manifest["bg"].append(src.stem)

    for src in sorted((RAW / "stickers").glob("*.png")):
        if "." in src.stem:
            continue
        with Image.open(src) as raw:
            im = raw.convert("RGBA")
        alpha = im.getchannel("A").point(lambda a: 255 if a > 12 else 0)
        box = alpha.getbbox() or (0, 0, im.width, im.height)
        im = im.crop(box)
        im.thumbnail((512, 512), Image.LANCZOS)
        save(im, IMG / "stickers" / f"{src.stem}.webp", 86, exact=True)
        manifest["stickers"][src.stem] = {"w": im.width, "h": im.height}

    # 换背景的场景缩略图（精修台里点一下就换）
    for src in sorted((RAW / "scenes").glob("*.webp")):
        if "." in src.stem:
            continue
        with Image.open(src) as raw:
            save(fit(raw.convert("RGB"), 256, 256), IMG / "scenes" / f"{src.stem}.webp", 76)
        manifest["scenes"].append(src.stem)

    icon = RAW / "brand" / "icon.webp"
    if icon.is_file():
        with Image.open(icon) as raw:
            im = raw.convert("RGB")
        for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")):
            im.resize((size, size), Image.LANCZOS).save(WEB / name, "PNG", optimize=True)
        save(im.resize((128, 128), Image.LANCZOS), IMG / "brand" / "icon.webp", 84)

    (IMG / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    # what made each picture (model, date, the exact prompt): kept beside them, not inlined into the page
    live = {f"people/{p}" for p in manifest["people"]} | {f"styles/{k}/{p}" for k, v in manifest["styles"].items() for p in v} | {f"bg/{b}" for b in manifest["bg"]} \
        | {f"stickers/{k}" for k in manifest["stickers"]} | {f"scenes/{k}" for k in manifest["scenes"]} | {"brand/icon"}
    provenance = {k: v for k, v in provenance.items() if k in live}
    (IMG / "provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    total = sum(f.stat().st_size for f in IMG.rglob("*") if f.is_file())
    print(f"web/img: {total / 2**20:.1f} MB in {time.time() - started:.0f}s")


if __name__ == "__main__":
    main()
