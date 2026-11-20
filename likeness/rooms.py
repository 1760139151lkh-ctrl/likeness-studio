"""Rooms, looks and backdrop ideas as the app understands them, and the guard rails for ones a model invents:
whatever comes back is checked and completed here, so a strange answer can never break the app."""

from __future__ import annotations

import colorsys
import hashlib
import re
import secrets

TYPES = ["editorial", "romance", "grotesk", "typewriter", "classical", "modern", "pixel"]
FRAMES = ["print", "arch", "glow", "square", "round", "postcard", "brass", "polaroid"]
ORNAMENTS = ["heart", "note", "notes", "bow", "seal", "rose", "teacup", "star", "sparkle", "asterisk", "leaf", "petal", "flower", "wave", "moon", "sun", "snowflake", "bolt", "crown", "shell", "cloud", "drop", "gem", "planet", "flame", "bubble", "confetti", "key", "feather", "ink"]
SETS = ["window", "boudoir", "grid", "blinds", "glasshouse", "awning", "dome", "none"]
TEXTURES = ["grain", "grain-heavy", "linen", "scanlines", "dots", "stripes", "none"]
WEATHERS = ["clear", "motes", "petals", "hearts", "notes", "rain", "drizzle", "snow", "leaves", "fireflies", "stars", "glints", "sparkles", "bubbles", "embers", "confetti", "fog"]
LIGHTS = ["auto", "dawn", "day", "golden", "dusk", "night"]
WIPES = ["ink", "heart", "star", "leaf", "scan", "blinds", "wave", "curtain"]
SOUNDS = ["wood", "musicbox", "synth", "typewriter", "glass", "none"]
MOTIONS = ["calm", "float", "crisp", "bouncy"]
COLOUR_KEYS = ["ground", "ground2", "surface", "ink", "soft", "accent", "accent2"]
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

VOICE = {
    "hello": {"morning": "Morning. What shall we make?", "afternoon": "Afternoon. What shall we make?", "evening": "Evening. What shall we make?", "night": "Late. What shall we make?"},
    "placeholder": "Ask for anything", "send": "Send",
    "stages": {"read": "Looking closely", "plan": "Thinking it through", "draw": "Painting", "finish": "Finishing"},
    "done": ["Here it is.", "Fresh.", "What do you think?"],
}


def _hsl(h: float, s: float, l: float) -> str:
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, max(0, min(1, l)), max(0, min(1, s)))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def _lum(hex_: str) -> float:
    r, g, b = (int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast(a: str, b: str) -> float:
    x, y = sorted((_lum(a), _lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def colours_for(hue: float, sat: float = 0.45, dark: bool = False) -> dict:
    if dark:
        c = {"ground": _hsl(hue, sat * .55, .07), "ground2": _hsl(hue + 18, sat * .6, .15), "surface": _hsl(hue, sat * .45, .12), "ink": _hsl(hue, .25, .93), "soft": _hsl(hue, .18, .68), "accent": _hsl(hue + 8, max(.6, sat), .62), "accent2": _hsl(hue + 150, .6, .7)}
    else:
        c = {"ground": _hsl(hue, sat * .55, .94), "ground2": _hsl(hue + 10, sat * .6, .86), "surface": _hsl(hue, sat * .5, .985), "ink": _hsl(hue, min(.5, sat), .2), "soft": _hsl(hue, sat * .35, .45), "accent": _hsl(hue + 4, max(.55, sat), .55), "accent2": _hsl(hue + 40, .5, .5)}
    return c


def _num(value, default: float, low: float = 0.0, high: float = 1.0) -> float:
    try:
        return max(low, min(high, float(value)))
    except (TypeError, ValueError):
        return default


def _dict(value) -> dict:
    return value if isinstance(value, dict) else {}


def _list(value) -> list:
    return value if isinstance(value, list) else []


def _pick(value, allowed: list, default):
    return value if value in allowed else default


def normalise_room(raw: dict, text: str = "") -> dict:
    """Whatever a model answered, a room the app can wear."""
    raw = raw if isinstance(raw, dict) else {}
    dark = bool(raw.get("dark"))
    hue = int(hashlib.sha1(text.encode()).hexdigest()[:6], 16) % 360
    base = colours_for(hue, dark=dark)
    given = _dict(raw.get("colors") or raw.get("colours"))
    colors = {k: (given.get(k) if isinstance(given.get(k), str) and HEX.match(given.get(k, "")) else base[k]) for k in COLOUR_KEYS}
    if contrast(colors["ink"], colors["surface"]) < 4.5:
        colors["ink"] = "#f4efe6" if _lum(colors["surface"]) < 0.2 else "#1d1915"
    colors["onAccent"] = "#16110e" if _lum(colors["accent"]) > 0.45 else "#fffaf5"
    voice = _dict(raw.get("voice"))
    hello, stages, sky = _dict(voice.get("hello")), _dict(voice.get("stages")), _dict(raw.get("sky"))
    clean = lambda s, n: str(s)[:n] if s else ""
    room = {
        "id": "room-" + secrets.token_hex(4),
        "name": clean(raw.get("name"), 40) or text.title()[:40] or "A new room",
        "line": clean(raw.get("line"), 120) or f"A room made from “{text[:80]}”.",
        "dark": dark, "colors": colors,
        "type": _pick(raw.get("type"), TYPES, "editorial"), "frame": _pick(raw.get("frame"), FRAMES, "print"),
        "ornament": _pick(raw.get("ornament"), ORNAMENTS, "sparkle"),
        "motifs": [m for m in _list(raw.get("motifs")) if m in ORNAMENTS][:4] or ["sparkle"],
        "set": _pick(raw.get("set"), SETS, "none"), "texture": _pick(raw.get("texture"), TEXTURES, "grain"),
        "sky": {"weather": _pick(sky.get("weather", raw.get("weather")), WEATHERS, "motes"), "light": _pick(sky.get("light", raw.get("light")), LIGHTS, "auto")},
        "wipe": _pick(raw.get("wipe"), WIPES, "ink"), "sound": _pick(raw.get("sound"), SOUNDS, "wood"), "motion": _pick(raw.get("motion"), MOTIONS, "calm"),
        "radius": _num(raw.get("radius"), 2.0, 0.0, 6.0),
        "voice": {
            "hello": {k: clean(hello.get(k), 90) or VOICE["hello"][k] for k in VOICE["hello"]},
            "placeholder": clean(voice.get("placeholder"), 28) or VOICE["placeholder"], "send": clean(voice.get("send"), 14) or VOICE["send"],
            "stages": {k: clean(stages.get(k), 40) or VOICE["stages"][k] for k in VOICE["stages"]},
            "done": [clean(d, 60) for d in _list(voice.get("done")) if d][:4] or VOICE["done"],
        },
        "mine": True, "made": "studio",
    }
    return room


def normalise_look(raw: dict, text: str = "") -> dict:
    raw = raw if isinstance(raw, dict) else {}
    ramp = [c for c in _list(raw.get("ramp")) if isinstance(c, str) and HEX.match(c)][:6]
    if len(ramp) < 3:
        hue = int(hashlib.sha1(text.encode()).hexdigest()[:6], 16) % 360
        ramp = [_hsl(hue, .5, l) for l in (.1, .28, .5, .74, .93)]
    ramp.sort(key=_lum)
    num = lambda k, d: _num(raw.get(k), d)
    return {"id": "look-" + secrets.token_hex(4), "name": str(raw.get("name") or text or "A new look")[:40], "line": str(raw.get("line") or "")[:120],
            "prompt": str(raw.get("prompt") or text)[:600], "ramp": ramp, "keep": num("keep", .25), "grain": num("grain", .04), "bloom": num("bloom", .15), "vignette": num("vignette", .2), "mine": True}


def normalise_backdrops(raw) -> list[dict]:
    items = raw.get("backdrops") if isinstance(raw, dict) else raw
    out = []
    for b in items or []:
        if isinstance(b, dict) and b.get("name") and b.get("words"):
            out.append({"name": str(b["name"])[:60], "words": str(b["words"])[:300]})
    return out[:8]


# JSON schemas for answers from a model (strict: every property required, nothing extra).
def _obj(props: dict) -> dict:
    return {"type": "object", "additionalProperties": False, "required": list(props), "properties": props}


S = {"type": "string"}
ROOM_SCHEMA = _obj({
    "name": S, "line": S, "dark": {"type": "boolean"},
    "colors": _obj({k: S for k in COLOUR_KEYS}),
    "type": {"type": "string", "enum": TYPES}, "frame": {"type": "string", "enum": FRAMES}, "ornament": {"type": "string", "enum": ORNAMENTS},
    "motifs": {"type": "array", "items": {"type": "string", "enum": ORNAMENTS}}, "set": {"type": "string", "enum": SETS},
    "texture": {"type": "string", "enum": TEXTURES}, "weather": {"type": "string", "enum": WEATHERS}, "light": {"type": "string", "enum": LIGHTS},
    "wipe": {"type": "string", "enum": WIPES}, "sound": {"type": "string", "enum": SOUNDS}, "motion": {"type": "string", "enum": MOTIONS}, "radius": {"type": "number"},
    "voice": _obj({"hello": _obj({k: S for k in ("morning", "afternoon", "evening", "night")}), "placeholder": S, "send": S,
                   "stages": _obj({k: S for k in ("read", "plan", "draw", "finish")}), "done": {"type": "array", "items": S}}),
})
LOOK_SCHEMA = _obj({"name": S, "line": S, "prompt": S, "ramp": {"type": "array", "items": S}, "keep": {"type": "number"}, "grain": {"type": "number"}, "bloom": {"type": "number"}, "vignette": {"type": "number"}})
BACKDROPS_SCHEMA = _obj({"backdrops": {"type": "array", "items": _obj({"name": S, "words": S})}})


# ---- 哈基秀: a style invented from words or a picture (自创风格) ----
STYLE_FRAMES = ["poster", "arch", "sticker", "candy", "print", "paper", "neon", "magic", "gothic", "comic", "energy", "brackets", "box", "circle", "tv", "stream", "scroll", "gilt", "deco", "tiles", "tarot", "blossom", "vhs", "cinema", "pop"]
STYLE_DECOS = ["sparkle", "hearts", "bubbles", "halftone", "candy", "stars", "clouds", "leaves", "neon", "orbs", "grid", "dots", "thorns", "flames", "mist", "xiangyun", "doodle", "bendays", "waves", "deco", "tiles", "blossom", "vhs", "canvas"]
STYLE_DISPLAYS = ["round", "serif", "tech", "comic", "mono", "gothic", "pixel", "brush", "sans"]
STYLE_GROUPS = ["acc", "light", "scene", "frame"]
N = {"type": "number"}
B = {"type": "boolean"}
STYLE_SCHEMA = _obj({
    "name": S, "line": S, "hook": S, "prompt": S, "dark": B,
    "colors": _obj({k: S for k in ("bg", "bg2", "surface", "ink", "soft", "accent", "accent2")}),
    "look": _obj({k: N for k in ("sat", "contrast", "warmth", "posterize", "edge", "bloom", "grain", "vignette", "smooth")}),
    "frame": {"type": "string", "enum": STYLE_FRAMES}, "deco": {"type": "string", "enum": STYLE_DECOS}, "display": {"type": "string", "enum": STYLE_DISPLAYS},
    "details": {"type": "array", "items": _obj({"group": {"type": "string", "enum": STYLE_GROUPS}, "label": S, "words": S})},
})


def _hex(value, default: str) -> str:
    return value if isinstance(value, str) and HEX.match(value) else default


def normalise_style(raw: dict, text: str = "") -> dict:
    """Whatever a model invents becomes a complete, safe 哈基秀 preset: colours that read, numbers in range,
    two details in each group, an id of its own. A strange answer can never break the app."""
    raw = raw if isinstance(raw, dict) else {}
    seed = text or json_safe(raw.get("name"))
    hue = int(hashlib.sha1(seed.encode()).hexdigest()[:6], 16) % 360
    dark = bool(raw.get("dark"))
    base = colours_for(hue, .55, dark)
    c = _dict(raw.get("colors"))
    colors = {"bg": _hex(c.get("bg"), base["ground"]), "bg2": _hex(c.get("bg2"), base["ground2"]), "surface": _hex(c.get("surface"), base["surface"]),
              "ink": _hex(c.get("ink"), base["ink"]), "soft": _hex(c.get("soft"), base["soft"]), "accent": _hex(c.get("accent"), base["accent"]), "accent2": _hex(c.get("accent2"), base["accent2"])}
    if contrast(colors["ink"], colors["surface"]) < 4.5:   # text must read on its cards
        colors["ink"] = "#f6f3ff" if _lum(colors["surface"]) < .3 else "#1d1a24"
    if contrast(colors["soft"], colors["surface"]) < 2.6:
        colors["soft"] = colors["ink"]
    dark = _lum(colors["surface"]) < .3
    look = _dict(raw.get("look"))
    num = lambda k, d, lo=0.0, hi=1.0: round(_num(look.get(k), d, lo, hi), 3)
    clean = lambda v, n: " ".join(str(v or "").split())[:n]
    groups: dict[str, list[dict]] = {g: [] for g in STYLE_GROUPS}
    for item in _list(raw.get("details")):
        if isinstance(item, dict) and item.get("group") in groups and item.get("label") and item.get("words"):
            groups[item["group"]].append({"label": clean(item["label"], 8), "words": clean(item["words"], 200)})
    fallback = {"acc": [("小配饰", "a small matching accessory"), ("发饰", "a pretty hair ornament")],
                "light": [("柔光", "soft flattering light"), ("闪光点", "little light sparkles")],
                "scene": [("纯色底", "a clean solid-colour background"), ("梦幻背景", "a dreamy matching background")],
                "frame": [("画框", "a matching decorative frame"), ("贴纸白边", "a thick white die-cut sticker outline")]}
    details = []
    for g in STYLE_GROUPS:
        items = (groups[g] + [{"label": a, "words": b} for a, b in fallback[g]])[:2]
        for i, it in enumerate(items):
            details.append({"id": f"{g}{i + 1}", "label": it["label"], "group": g, "words": it["words"], **({"solo": g} if g in ("scene", "frame") else {})})
    prompt = clean(raw.get("prompt"), 700) or f"Repaint this person in this style: {text}. Still clearly them."
    name = clean(raw.get("name"), 8) or (clean(text, 6) or "我的风格")
    radius = {"arch": "999px 999px 24px 24px", "circle": "50%", "pixel": "0px"}.get(raw.get("frame"), "20px")
    return {
        "id": "my-" + secrets.token_hex(4), "custom": True, "cat": "mine", "hot": 0,
        "name": name, "line": clean(raw.get("line"), 30) or f"由「{clean(text, 12) or '一张图'}」变出来的风格", "hook": clean(raw.get("hook"), 12) or "我的专属风格",
        "prompt": prompt,
        "theme": {"dark": dark, **colors, "onAccent": "#ffffff" if _lum(colors["accent"]) < .5 else "#1a1408",
                  "glow": colors["accent"] + "73", "line": ("#ffffff" if dark else "#000000") + "22", "radius": radius,
                  "display": _pick(raw.get("display"), STYLE_DISPLAYS, "round"), "deco": _pick(raw.get("deco"), STYLE_DECOS, "sparkle"), "frame": _pick(raw.get("frame"), STYLE_FRAMES, "poster")},
        "live": {"grade": [1, 1, 1], "sat": num("sat", 1.1, .5, 1.6), "contrast": num("contrast", 1.05, .5, 1.6), "lift": 0, "warmth": num("warmth", 0, -1, 1),
                 "grain": num("grain", .1), "vignette": num("vignette", .25), "bloom": num("bloom", .2), "posterize": num("posterize", .2), "edge": num("edge", .15),
                 "halftone": 0, "pixel": 0, "bulge": 0, "eyes": 0, "smooth": num("smooth", .5), "rim": [0, 0, 0, 0, 0, 0], "scan": 0, "overlay": "sparkle"},
        "details": details,
        "defaults": {"strength": 80, "likeness": 75, "richness": 60, "beauty": 35, "words": "", "details": [details[2]["id"], details[4]["id"]]},
        "hero": "mei", "also": [], "emblem": ["sparkle", "heart"], "from": clean(text, 120),
    }


def json_safe(value) -> str:
    return str(value or "style")
