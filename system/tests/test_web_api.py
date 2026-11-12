"""The /api JSON endpoints from docs/API_CONTRACT.md."""
import json
import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from crunchradar.api import create_app
from crunchradar.store import Store
from crunchradar.workflows import System


@pytest.fixture
def client(sysm, monkeypatch):
    monkeypatch.delenv("ADMIN_KEY", raising=False)
    monkeypatch.delenv("LIMIT_HOURS", raising=False)
    return TestClient(create_app(sysm))


@pytest.fixture
def locked(sysm, monkeypatch):
    monkeypatch.setenv("ADMIN_KEY", "op-key")
    monkeypatch.delenv("LIMIT_HOURS", raising=False)
    return TestClient(create_app(sysm))


OP_GETS = ["/api/overview", "/api/assessments", "/api/assumptions", "/api/proposals", "/api/runs", "/api/outbox", "/api/extensions", "/api/student-link?email=a@x.edu"]
OP_POSTS = [("/api/workflows/monday-check", None), ("/api/workflows/follow-up", None), ("/api/assumptions/reset", None),
            ("/api/brief-reader", {"text": "Demo in Week 5."}), ("/api/pre-publish", {"mod": "IAC", "type": "report", "due": 11}),
            ("/api/extensions/1/decide", {"decision": "approve"})]


def all_tokens(sysm):
    return [t for p in sysm.store.proposals() for t in (p["token"], p["lec_token"])]


# ---------- auth ----------
def test_open_when_no_admin_key(client):
    s = client.get("/api/session").json()
    assert s["auth_required"] is False and s["authenticated"] is True
    assert s["limit"] == 28 and s["weeks"] == 14 and s["cohort"] == "APD2F2606SE" and s["sample_data"] is True
    assert s["holidays"]["3"].startswith("Thaipusam") and s["avoid_weeks"] == [6, 10] and s["protected_weeks"] == [14]
    for path in OP_GETS:
        assert client.get(path).status_code == 200, path


def test_operator_endpoints_need_key(locked):
    for path in OP_GETS:
        assert locked.get(path).status_code == 401, path
    for path, body in OP_POSTS:
        assert locked.post(path, json=body).status_code == 401, path
    assert locked.put("/api/assumptions", json={"classes_h": 10}).status_code == 401
    s = locked.get("/api/session").json()
    assert s["auth_required"] is True and s["authenticated"] is False
    assert locked.get("/api/healthz").status_code == 200


def test_login_sets_httponly_cookie_and_logout_clears(locked):
    assert locked.post("/api/login", json={"key": "wrong"}).status_code == 401
    r = locked.post("/api/login", json={"key": "op-key"})
    assert r.status_code == 200 and "httponly" in r.headers["set-cookie"].lower()
    assert locked.get("/api/session").json()["authenticated"] is True
    assert locked.get("/api/overview").status_code == 200
    locked.post("/api/logout")
    locked.cookies.clear()          # the test client keeps the jar; the response above told the browser to drop it
    assert locked.get("/api/overview").status_code == 401


def test_header_key_works_but_query_key_does_not(locked):
    assert locked.get("/api/overview", headers={"X-Admin-Key": "op-key"}).status_code == 200
    assert locked.get("/api/overview?key=op-key").status_code == 401     # keys never in URLs for the new API


def test_healthz(client):
    h = client.get("/api/healthz").json()
    assert h["ok"] and "version" in h and h["scheduler"] is False


# ---------- overview / assessments ----------
def test_overview_matches_summary_and_grid_adds_up(client):
    o = client.get("/api/overview").json()
    assert o["limit"] == 28 and o["peak"] == 48.3 and o["crunch_weeks"] == 3 and o["hidden_tasks"] == 2 and o["waiting_for_person"] == 0
    assert len(o["weekly_hours"]) == 14 and set(o["grid"]) == {m["id"] for m in o["modules"]}
    for w in range(14):
        assert abs(sum(row[w] for row in o["grid"].values()) - o["weekly_hours"][w]) < 0.3
    assert {"CCP", "SWAT", "FWD"} <= set(o["grid"]) and all(len(v) == 14 for v in o["grid"].values())
    assert next(m for m in o["modules"] if m["id"] == "CCP")["credits"] == 4
    assert set(o["sensitivity"]) == {"24", "28", "32", "36"} and o["sensitivity"]["28"] == 3
    assert {i["kind"] for i in o["issues"]} >= {"crunch", "hidden"} and o["briefs"]


def test_assessments_have_hours_and_source(client):
    a = client.get("/api/assessments").json()
    assert len([x for x in a if x["source"] == "brief"]) == 2
    for x in a:
        assert x["hours"] > 0 and x["hours_why"] and x["feedback_week"] >= x["due"]
        assert (x["source"] == "brief") == bool(x["hidden"])


# ---------- assumptions ----------
def test_assumptions_default_and_change_limit(client, sysm):
    a = client.get("/api/assumptions").json()
    assert a["limit"] == 28 and a["limit_source"] == "computed" and a["credits"] == 21 and a["classes_h"] == 20 and a["revision_h"] == 12
    assert a["base"] == a["base_default"] and a["base"]["code"] == 12 and a["source"]["url"].startswith("https://")
    r = client.put("/api/assumptions", json={"revision_h": 20})
    assert r.status_code == 200 and r.json()["limit"] == 20 and r.json()["revision_h"] == 20 and r.json()["classes_h"] == 20
    o = client.get("/api/overview").json()
    assert o["limit"] == 20 and o["crunch_weeks"] == 4                       # weeks 7, 9, 10, 11
    assert client.get("/api/session").json()["limit"] == 20
    r = client.put("/api/assumptions", json={"classes_h": 8, "revision_h": 12})
    assert r.json()["limit"] == 40 and client.get("/api/overview").json()["crunch_weeks"] == 1
    assert System(sysm.s.__class__(db_path=sysm.s.db_path, secret="test-secret"), Store(sysm.s.db_path)).summary()["limit"] == 40   # persisted
    r = client.post("/api/assumptions/reset").json()
    assert r["limit"] == 28
    o = client.get("/api/overview").json()
    assert o["peak"] == 48.3 and o["crunch_weeks"] == 3 and o["hidden_tasks"] == 2


def test_base_hours_change_every_calculation(client):
    before = client.get("/api/overview").json()["peak"]
    r = client.put("/api/assumptions", json={"base": {"code": 20}})
    assert r.status_code == 200 and r.json()["base"]["code"] == 20 and r.json()["base"]["report"] == 8
    assert client.get("/api/overview").json()["peak"] > before
    assert next(x for x in client.get("/api/assessments").json() if x["type"] == "code")["hours_why"][0] == "code base 20 h"
    client.post("/api/assumptions/reset")
    assert client.get("/api/overview").json()["peak"] == before


@pytest.mark.parametrize("body", [{"classes_h": 41}, {"revision_h": -1}, {"base": {"code": 0.1}}, {"base": {"code": 41}}, {"base": {"essay": 5}},
                                  {"classes_h": 40, "revision_h": 40}])
def test_assumptions_validated(client, body):
    assert client.put("/api/assumptions", json=body).status_code == 422
    assert client.get("/api/assumptions").json()["limit"] == 28


# ---------- proposals / runs / outbox never leak tokens ----------
def test_lists_never_leak_tokens(client, sysm):
    r = client.post("/api/workflows/monday-check")
    assert r.status_code == 200 and r.json()["requested"]
    p = sysm.store.proposals("pending")[0]
    client.post(f"/api/approve/{p['token']}", json={"decision": "approve"})
    tokens = all_tokens(sysm)
    for path in ["/api/proposals", "/api/runs", "/api/outbox", "/api/overview", "/api/extensions"]:
        text = client.get(path).text
        assert not any(t in text for t in tokens), path
    props = client.get("/api/proposals").json()
    assert props and all("token" not in x and "lec_token" not in x for x in props)
    assert {"id", "assess_id", "from_w", "to_w", "status", "expires", "run_id"} <= set(props[0])
    assert "[link hidden]" in next(m for m in client.get("/api/outbox").json() if m["kind"] == "approval-request")["body"]


def test_runs_expose_mode_and_model(client, sysm):
    client.post("/api/workflows/monday-check")
    sysm.store.add_run("Monday crunch check", "x", "Completed", "1 crunch week(s). Agent: gemini (gemini-2.5-flash). done")
    runs = client.get("/api/runs?limit=5").json()
    assert runs[0]["mode"] == "gemini" and runs[0]["model"] == "gemini-2.5-flash"
    mc = next(r for r in runs if r["workflow"] == "Monday crunch check" and r["mode"] == "rules")
    assert mc["model"] is None and isinstance(mc["detail"], dict)
    assert len(client.get("/api/runs?limit=1").json()) == 1


# ---------- workflows ----------
def test_pre_publish_and_brief_reader(client):
    r = client.post("/api/pre-publish", json={"mod": "IAC", "type": "report", "weight": 20, "words": 2000, "due": 11, "brief_text": "Present your findings in Week 12."})
    assert r.status_code == 200 and r.json()["over_limit"] and r.json()["brief_reader"]["tasks"]
    assert client.post("/api/pre-publish", json={"mod": "IAC", "type": "essay", "due": 11}).status_code == 422
    b = client.post("/api/brief-reader", json={"text": "Submit the code in Week 11. Each group demos their system in Week 12."}).json()
    assert b["mode"] == "rules" and len(b["tasks"]) == 2
    for t in b["tasks"]:
        assert t["formula_hours"] > 0 and isinstance(t["cohort_hours_that_week"], float) and isinstance(t["over_limit"], bool)
    assert any(t["over_limit"] for t in b["tasks"] if t["week"] == 11)


def test_follow_up_endpoint(client):
    assert "checked" in client.post("/api/workflows/follow-up").json()


# ---------- approval + lecturer links ----------
def test_approve_json_flow(client, sysm):
    client.post("/api/workflows/monday-check")
    p = sysm.store.proposals("pending")[0]
    assert client.get("/api/approve/nope").status_code == 404
    g = client.get(f"/api/approve/{p['token']}").json()
    assert g["status"] == "pending" and not g["expired"] and g["peak_after"] < g["peak_before"] and g["from_w"] < g["to_w"]
    assert client.post(f"/api/approve/{p['token']}", json={"decision": "maybe"}).status_code == 422
    r = client.post(f"/api/approve/{p['token']}", json={"decision": "approve"}).json()
    assert r["ok"] and "lecturer" in r["message"]
    again = client.post(f"/api/approve/{p['token']}", json={"decision": "approve"}).json()
    assert not again["ok"] and "Already" in again["message"]                          # single use
    assert client.get(f"/api/approve/{p['token']}").json()["status"] == "approved"
    lec = client.get(f"/api/lecturer/{p['lec_token']}").json()
    assert lec["status"] == "approved" and not lec["expired"]
    d = client.post(f"/api/lecturer/{p['lec_token']}/decline").json()
    assert d["ok"] and sysm.store.proposal(p["id"])["status"] == "declined"
    assert not client.post(f"/api/lecturer/{p['lec_token']}/decline").json()["ok"]    # used
    assert client.get("/api/lecturer/nope").status_code == 404


def test_reject_via_json_changes_nothing(client, sysm):
    client.post("/api/workflows/monday-check")
    p = sysm.store.proposals("pending")[0]
    assert client.post(f"/api/approve/{p['token']}", json={"decision": "reject"}).json()["ok"]
    assert client.get("/api/overview").json()["peak"] == 48.3
    assert not any(m["kind"] == "reschedule" for m in sysm.store.outbox())


def test_expired_links(client, sysm, monkeypatch):
    t0 = datetime(2027, 1, 11, 0, 0, tzinfo=timezone.utc)
    clock = {"t": t0}
    monkeypatch.setattr("crunchradar.store.now", lambda: clock["t"].isoformat())
    client.post("/api/workflows/monday-check")
    p1, p2 = sysm.store.proposals("pending")[:2]
    client.post(f"/api/approve/{p2['token']}", json={"decision": "approve"})
    clock["t"] = t0 + timedelta(hours=73)
    g = client.get(f"/api/approve/{p1['token']}").json()
    assert g["expired"] and g["status"] == "expired"
    r = client.post(f"/api/approve/{p1['token']}", json={"decision": "approve"}).json()
    assert not r["ok"]
    clock["t"] = t0 + timedelta(days=15)
    assert client.get(f"/api/lecturer/{p2['lec_token']}").json()["expired"] is True
    assert "expired" in client.post(f"/api/lecturer/{p2['lec_token']}/decline").json()["message"]


# ---------- student ----------
def test_student_digest_and_link(client, sysm):
    link = client.get("/api/student-link?email=Ana@X.edu").json()
    assert link["token"] == sysm.student_token("ana@x.edu") and link["token"] in link["url"]
    assert client.get(f"/api/student?email=ana@x.edu&token=bad&week=11").status_code == 403
    d = client.get(f"/api/student?email=ana@x.edu&token={link['token']}&week=11").json()
    assert d["week"] == 11 and d["heavy"] and d["limit"] == 28 and d["due"]
    assert d["marks_per_hour"] == sorted(d["marks_per_hour"], key=lambda x: -x["mph"]) and len(d["marks_per_hour"]) <= 6
    assert all(9 <= 11 < x["due"] <= 13 and x["hours_this_week"] > 0 for x in d["start_now"])
    assert d["pulse"]["mine"] is False and d["pulse"]["cohort"] == 52
    assert client.post("/api/pulse", json={"email": "ana@x.edu", "token": link["token"], "week": 11}).json()["ok"]
    d = client.get(f"/api/student?email=ana@x.edu&token={link['token']}&week=11").json()
    assert d["pulse"]["mine"] is True and d["pulse"]["count"] == 1


# ---------- extension requests ----------
def ext(client, sysm, email, assess_id, days, reason, personal=0):
    return client.post("/api/extensions", json={"email": email, "token": sysm.student_token(email), "assess_id": assess_id, "days": days, "reason": reason, "personal_hours": personal})


def light_and_heavy(sysm):
    from crunchradar import rules
    plan = sysm.load_plan()["plan"]
    tot = rules.loads(plan, 14, sysm.base)
    heavy = next(a for a in plan if not a.fixed and not a.hidden and tot[a.due] > 28)
    light = next(a for a in plan if not a.fixed and not a.hidden and tot[a.due] + 2 < 28)
    return light, heavy, tot


def test_extension_rules(client, sysm):
    light, heavy, tot = light_and_heavy(sysm)
    r = ext(client, sysm, "m@x.edu", light.id, 10, "medical").json()
    assert r["status"] == "pending" and r["draft"]["verdict"] == "approve" and r["draft"]["days"] == 7
    assert any("policy allows 7" in w for w in r["draft"]["why"])
    f = ext(client, sysm, "f3@x.edu", light.id, 9, "family").json()["draft"]
    assert f["verdict"] == "approve" and f["days"] == 5
    assert ext(client, sysm, "f4@x.edu", light.id, 2, "family").json()["draft"]["days"] == 2
    w = ext(client, sysm, "w1@x.edu", light.id, 5, "workload").json()["draft"]
    assert w["verdict"] == "decline" and w["days"] == 0
    w = ext(client, sysm, "w2@x.edu", heavy.id, 5, "workload").json()["draft"]
    assert w["verdict"] == "approve" and w["days"] == 3 and "crunch week" in w["why"][0]
    w = ext(client, sysm, "w3@x.edu", light.id, 5, "workload", personal=40).json()["draft"]      # personal hours push the week over
    assert w["verdict"] == "approve" and w["days"] == 3
    o = ext(client, sysm, "o@x.edu", light.id, 5, "other").json()["draft"]
    assert o["verdict"] == "refer" and o["days"] == 0


def test_extension_validation(client, sysm):
    light, _, _ = light_and_heavy(sysm)
    assert client.post("/api/extensions", json={"email": "a@x.edu", "token": "bad", "assess_id": light.id, "days": 3, "reason": "medical", "personal_hours": 0}).status_code == 403
    assert ext(client, sysm, "a@x.edu", "zzz", 3, "medical").status_code == 404
    assert ext(client, sysm, "a@x.edu", light.id, 3, "bored").status_code == 422
    assert ext(client, sysm, "a@x.edu", light.id, 0, "medical").status_code == 422
    assert ext(client, sysm, "a@x.edu", light.id, 3, "medical").status_code == 200
    assert ext(client, sysm, "a@x.edu", light.id, 3, "medical").status_code == 409          # one open request per student per task


def test_extension_pattern_note_on_crunch_task(client, sysm):
    light, heavy, _ = light_and_heavy(sysm)
    for i in range(2):
        assert "note" not in ext(client, sysm, f"p{i}@x.edu", heavy.id, 3, "workload").json()["pattern"]
    r = ext(client, sysm, "p2@x.edu", heavy.id, 3, "workload").json()
    assert r["pattern"]["students_asking"] == 3 and "Consider moving the deadline for everyone" in r["pattern"]["note"]
    for i in range(3):
        r = ext(client, sysm, f"q{i}@x.edu", light.id, 3, "medical").json()
    assert r["pattern"]["students_asking"] == 3 and "note" not in r["pattern"]                   # not a crunch week


def test_extension_approve_emails_student_and_logs_run(client, sysm):
    _, heavy, _ = light_and_heavy(sysm)
    before = client.get("/api/assessments").json()
    eid = ext(client, sysm, "Stu@X.edu", heavy.id, 5, "medical").json()["id"]
    lst = client.get("/api/extensions").json()
    assert lst[0]["id"] == eid and lst[0]["status"] == "pending" and lst[0]["draft"]["days"] == 5 and "contact" not in lst[0]
    run = next(r for r in client.get("/api/runs").json() if r["workflow"] == "Extension triage")
    assert run["status"] == "Needs review"
    assert client.post(f"/api/extensions/{eid}/decide", json={"decision": "maybe"}).status_code == 422
    r = client.post(f"/api/extensions/{eid}/decide", json={"decision": "approve"}).json()
    assert r["ok"] and "emailed" in r["message"]
    mail = next(m for m in client.get("/api/outbox").json() if m["kind"] == "extension")
    assert "approved for 5 days" in mail["body"] and mail["to_addr"].startswith("student ") and "@" not in mail["to_addr"]
    run = next(r for r in client.get("/api/runs").json() if r["workflow"] == "Extension triage")
    assert run["status"] == "Completed" and "student emailed" in run["note"]
    assert client.post(f"/api/extensions/{eid}/decide", json={"decision": "approve"}).status_code == 409
    assert client.post("/api/extensions/999/decide", json={"decision": "approve"}).status_code == 404
    assert client.get("/api/assessments").json() == before                                       # an extension never moves a deadline
    assert not sysm.store.proposals("approved")


def test_extension_override_sends_nothing(client, sysm):
    light, _, _ = light_and_heavy(sysm)
    eid = ext(client, sysm, "o@x.edu", light.id, 3, "other").json()["id"]
    assert client.post(f"/api/extensions/{eid}/decide", json={"decision": "override"}).json()["ok"]
    assert not any(m["kind"] == "extension" for m in sysm.store.outbox())
    assert client.get("/api/extensions").json()[0]["status"] == "overridden"


def test_extension_email_reaches_smtp_with_real_address(client, sysm, monkeypatch):
    sent = []
    monkeypatch.setattr(sysm.mailer, "send", lambda to, subject, body, **kw: sent.append((to, kw)) or {"sent": True})
    light, _, _ = light_and_heavy(sysm)
    eid = ext(client, sysm, "real@x.edu", light.id, 3, "medical").json()["id"]
    client.post(f"/api/extensions/{eid}/decide", json={"decision": "approve"})
    assert sent[0][0] == "real@x.edu" and sent[0][1]["record_to"].startswith("student ")


def test_emails_never_stored_in_plain_text(client, sysm):
    light, _, _ = light_and_heavy(sysm)
    emails = ["secret.student@x.edu", "Other.Person@Uni.edu"]
    for e in emails:
        tok = sysm.student_token(e)
        client.post("/api/pulse", json={"email": e, "token": tok, "week": 5})
        eid = ext(client, sysm, e, light.id, 3, "medical").json()["id"]
        client.post(f"/api/extensions/{eid}/decide", json={"decision": "approve"})
    dump = json.dumps([[list(r) for r in sysm.store.db.execute(f"SELECT * FROM {t}")]
                       for (t,) in sysm.store.db.execute("SELECT name FROM sqlite_master WHERE type='table'")]).lower()
    for e in emails:
        assert e.lower() not in dump and e.split("@")[0].lower() not in dump
    lists = "".join(client.get(p).text for p in ["/api/extensions", "/api/outbox", "/api/runs"]).lower()
    assert not any(e.lower() in lists for e in emails)
    assert not any(sysm.student_token(e) in lists for e in emails)                     # student tokens never in lists either


def test_seal_roundtrip_and_tamper():
    from crunchradar.extensions import seal, unseal
    b = seal("k", "a@x.edu")
    assert unseal("k", b) == "a@x.edu" and unseal("other", b) is None and "a@x.edu" not in b
    assert unseal("k", b[:-4] + ("AAAA" if not b.endswith("AAAA") else "BBBB")) is None
    assert re.fullmatch(r"[\w=-]+", b)


def test_api_routes_do_not_shadow_existing_routes(client):
    assert client.get("/healthz").status_code == 200 and client.get("/summary").status_code == 200
    assert client.get("/").status_code == 200


def test_spa_served_to_browsers_only(sysm, tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from crunchradar.api import create_app
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>SPA</title>")
    (dist / "assets" / "a.js").write_text("console.log(1)")
    monkeypatch.setenv("SPA_DIST", str(dist))
    c = TestClient(create_app(sysm))
    html = {"accept": "text/html"}
    assert "SPA" in c.get("/approvals", headers=html).text                 # deep link opens the app
    assert "SPA" in c.get("/approve/anything", headers=html).text          # emailed link opens the React page
    assert "SPA" in c.get("/runs", headers=html).text
    (dist / "icon.svg").write_text("<svg/>")
    assert c.get("/icon.svg").status_code == 200                           # built root files are served to any client
    assert c.get("/assets/a.js").status_code == 200
    assert isinstance(c.get("/runs").json(), list)                         # API clients still get JSON
    assert c.get("/api/session").json()["authenticated"] in (True, False)
    assert "Weekly assignment load" in c.get("/classic", headers=html).text # old dashboard kept
    assert c.get("/healthz", headers=html).json()["ok"] is True


def test_student_items_carry_ids(sysm):
    from fastapi.testclient import TestClient
    from crunchradar.api import create_app
    c = TestClient(create_app(sysm))
    tok = sysm.student_token("a@x.edu")
    d = c.get("/api/student", params={"email": "a@x.edu", "token": tok, "week": 11}).json()
    assert d["due"] and all("id" in x for x in d["due"] + d["marks_per_hour"])


def test_public_summary_is_open_and_only_totals(sysm, monkeypatch):
    from fastapi.testclient import TestClient
    from crunchradar.api import create_app
    monkeypatch.setenv("ADMIN_KEY", "secret")
    c = TestClient(create_app(sysm))
    assert c.get("/api/overview").status_code == 401                       # operator data still protected
    d = c.get("/api/public-summary").json()                                # landing page numbers are public
    assert set(d) == {"limit", "peak", "crunch_weeks", "hidden_tasks", "waiting_for_person", "weeks", "sample_data", "weekly_hours", "weekly_hours_after",
                      "peak_after", "crunch_weeks_after", "illustrated_moves"}
    assert len(d["weekly_hours"]) == 14 and d["peak_after"] < d["peak"] and 1 <= len(d["illustrated_moves"]) <= 4   # a pure illustration, nothing applied
    assert sysm.store.proposals() == []
    assert d["crunch_weeks"] == 3 and round(d["peak"]) == 48 and d["sample_data"] is True


def test_week_detail_for_the_day_overlay(sysm, monkeypatch):
    from fastapi.testclient import TestClient
    from crunchradar.api import create_app
    c = TestClient(create_app(sysm))
    d = c.get("/api/week/11").json()
    assert d["week"] == 11 and round(d["hours"]) == 48 and d["over"] and d["over_by"] > 15
    assert d["starts"] == "2027-03-15" and d["ends"] == "2027-03-21"
    assert d["due"] and all(r["due_week"] == 11 for r in d["due"]) and d["building"] is not None
    assert sum(d["modules"].values()) == pytest.approx(d["hours"], abs=0.6)               # the breakdown adds up to the week total
    assert any(i["kind"] == "crunch" for i in d["issues"])
    assert c.get("/api/week/10").json()["festive_week"] is True and c.get("/api/week/10").json()["holiday"]
    assert c.get("/api/week/1").json()["hours"] == 0 and c.get("/api/week/1").json()["due"] == []
    assert c.get("/api/week/0").status_code == 422 and c.get("/api/week/15").status_code == 422
    monkeypatch.setenv("ADMIN_KEY", "k")
    assert c.get("/api/week/11").status_code == 401                                         # operator data stays protected
