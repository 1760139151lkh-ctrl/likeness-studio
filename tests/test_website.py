"""The studio as a website on the internet, paid for with the owner's API key: the key is checked without spending
anything, and only browsers that have opened the owner's private link get in. Nothing here reaches the network."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from fastapi.testclient import TestClient

from likeness import cli, paths
from likeness.engines import openai_images
from likeness.server import create_app, owner_link_token, owner_secret_path

from conftest import CONFIG
from likeness.engines.simulator import Simulator

KEY = "sk-test-not-real-0123456789"


class Models(BaseHTTPRequestHandler):
    status = 200
    ids = ["gpt-image-2.6-flare", "gpt-image-2.6-sunburst", "gpt-5.4-mini"]
    auth = ""

    def log_message(self, *args):
        pass

    def do_GET(self):
        Models.auth = self.headers.get("Authorization", "")
        self.send_response(Models.status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        body = {"data": [{"id": i, "object": "model"} for i in Models.ids]} if Models.status == 200 else {"error": {"message": "no"}}
        self.wfile.write(json.dumps(body).encode())


@pytest.fixture
def models(monkeypatch):
    server = ThreadingHTTPServer(("127.0.0.1", 0), Models)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    Models.status, Models.ids = 200, ["gpt-image-2.6-flare", "gpt-image-2.6-sunburst", "gpt-5.4-mini"]
    monkeypatch.setenv("OPENAI_BASE_URL", f"http://127.0.0.1:{server.server_port}/v1")
    monkeypatch.setenv("OPENAI_API_KEY", KEY)
    yield Models
    server.shutdown()


def test_the_key_is_checked_for_free_and_never_shown(models):
    report = openai_images.probe({})
    assert report["ok"] and report["key"] == "found"
    assert report["image_models"] == {"gpt-image-2.6-flare": True, "gpt-image-2.6-sunburst": True}
    assert models.auth == f"Bearer {KEY}"
    assert KEY not in json.dumps(report)


def test_a_deleted_key_says_so_plainly(models):
    models.status = 401
    report = openai_images.probe({})
    assert not report["ok"] and report["status"] == 401 and "Key" in report["problem"]
    assert KEY not in json.dumps(report)


def test_a_model_the_key_cannot_use_is_named(models):
    models.ids = ["gpt-image-2.6-flare"]
    report = openai_images.probe({})
    assert not report["ok"] and "gpt-image-2.6-sunburst" in report["problem"]
    assert report["text_model"] == {"gpt-5.4-mini": False}


def test_no_key_at_all(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    report = openai_images.probe({})
    assert not report["ok"] and report["key"] == "missing" and ".env.local" in report["problem"]


@pytest.fixture
def website(tmp_path, monkeypatch):
    """The studio in owner link mode, behind HTTPS (as behind a tunnel that ends TLS for it)."""
    secret = tmp_path / "owner.secret"
    secret.write_text("s" * 64, encoding="utf-8")
    monkeypatch.setenv("LIKENESS_OWNER_LINK", "1")
    monkeypatch.setenv("LIKENESS_OWNER_SECRET_FILE", str(secret))
    app = create_app(Simulator(speed=0.02), home=tmp_path / "home", config=CONFIG)
    with TestClient(app, base_url="https://studio.example") as client:
        yield client, owner_link_token(b"s" * 64)


def test_a_stranger_is_turned_away_and_the_owner_link_lets_a_browser_in(website):
    client, token = website
    assert client.get("/").status_code == 401
    assert client.get("/api/health").status_code == 401
    assert client.get("/open/" + "0" * 64).status_code == 403
    opened = client.get("/open/" + token)
    assert opened.status_code == 200 and "__Host-likeness" in opened.headers.get("set-cookie", "")
    assert "secure" in opened.headers["set-cookie"].lower()
    assert client.get("/api/health").status_code == 200        # the same browser, from now on
    assert client.get("/").status_code == 200


def test_add_to_home_screen_works_without_the_cookie_but_nothing_private_does(website):
    client, _ = website
    for name in ("manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "icon.svg", "sw.js"):
        assert client.get("/" + name).status_code == 200, name
    for path in ("/", "/index.html", "/studio.json", "/api/health", "/api/sync"):
        assert client.get(path).status_code == 401, path


def test_another_site_cannot_make_changes_with_the_owners_browser(website):
    client, token = website
    client.get("/open/" + token)
    assert client.post("/api/sync", json={"records": []}, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post("/api/sync", json={"records": []}, headers={"Origin": "https://studio.example"}).status_code != 403


def test_without_https_the_owner_cookie_is_never_kept(tmp_path, monkeypatch):
    secret = tmp_path / "owner.secret"
    secret.write_text("s" * 64, encoding="utf-8")
    monkeypatch.setenv("LIKENESS_OWNER_LINK", "1")
    monkeypatch.setenv("LIKENESS_OWNER_SECRET_FILE", str(secret))
    with TestClient(create_app(Simulator(speed=0.02), home=tmp_path / "home", config=CONFIG), base_url="http://studio.example") as client:
        client.get("/open/" + owner_link_token(b"s" * 64))
        assert client.get("/api/health").status_code == 401      # a Secure cookie does not travel over plain HTTP


def test_a_relative_secret_file_is_read_from_the_repository(monkeypatch):
    monkeypatch.setenv("LIKENESS_OWNER_SECRET_FILE", "private/owner.secret")
    assert owner_secret_path() == paths.ROOT / "private" / "owner.secret"
    monkeypatch.delenv("LIKENESS_OWNER_SECRET_FILE")
    assert owner_secret_path() is None


def test_likeness_link_makes_the_secret_once_and_prints_the_matching_link(tmp_path, monkeypatch, capsys):
    secret = tmp_path / "owner.secret"
    monkeypatch.setenv("LIKENESS_OWNER_SECRET_FILE", str(secret))
    monkeypatch.delenv("LIKENESS_OWNER_LINK", raising=False)
    assert cli.main(["link", "--base", "https://studio.example/"]) == 0
    first = capsys.readouterr().out
    made = secret.read_bytes().strip()
    assert 32 <= len(made) <= 90 and made.isascii()
    assert f"https://studio.example/open/{owner_link_token(made)}" in first
    assert "LIKENESS_OWNER_LINK=1" in first                      # it says how to turn the mode on
    assert cli.main(["link", "--base", "https://studio.example"]) == 0
    assert secret.read_bytes().strip() == made                    # the same secret: devices stay in
    assert cli.main(["link", "--new"]) == 0
    assert secret.read_bytes().strip() != made                    # a new one: every device must open the new link
