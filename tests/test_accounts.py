"""Accounts and private spaces: every visitor has one from the first page, nothing they make is visible to anyone
else, signing up keeps everything in place, logging in brings a guest's work along, and records sync by cursor."""

from conftest import follow, png, upload
from fastapi.testclient import TestClient

from likeness.engines.simulator import Simulator
from likeness.server import create_app

CONFIG = {"studio": {"engine": "simulator", "workers": 2}, "codex": {}}


def make(tmp_path):
    return create_app(Simulator(speed=0.02), home=tmp_path / "home", open_door=True, config=CONFIG)


def portrait(client, turn_id="w1"):
    photo = upload(client, png((120, 160), (200, 160, 130)))
    turn = {"id": turn_id, "text": "Repaint this person.", "pace": "quick", "aspect": "square", "preset": "princess",
            "handles": {"A": photo}, "intent": {"op": "restyle", "subject": photo}}
    res = client.post("/api/turns", json=turn)
    assert res.status_code == 200, res.text
    events = follow(client, res.json()["job"])
    return photo, res.json()["job"], next(e for e in events if e["type"] == "result")


def test_every_visitor_gets_a_private_guest_space_from_the_first_page(tmp_path):
    with TestClient(make(tmp_path)) as a:
        page = a.get("/")
        assert page.status_code == 200 and "hjx_sid" in page.headers.get("set-cookie", "")
        me = a.get("/api/me").json()
        assert me["account"]["kind"] == "guest" and me["account"]["id"]
        assert a.get("/studio.json").json()["account"]["id"] == me["account"]["id"]


def test_nobody_else_can_see_your_pictures_or_your_jobs(tmp_path):
    app = make(tmp_path)
    with TestClient(app) as mine, TestClient(app) as theirs:
        mine.get("/"), theirs.get("/")
        photo, job, result = portrait(mine)
        assert mine.get("/" + result["url"]).status_code == 200
        assert theirs.get("/" + result["url"]).status_code == 404
        assert theirs.get(f"/api/assets/{photo}").status_code == 404
        assert theirs.get(f"/api/jobs/{job}").status_code == 404
        assert theirs.post(f"/api/jobs/{job}/cancel").status_code == 404
        turn = {"id": "steal", "text": "x", "handles": {"A": photo}, "intent": {"op": "restyle", "subject": photo}}
        assert theirs.post("/api/turns", json=turn).status_code == 409
        assert theirs.get("/api/history").json()["made"] == []


def test_the_same_turn_sent_twice_is_one_job_not_two(tmp_path):
    with TestClient(make(tmp_path)) as c:
        photo = upload(c, png())
        turn = {"id": "again", "text": "Repaint.", "pace": "quick", "handles": {"A": photo}, "intent": {"op": "restyle", "subject": photo}}
        first, second = c.post("/api/turns", json=turn).json(), c.post("/api/turns", json=turn).json()
        assert first["job"] == second["job"]


def test_signing_up_keeps_everything_in_place(tmp_path):
    with TestClient(make(tmp_path)) as c:
        c.get("/")
        guest = c.get("/api/me").json()["account"]["id"]
        _, _, result = portrait(c)
        c.post("/api/sync", json={"records": [{"coll": "works", "id": "w1", "data": {"id": "w1", "asset": result["url"]}, "updated": 1}]})
        res = c.post("/api/auth/signup", json={"handle": "Mei_SG", "password": "secret123", "nickname": "小美"})
        assert res.status_code == 200, res.text
        account = res.json()["account"]
        assert account["id"] == guest and account["kind"] == "member" and account["handle"] == "mei_sg" and account["nickname"] == "小美"
        assert c.get("/" + result["url"]).status_code == 200
        assert [r["id"] for r in c.get("/api/sync").json()["records"]] == ["w1"]
        assert c.post("/api/auth/signup", json={"handle": "other", "password": "secret123"}).status_code == 409


def test_logging_in_brings_a_guests_work_along_and_logging_out_leaves_it_with_the_account(tmp_path):
    app = make(tmp_path)
    with TestClient(app) as phone:
        phone.get("/")
        assert phone.post("/api/auth/signup", json={"handle": "kai", "password": "secret123"}).status_code == 200
        phone.post("/api/sync", json={"records": [{"coll": "favs", "id": "neon", "data": {"id": "neon"}, "updated": 5}]})
        assert phone.post("/api/auth/logout").status_code == 200
    with TestClient(app) as tablet:
        tablet.get("/")
        _, _, result = portrait(tablet, "t1")
        tablet.post("/api/sync", json={"records": [{"coll": "works", "id": "t1", "data": {"id": "t1", "asset": result["url"]}, "updated": 7}]})
        assert tablet.post("/api/auth/login", json={"handle": "kai", "password": "nope"}).status_code == 401
        res = tablet.post("/api/auth/login", json={"handle": "KAI", "password": "secret123"})
        assert res.status_code == 200 and res.json()["moved"] == 1 and res.json()["account"]["handle"] == "kai"
        ids = {(r["coll"], r["id"]) for r in tablet.get("/api/sync").json()["records"]}
        assert ids == {("favs", "neon"), ("works", "t1")}
        assert tablet.get("/" + result["url"]).status_code == 200, "the guest's picture moved into the account's space"
        tablet.post("/api/auth/logout")
        tablet.cookies.clear()
        tablet.get("/")
        assert tablet.get("/api/me").json()["account"]["kind"] == "guest"
        assert tablet.get("/api/sync").json()["records"] == []


def test_sync_is_by_the_servers_cursor_and_the_newer_record_wins(tmp_path):
    with TestClient(make(tmp_path)) as c:
        c.get("/")
        c.post("/api/sync", json={"records": [{"coll": "works", "id": "a", "data": {"v": 1}, "updated": 100}]})
        first = c.get("/api/sync").json()
        assert len(first["records"]) == 1 and first["cursor"] > 0
        assert c.post("/api/sync", json={"records": [{"coll": "works", "id": "a", "data": {"v": 0}, "updated": 50}]}).json()["applied"] == 0
        c.post("/api/sync", json={"records": [{"coll": "works", "id": "a", "data": {"v": 2}, "updated": 200, "deleted": True},
                                              {"coll": "nonsense", "id": "x", "data": {}}, {"coll": "works", "id": "../x", "data": {}}]})
        later = c.get(f"/api/sync?cursor={first['cursor']}").json()
        assert [(r["id"], r["deleted"], r["data"]["v"]) for r in later["records"]] == [("a", True, 2)]


def test_a_burst_of_wrong_passwords_is_slowed_down(tmp_path):
    with TestClient(make(tmp_path)) as c:
        c.get("/")
        codes = [c.post("/api/auth/login", json={"handle": "ghost", "password": "wrong-one"}).status_code for _ in range(9)]
        assert codes[:8] == [401] * 8 and codes[8] == 429


def test_threads_and_invented_styles_are_kept_in_the_private_space(client):
    """对话微调的记录和自创风格也跟着账号走：刷新、换设备都还在。"""
    rec = [{"coll": "threads", "id": "s1", "data": {"id": "s1", "messages": [{"me": True, "text": "蝴蝶结换成红色"}]}, "updated": 1},
           {"coll": "styles", "id": "my-abc", "data": {"id": "my-abc", "custom": True, "name": "星河糖果"}, "updated": 1}]
    assert client.post("/api/sync", json={"records": rec}).json()["applied"] == 2
    got = {r["coll"] for r in client.get("/api/sync?cursor=0").json()["records"]}
    assert {"threads", "styles"} <= got
