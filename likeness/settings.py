"""Studio settings: studio.toml in the repository (the defaults, committed), then private/studio.toml (this machine's
own answers, never committed) on top."""

from __future__ import annotations

import tomllib
from pathlib import Path

from . import paths


def _merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in over.items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def load(home: Path | None = None) -> dict:
    config: dict = {}
    for path in (paths.CONFIG, (home or paths.home()) / "studio.toml"):
        if path.exists():
            config = _merge(config, tomllib.loads(path.read_text(encoding="utf-8")))
    config.setdefault("studio", {}).setdefault("engine", "auto")
    config["studio"].setdefault("workers", 2)
    config.setdefault("codex", {})
    return config


def load_env_local(root: Path | None = None) -> None:
    """KEY=value lines from .env.local (git-ignored) into the environment, without overriding what is already set.
    This is where a local OPENAI_API_KEY lives; it is never logged or written anywhere else."""
    import os

    path = (root or paths.ROOT) / ".env.local"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
