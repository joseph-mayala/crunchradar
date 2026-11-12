"""The rules engine. Plain code, no AI: these are the guardrails the agent works inside.

Ported from the browser prototype so both give the same numbers (see tests/test_rules.py).
"""
import math
from typing import Iterable

from .config import Settings
from .models import Assessment

BASE_DEFAULT = {"code": 12.0, "report": 8.0, "presentation": 5.0, "test": 6.0, "quiz": 1.5, "logbook": 2.0}  # placeholders until a real cohort is surveyed


def _r1(x: float) -> float:
    return math.floor(x * 10 + 0.5) / 10


def estimate(a: Assessment, base: dict | None = None) -> tuple[float, list[str]]:
    base = base or BASE_DEFAULT
    parts = [f"{a.type} base {base[a.type]:g} h"]
    h = base[a.type]
    if a.words:
        w = a.words / 300
        h += w
        parts.append(f"{a.words:,} words +{w:.1f} h")
    if a.weight:
        w = a.weight * 0.25
        h += w
        parts.append(f"{a.weight:g}% weighting +{w:.1f} h")
    if a.group:
        h = h * 0.75 + 3
        parts.append("group: x0.75 shared, +3 h coordination")
    return _r1(h), parts


def spread(a: Assessment, base: dict | None = None) -> dict[int, float]:
    h = estimate(a, base)[0]
    shares = [0.2, 0.3, 0.5] if h >= 15 else [0.35, 0.65] if h >= 7 else [1.0]
    out: dict[int, float] = {}
    for i, s in enumerate(shares):
        w = a.due - (len(shares) - 1 - i)
        if w >= 1:
            out[w] = out.get(w, 0) + h * s
    return out


def loads(items: Iterable[Assessment], weeks: int = 14, base: dict | None = None) -> list[float]:
    total = [0.0] * (weeks + 1)
    for a in items:
        for w, h in spread(a, base).items():
            if w <= weeks:
                total[w] += h
    return total


def excess(total: list[float], limit: float) -> float:
    return sum(max(0.0, v - limit) for v in total)


def feedback_week(a: Assessment) -> int:
    return a.feedback if a.feedback is not None else a.due + 3


def feedback_issues(items: list[Assessment]) -> list[tuple[Assessment, Assessment]]:
    out = []
    for mod in sorted({a.mod for a in items}):
        lst = sorted((a for a in items if a.mod == mod and not a.hidden and a.type not in ("test", "quiz")), key=lambda a: a.due)
        for a, b in zip(lst, lst[1:]):
            if a.type == b.type and feedback_week(a) > b.due:
                out.append((a, b))
    return out


def apply_move(items: list[Assessment], id_: str, to: int) -> list[Assessment]:
    a = next(x for x in items if x.id == id_)
    d = to - a.due
    return [x.with_due(to) if x.id == id_ else x.with_due(x.due + d) if x.parent == id_ else x for x in items]


def valid_target(a: Assessment, t: int, items: list[Assessment], s: Settings) -> bool:
    """Hard rules. Never earlier, never a fixed test, never a festive or revision week, never worsen feedback."""
    if a.fixed or t <= a.due or t < 2 or t > s.weeks or t in s.avoid_weeks or t in s.protected_weeks:
        return False
    for k in (x for x in items if x.parent == a.id):
        kd = k.due + (t - a.due)
        if kd < 2 or kd > s.weeks or kd in s.protected_weeks or kd in s.avoid_weeks:
            return False
    trial = apply_move(items, a.id, t)
    return len(feedback_issues(trial)) <= len(feedback_issues(items))


def suggestions(items: list[Assessment], s: Settings, rejected: set[str] | None = None, max_n: int = 3, base: dict | None = None) -> list[dict]:
    rejected = rejected or set()
    limit = s.limit
    cur = loads(items, s.weeks, base)
    base_ex = excess(cur, limit)
    holiday_due = any(not a.hidden and not a.fixed and a.due in s.avoid_weeks for a in items)
    if base_ex <= 0.01 and not holiday_due:
        return []
    cands = []
    for a in items:
        if a.fixed or a.hidden:
            continue
        best = None
        for t in (a.due + 1, a.due + 2):
            if f"{a.id}>{t}" in rejected or not valid_target(a, t, items, s):
                continue
            after = loads(apply_move(items, a.id, t), s.weeks, base)
            from_hol = a.due in s.avoid_weeks
            score = excess(after, limit) + abs(t - a.due) * 0.3 - (6 if from_hol else 0)
            helps = excess(after, limit) < base_ex - 0.5 or (from_hol and excess(after, limit) <= base_ex + 0.01)
            if helps and (best is None or score < best["score"]):
                best = {"id": a.id, "mod": a.mod, "title": a.title, "from": a.due, "to": t, "score": score, "before": cur, "after": after, "from_holiday": from_hol}
        if best:
            cands.append(best)
    return sorted(cands, key=lambda c: c["score"])[:max_n]


def issues(items: list[Assessment], s: Settings, base: dict | None = None) -> list[dict]:
    total = loads(items, s.weeks, base)
    out = []
    for w in range(1, s.weeks + 1):
        if total[w] > s.limit:
            out.append({"kind": "crunch", "week": w, "hours": round(total[w]), "text": f"Week {w}: ~{round(total[w])} h of assignment work (limit {s.limit:g} h)"})
    for a in items:
        if a.due in s.avoid_weeks and not a.hidden:
            out.append({"kind": "holiday", "text": f"{a.mod} {a.title} is due in Week {a.due}, {s.holidays.get(a.due, 'festive')} week"})
        if a.hidden:
            out.append({"kind": "hidden", "text": f"Hidden task found: {a.mod} {a.title} (Week {a.due}), not in the calendar feed"})
    for a, b in feedback_issues(items):
        out.append({"kind": "feedback", "text": f"{a.mod}: {b.title} is due Week {b.due}, but feedback on {a.title} only returns Week {feedback_week(a)}"})
    return out


def sensitivity(items: list[Assessment], s: Settings, limits: Iterable[float] = (24, 28, 32, 36)) -> dict[float, int]:
    """How many crunch weeks at different limits. Shows the result is not an artefact of one assumption."""
    t = loads(items, s.weeks)
    return {lim: sum(1 for v in t[1:] if v > lim) for lim in limits}
