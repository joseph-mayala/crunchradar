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


def test_pages_never_wait_on_gemini_and_the_reading_is_cached(sysm, monkeypatch):
    """First load answers from the rules at once while Gemini reads in the background; the saved Gemini reading is used afterwards."""
    from crunchradar import workflows
    sysm.s.gemini_key = "test-key"
    calls = {"n": 0}

    def fake_read(text, s):
        calls["n"] += 1
        return {"tasks": [], "mode": "gemini", "note": "model x"}
    monkeypatch.setattr(workflows, "read_brief", fake_read)
    first = sysm.load_plan()
    assert first["brief_notes"] and all(n["mode"] == "rules" for n in first["brief_notes"])        # immediate rules answer, no waiting
    for t in list(sysm._brief_threads):
        t.join(5)
    done = calls["n"]
    assert done > 0
    second = sysm.load_plan(); sysm.summary()
    assert all(n["mode"] == "gemini" for n in second["brief_notes"]) and calls["n"] == done       # served from the saved reading, no new calls


def test_failed_gemini_reading_is_not_retried_on_every_page(sysm, monkeypatch):
    from crunchradar import workflows
    sysm.s.gemini_key = "test-key"
    calls = {"n": 0}

    def failing(text, s):
        calls["n"] += 1
        return {"tasks": [], "mode": "rules", "note": "Gemini failed"}
    monkeypatch.setattr(workflows, "read_brief", failing)
    sysm.load_plan()
    for t in list(sysm._brief_threads):
        t.join(5)
    first = calls["n"]
    sysm.load_plan()
    for t in list(sysm._brief_threads):
        t.join(5)
    assert first > 0 and calls["n"] == first                                                       # backed off for 2 minutes


def test_model_written_text_cannot_carry_links_into_emails(sysm):
    """A brief could prompt-inject the model into writing a phishing link in the approval email. Links, markup and control characters are stripped."""
    from crunchradar.workflows import clean_model_text
    evil = "Week 11 is heavy. Verify at https://evil.example/login now, or [click here](http://evil.example) or www.evil.example <script>alert(1)</script> or evil.ru/pay\x00"
    out = clean_model_text(evil)
    assert "http" not in out and "www." not in out and "evil." not in out and "<" not in out and "\x00" not in out and "](" not in out
    assert "Week 11 is heavy." in out and len(clean_model_text("x" * 900)) == 400

    opts = [o for o in __import__("crunchradar.rules", fromlist=["x"]).suggestions(sysm.load_plan()["plan"], sysm.s)]
    sysm.request_approval(1, opts[0], evil)
    body = next(m["body"] for m in sysm.store.outbox() if m["kind"] == "approval-request")
    assert "evil" not in body and "/approve/" in body                                   # only our own approval link remains


def test_rate_limited_models_are_retried_after_the_wait_gemini_asks_for(sysm):
    import io, json, urllib.error
    from crunchradar import gemini_client
    sysm.s.gemini_key = "k"
    calls = {"n": 0, "slept": []}
    body = json.dumps({"error": {"details": [{"retryDelay": "7s"}]}}).encode()

    class OK:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self, *a): return json.dumps({"candidates": [{"content": {"parts": [{"text": "hi"}]}}]}).encode()

    def fake_open(req, timeout=None):
        calls["n"] += 1
        if calls["n"] <= len(gemini_client.models_to_try(sysm.s)):                      # the whole first pass is rate limited
            raise urllib.error.HTTPError(req.full_url, 429, "Too Many Requests", {}, io.BytesIO(body))
        return OK()

    out = gemini_client.generate({"contents": []}, sysm.s, 10, sleep=lambda x: calls["slept"].append(x), urlopen=fake_open)
    assert out["candidates"] and calls["slept"] == [7.0]                                  # waited exactly what Gemini asked, then succeeded
