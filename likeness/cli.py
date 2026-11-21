"""likeness: one command for the studio.

  serve          start the studio (the app, its API and an engine) and print how a phone reaches it
  probe codex    check that Codex CLI is here, signed in, and speaks the flags the studio uses; --smoke makes a picture
  relay          run a relay packet
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import sys
from pathlib import Path

from . import __version__, paths


def _lan_address() -> str:
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("10.255.255.255", 1))
        return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def _write(report: dict, out: str | None) -> None:
    text = json.dumps(report, indent=2)
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(text, encoding="utf-8")
    print(text)


def serve(args) -> int:
    import uvicorn

    from . import engines, settings
    from .server import create_app, pairing_key

    home = paths.home()
    config = settings.load(home)
    engine = engines.create(args.engine or config["studio"].get("engine", "auto"), config, home)
    app = create_app(engine, home=home, open_door=args.open, config=config)
    scheme = "https" if args.cert and args.key else "http"
    local = f"{scheme}://127.0.0.1:{args.port}/"
    honest = "  (every picture is a stand-in, stamped as one)" if engine.kind == "simulator" else ""
    print(f"\n  哈基秀 {__version__}  ·  {engine.describe()['label']}{honest}\n\n  On this machine   {local}\n")
    if os.environ.get("LIKENESS_OWNER_LINK") == "1":
        print("  Owner link mode: only browsers that have opened your private link come in (likeness link prints it).\n")
    elif args.host not in {"localhost", "127.0.0.1", "::1"}:
        phone = f"{scheme}://{_lan_address()}:{args.port}/?pair={pairing_key(home)}"
        print(f"  On your phone     {phone}\n")
        try:
            import segno

            segno.make(phone, error="m").terminal(compact=True, border=2)
        except Exception:
            pass
        print("  The phone must be on the same network. Scan the code once; it stays paired.")
    print("  Ctrl+C stops the studio.\n", flush=True)
    tls = {"ssl_certfile": args.cert, "ssl_keyfile": args.key} if scheme == "https" else {}
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning", access_log=False, **tls)
    return 0


def link(args) -> int:
    """Owner link mode, for the studio as a website: only browsers that have opened this private link come in.
    Makes the secret on first use (under the private folder, which git ignores) and prints the link."""
    import secrets

    from .server import owner_link_token, owner_secret_path

    path = owner_secret_path() or paths.home() / "owner.secret"
    made = args.new or not path.is_file()
    if made:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(secrets.token_urlsafe(48), encoding="utf-8")
        try:
            path.chmod(0o600)
        except OSError:
            pass
    token = owner_link_token(path.read_bytes().strip())
    base = (args.base or "https://<your-site>").rstrip("/")
    try:
        shown = path.relative_to(paths.ROOT).as_posix()
    except ValueError:
        shown = str(path)
    print(("\n  A new secret: " if made else "\n  Secret: ") + shown + "  (keep it private; never commit it)")
    if os.environ.get("LIKENESS_OWNER_LINK") != "1" or owner_secret_path() is None:
        print("\n  Turn owner link mode on: put these two lines in .env.local, then restart  likeness serve\n"
              f"    LIKENESS_OWNER_LINK=1\n    LIKENESS_OWNER_SECRET_FILE={shown}")
    print(f"\n  Your private link (open it once on each phone or computer; anyone holding it can use your key):\n\n    {base}/open/{token}\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):   # Windows consoles default to a code page that cannot print ·, × or a QR block
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    parser = argparse.ArgumentParser(prog="likeness", description="Likeness: a personal image studio you talk to.")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("serve", help="start the studio")
    p.add_argument("--engine", default="", help="auto, simulator, codex or openai (default: studio.toml, then auto)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8787)
    p.add_argument("--open", action="store_true", help="let any device on the network in without pairing")
    p.add_argument("--cert", default="", help="a TLS certificate (PEM), to serve over HTTPS: phones only allow the camera on a secure origin")
    p.add_argument("--key", default="", help="the certificate's private key (PEM)")

    p = sub.add_parser("probe", help="check an engine on this machine")
    p.add_argument("engine", choices=["codex", "openai"])
    p.add_argument("--smoke", action="store_true", help="also make pictures through the real engine and time them")
    p.add_argument("--out", help="write the report here too (pictures go beside it)")

    p = sub.add_parser("link", help="your private access link to the studio as a website (owner link mode)")
    p.add_argument("--base", default="", help="the website's address, e.g. https://studio.example.com")
    p.add_argument("--new", action="store_true", help="make a new secret: every device must open the new link again")

    p = sub.add_parser("relay", help="run a relay packet")
    p.add_argument("action", choices=["run", "pending"])
    p.add_argument("packet", nargs="?", default="")
    p.add_argument("--only", action="append")

    args = parser.parse_args(argv)
    from .settings import load_env_local

    load_env_local()
    if args.command == "serve":
        return serve(args)
    if args.command == "probe":
        from . import settings

        if args.engine == "openai":
            from .engines import openai_images

            report = openai_images.probe(settings.load().get("openai", {}))
            _write(report, args.out)
            return 0 if report["ok"] else 1
        from .engines import codex

        report = codex.probe(settings.load().get("codex", {}), smoke=args.smoke, out=Path(args.out).parent if args.out else None)
        _write(report, args.out)
        return 0 if report["ok"] else 1
    if args.command == "link":
        return link(args)
    from . import relay

    if args.action == "pending":
        print("\n".join(p.name for p in relay.pending()) or "No pending packets.")
        return 0
    waiting = relay.pending()
    if not args.packet and not waiting:
        print("No pending packets.")
        return 0
    status = relay.run(args.packet or waiting[0].name, args.only)
    return 0 if not status["stopped_at"] else 1
