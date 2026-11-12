import re

from fastapi.testclient import TestClient

from crunchradar.api import create_app


def token_in(body):
    return re.search(r"/approve/([\w-]+)", body).group(1)


def test_monday_check_sends_for_approval_and_changes_nothing(sysm):
    r = sysm.monday_check()
    assert r["status"] == "Needs review" and r["requested"] and r["mode"] == "rules"
    assert sysm.store.proposals("approved") == []            # no deadline moves without a human
    mail = [m for m in sysm.store.outbox() if m["kind"] == "approval-request"]
    assert mail and "Nothing changes until you decide" in mail[0]["body"]


def test_approve_notifies_lecturer_and_overlays_plan(sysm):
    sysm.monday_check()
    p = sysm.store.proposals("pending")[0]
    before = sysm.summary()["peak"]
    assert sysm.decide(p["token"], True)["ok"]
    assert any(m["kind"] == "reschedule" for m in sysm.store.outbox())
    assert sysm.summary()["peak"] <= before
    assert not sysm.decide(p["token"], True)["ok"]           # a link works once


def test_reject_sends_nothing_to_lecturer(sysm):
    sysm.monday_check()
    p = sysm.store.proposals("pending")[0]
    assert sysm.decide(p["token"], False)["ok"]
    assert not any(m["kind"] == "reschedule" for m in sysm.store.outbox())
    assert f"{p['assess_id']}>{p['to_w']}" in sysm.store.rejected_keys()


def test_lecturer_decline_undoes_move_and_reproposes(sysm):
    sysm.monday_check()
    p = sysm.store.proposals("pending")[0]
    sysm.decide(p["token"], True)
    peak_after = sysm.summary()["peak"]
    r = sysm.lecturer_decline(p["lec_token"])
    assert r["ok"] and sysm.store.proposal(p["id"])["status"] == "declined"
    assert sysm.summary()["peak"] >= peak_after
    assert not any(q["assess_id"] == p["assess_id"] and q["to_w"] == p["to_w"] and q["status"] == "pending" for q in sysm.store.proposals())


def test_follow_up_checks_calendar_feed_and_escalates(sysm):
    sysm.monday_check()
    p = sysm.store.proposals("pending")[0]
    sysm.decide(p["token"], True)
    out = [sysm.follow_up() for _ in range(3)]               # feed still shows the old date
    assert "reminder 1" in out[0]["checked"][0] and "reminder 2" in out[1]["checked"][0] and "escalated" in out[2]["checked"][0]


def test_pulse_one_per_student_and_needs_valid_token(sysm):
    assert not sysm.pulse("a@x.edu", "bad", 5)["ok"]
    t = sysm.student_token("a@x.edu")
    assert sysm.pulse("a@x.edu", t, 5)["ok"]
    assert not sysm.pulse("a@x.edu", t, 5)["ok"]              # no double voting
    alerted = False
    for i in range(20):
        e = f"s{i}@x.edu"
        alerted |= sysm.pulse(e, sysm.student_token(e), 5).get("alerted", False)
    assert alerted and sum(1 for m in sysm.store.outbox() if m["kind"] == "pulse-alert") == 1


def test_pre_publish(sysm):
    r = sysm.pre_publish({"mod": "IAC", "type": "report", "weight": 20, "words": 2000, "due": 11})
    assert r["over_limit"] and r["lightest_weeks"][0]["peak"] < r["worst_hours"]


def test_api_approval_page_flow(sysm):
    c = TestClient(create_app(sysm))
    assert c.post("/workflows/monday-check").status_code == 200
    tok = token_in(next(m for m in c.get("/outbox").json() if m["kind"] == "approval-request")["body"])
    assert "Approve" in c.get(f"/approve/{tok}").text
    assert "Approved" in c.post(f"/approve/{tok}", data={"decision": "approve"}).text
    assert all("token" not in p for p in c.get("/proposals").json())     # tokens never leak through the API


def test_scheduler_fires_once_on_monday_morning(sysm, monkeypatch):
    from datetime import datetime, timezone
    from crunchradar import scheduler
    clock = {"t": datetime(2027, 1, 11, 0, 0, tzinfo=timezone.utc)}          # Mon 11 Jan 2027 08:00 MYT
    monkeypatch.setattr("crunchradar.store.now", lambda: clock["t"].isoformat())
    assert scheduler.tick(sysm, clock["t"]) == ["monday_check"]               # 08:00 job only
    assert scheduler.tick(sysm, clock["t"]) == []                             # does not fire twice
    clock["t"] = datetime(2027, 1, 11, 0, 30, tzinfo=timezone.utc)
    assert scheduler.tick(sysm, clock["t"]) == ["follow_up"]
    clock["t"] = datetime(2027, 1, 12, 3, 0, tzinfo=timezone.utc)
    assert scheduler.tick(sysm, clock["t"]) == []                             # Tuesday: nothing


def test_cron_key_protects_workflow_endpoints(sysm, monkeypatch):
    monkeypatch.setenv("CRON_KEY", "k")
    c = TestClient(create_app(sysm))
    assert c.post("/workflows/monday-check").status_code == 401
    assert c.post("/workflows/monday-check", headers={"X-Cron-Key": "k"}).status_code == 200


def test_second_pending_move_is_rechecked_at_approval(sysm):
    """Two proposals made against the same plan must not both be applied blindly."""
    sysm.monday_check()
    ps = sysm.store.proposals("pending")
    assert len(ps) >= 2
    assert sysm.decide(ps[0]["token"], True)["ok"]
    from crunchradar import rules
    before = max(rules.loads(sysm.load_plan()["plan"], 14))
    r = sysm.decide(ps[1]["token"], True)
    after = max(rules.loads(sysm.load_plan()["plan"], 14))
    assert after <= before + 1e-9                           # never made worse
    assert r["ok"] or "no longer" in r["message"]
