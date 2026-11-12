from crunchradar import rules


def test_sample_matches_prototype(sysm):
    sm = sysm.summary()
    assert sm["limit"] == 28
    assert round(sm["peak"]) == 48
    assert sm["crunch_weeks"] == 3
    assert sm["hidden_tasks"] == 2          # demo + viva, found in briefs, not on the calendar


def test_hidden_tasks_found_from_briefs(sysm):
    h = sysm.load_plan()["hidden"]
    assert {(a.mod, a.type, a.due) for a in h} == {("CCP", "presentation", 12), ("FWD", "presentation", 11)}
    assert all(a.parent for a in h)


def test_moves_obey_hard_rules(sysm):
    d = sysm.load_plan()
    for o in rules.suggestions(d["plan"], sysm.s):
        a = next(x for x in d["plan"] if x.id == o["id"])
        assert o["to"] > o["from"] and not a.fixed and not a.hidden           # never earlier, never fixed tests
        assert o["to"] not in sysm.s.avoid_weeks and o["to"] not in sysm.s.protected_weeks
        assert o["to"] - o["from"] <= 2


def test_hidden_task_moves_with_parent(sysm):
    plan = sysm.load_plan()["plan"]
    moved = rules.apply_move(plan, "a2", 12)
    assert next(x for x in moved if x.parent == "a2").due == 13


def test_greedy_approvals_bring_peak_down(sysm):
    plan = sysm.load_plan()["plan"]
    for _ in range(6):
        opts = rules.suggestions(plan, sysm.s)
        if not opts:
            break
        plan = rules.apply_move(plan, opts[0]["id"], opts[0]["to"])
    assert max(rules.loads(plan, 14)) < 40 < 48.3


def test_sensitivity_monotonic(sysm):
    s = sysm.summary()["sensitivity"]
    vals = [s[k] for k in sorted(s)]
    assert vals == sorted(vals, reverse=True)
