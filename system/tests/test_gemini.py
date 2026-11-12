"""Gemini is simulated here: these test the guardrails around it, not the model. The live call is checked by scripts/live_check.py."""
from crunchradar import brief_reader


def fake(script):
    it = iter(script)
    return lambda payload: next(it)


def fc(name, **args):
    return {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {"name": name, "args": args}}]}}]}


def test_agent_uses_tools_and_only_allowed_options(sysm):
    sysm.llm_post = fake([fc("get_overview"), fc("get_options"), fc("request_approval", option=0, explanation="Week 11 is overloaded."), fc("request_approval", option=99, explanation="invented"), fc("finish", summary="done")])
    r = sysm.monday_check()
    assert r["mode"] == "gemini" and len(r["requested"]) == 1                # option 99 was refused by the rules
    assert sysm.store.proposals("pending")[0]["why"] == "Week 11 is overloaded."


def test_agent_falls_back_when_gemini_fails(sysm):
    def boom(payload):
        raise TimeoutError("slow")
    sysm.llm_post = boom
    r = sysm.monday_check()
    assert r["mode"] == "rules" and r["requested"] and "rules planner" in r["summary"]


def test_agent_cannot_exceed_approval_cap(sysm):
    sysm.llm_post = fake([fc("get_options")] + [fc("request_approval", option=i % 3, explanation="x") for i in range(8)] + [fc("finish", summary="")])
    assert len(sysm.monday_check()["requested"]) <= 3


def test_brief_reader_clamps_model_output(sysm):
    out = brief_reader._clamp([{"title": "ok", "type": "report", "week": 5, "hours": 999, "words": -5}, {"title": "bad", "type": "bogus", "week": 5}, {"title": "wk", "type": "code", "week": 40}], 14)
    assert len(out) == 1 and out[0]["hours"] == 60 and out[0]["words"] == 0


def test_brief_reader_no_key_uses_rules(sysm):
    r = brief_reader.read_brief("Each group demos in Week 12. Submit the report in Week 11.", sysm.s)
    assert r["mode"] == "rules" and {t["week"] for t in r["tasks"]} == {11, 12}


def test_brief_readings_are_cached_so_pages_do_not_call_gemini_each_time(sysm, monkeypatch):
    from crunchradar import workflows
    sysm.s.gemini_key = "test-key"
    calls = {"n": 0}

    def fake_read(text, s):
        calls["n"] += 1
        return {"tasks": [], "mode": "gemini", "note": "model x"}
    monkeypatch.setattr(workflows, "read_brief", fake_read)
    sysm.load_plan(); first = calls["n"]
    sysm.load_plan(); sysm.summary()
    assert first > 0 and calls["n"] == first                                      # no further model calls for unchanged briefs


def test_failed_gemini_reading_is_not_retried_on_every_page(sysm, monkeypatch):
    from crunchradar import workflows
    sysm.s.gemini_key = "test-key"
    calls = {"n": 0}

    def failing(text, s):
        calls["n"] += 1
        return {"tasks": [], "mode": "rules", "note": "Gemini failed"}
    monkeypatch.setattr(workflows, "read_brief", failing)
    sysm.load_plan(); first = calls["n"]
    sysm.load_plan()
    assert calls["n"] == first                                                     # backed off for 2 minutes
