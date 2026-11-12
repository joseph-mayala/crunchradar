"""Workflow: extension triage. Ported from the prototype's rules (index.html, extResult).

A student asks for more time on one assessment. The rules draft a verdict, the lecturer (operator) approves the draft or overrides it,
and only then is the student emailed. An individual extension never changes the cohort deadline.

The student's email is stored only as a salted hash (same as the pulse) plus a sealed copy, encrypted with a key derived from
APP_SECRET, so the approval email can reach them. The outbox records "student <hash>" instead of the address.
"""
import base64
import hashlib
import hmac
import json
import os

from . import rules

REASONS = ("medical", "family", "workload", "other")
CAPS = {"medical": 7, "family": 5, "workload": 3}
PATTERN_MIN = 3          # this many different students on one crunch-week task = a pattern worth a cohort-wide move


# ---------- sealing the contact address (encrypt-then-MAC, HMAC-SHA256 keystream) ----------
def _keys(secret: str) -> tuple[bytes, bytes]:
    return hashlib.sha256(b"crunchradar-enc:" + secret.encode()).digest(), hashlib.sha256(b"crunchradar-mac:" + secret.encode()).digest()


def _stream(key: bytes, nonce: bytes, n: int) -> bytes:
    out, i = b"", 0
    while len(out) < n:
        out += hmac.new(key, nonce + i.to_bytes(4, "big"), hashlib.sha256).digest()
        i += 1
    return out[:n]


def seal(secret: str, text: str) -> str:
    ek, mk = _keys(secret)
    nonce = os.urandom(16)
    pt = text.encode()
    ct = bytes(a ^ b for a, b in zip(pt, _stream(ek, nonce, len(pt))))
    tag = hmac.new(mk, nonce + ct, hashlib.sha256).digest()[:16]
    return base64.urlsafe_b64encode(nonce + ct + tag).decode()


def unseal(secret: str, blob: str) -> str | None:
    try:
        raw = base64.urlsafe_b64decode(blob.encode())
    except (ValueError, TypeError):
        return None
    if len(raw) < 33:
        return None
    ek, mk = _keys(secret)
    nonce, ct, tag = raw[:16], raw[16:-16], raw[-16:]
    if not hmac.compare_digest(tag, hmac.new(mk, nonce + ct, hashlib.sha256).digest()[:16]):
        return None
    return bytes(a ^ b for a, b in zip(ct, _stream(ek, nonce, len(ct)))).decode()


# ---------- the policy ----------
def draft(reason: str, days: int, week: int, cohort_hours: float, personal_hours: float, limit: float, fixed: bool = False) -> dict:
    """The prototype's rules: medical up to 7 days, family up to 5, workload up to 3 only when the week is over the limit, otherwise refer."""
    load = cohort_hours + personal_hours
    why: list[str] = []
    if fixed:
        verdict, allowed = "refer", 0
        why.append("Test dates are set by the exams unit. The lecturer and exams unit decide.")
    elif reason == "medical":
        verdict, allowed = "approve", min(days, CAPS["medical"])
        why.append("Medical with certificate is covered by policy (up to 7 days).")
    elif reason == "family":
        verdict, allowed = "approve", min(days, CAPS["family"])
        why.append("Family emergency: up to 5 days, evidence to follow within a week.")
    elif reason == "workload":
        if load > limit:
            verdict, allowed = "approve", min(days, CAPS["workload"])
            why.append(f"Week {week} is a crunch week: ~{round(cohort_hours)} h cohort load"
                       f"{f' + {personal_hours:g} h personal commitments' if personal_hours else ''} vs {limit:g} h limit.")
        else:
            verdict, allowed = "decline", 0
            why.append(f"Week {week} is ~{round(load)} h, under the {limit:g} h limit. Suggest starting earlier using the Monday digest.")
    else:
        verdict, allowed = "refer", 0
        why.append("Reason not covered by policy. Needs the lecturer's judgement.")
    if days > allowed > 0:
        why.append(f"Asked for {days} days; policy allows {allowed}.")
    return {"verdict": verdict, "days": allowed, "why": why}


def request(sysm, email: str, token: str, assess_id: str, days: int, reason: str, personal_hours: float) -> tuple[int, dict]:
    """Returns (http_status, body)."""
    if not hmac.compare_digest(sysm.student_token(email), token):
        return 403, {"detail": "Invalid student link."}
    if reason not in REASONS:
        return 422, {"detail": "Unknown reason."}
    if not 1 <= days <= 14 or not 0 <= personal_hours <= 40:
        return 422, {"detail": "days must be 1..14 and personal_hours 0..40."}
    plan = sysm.load_plan()["plan"]
    a = next((x for x in plan if x.id == assess_id), None)
    if not a:
        return 404, {"detail": "Unknown assessment."}
    sid = sysm.student_id(email)
    if sysm.store.has_pending_extension(sid, assess_id):
        return 409, {"detail": "You already have a request waiting for this assessment."}
    total = rules.loads(plan, sysm.s.weeks, sysm.base)
    cohort = total[a.due] if a.due <= sysm.s.weeks else 0.0
    d = draft(reason, days, a.due, cohort, personal_hours, sysm.s.limit, a.fixed)
    allowed = f" {d['days']} day(s)" if d["days"] else ""
    run_id = sysm.store.add_run("Extension triage", "Event · new form response", "Needs review",
                                f"Request on {a.mod} {a.title}, {days} day(s), reason {reason}. Draft: {d['verdict']}{allowed}. Waiting for the lecturer.",
                                {"assess_id": a.id, "verdict": d["verdict"], "days": d["days"], "mode": "rules"})
    ext_id = sysm.store.add_extension({"student": sid, "contact": seal(sysm.s.secret, email.strip()), "assess_id": a.id, "mod": a.mod, "title": a.title,
                                       "due_week": a.due, "days": days, "reason": reason, "personal_hours": personal_hours, "verdict": d["verdict"],
                                       "draft_days": d["days"], "why": d["why"], "run_id": run_id})
    return 200, {"id": ext_id, "status": "pending", "draft": d, "pattern": pattern(sysm, a.id, cohort)}


def pattern(sysm, assess_id: str, cohort_hours: float) -> dict:
    n = sysm.store.extension_students(assess_id)
    out: dict = {"students_asking": n}
    if n >= PATTERN_MIN and cohort_hours > sysm.s.limit:
        out["note"] = f"{n} students asked to extend this same task in a crunch week. Consider moving the deadline for everyone instead (see the crunch radar)."
    return out


def public(sysm, e: dict, cohort: list[float] | None = None) -> dict:
    """What the operator list shows. Never the sealed contact."""
    week = e["due_week"]
    hours = cohort[week] if cohort and week <= sysm.s.weeks else 0.0
    return {"id": e["id"], "student": e["student"][:8], "assess_id": e["assess_id"], "mod": e["mod"], "title": e["title"], "due_week": week, "days": e["days"],
            "reason": e["reason"], "personal_hours": e["personal_hours"], "status": e["status"], "created": e["created"], "decided": e["decided"],
            "decided_by": e["decided_by"], "run_id": e["run_id"], "draft": {"verdict": e["verdict"], "days": e["draft_days"], "why": e["why"]},
            "pattern": pattern(sysm, e["assess_id"], hours)}


def decide(sysm, ext_id: int, decision: str, by: str = "lecturer") -> tuple[int, dict]:
    e = sysm.store.extension(ext_id)
    if not e:
        return 404, {"detail": "Unknown extension request."}
    if e["status"] != "pending":
        return 409, {"detail": f"Already {e['status']}."}
    who = f"student {e['student'][:8]}"
    if decision == "override":
        sysm.store.set_extension_status(ext_id, "overridden", by)
        _close_run(sysm, e, "Overridden; the lecturer will reply to the student directly. Nothing was sent.")
        return 200, {"ok": True, "message": "Overridden. Nothing was sent; reply to the student directly."}
    email = unseal(sysm.s.secret, e["contact"] or "")
    if not email:
        return 409, {"detail": "The student's address cannot be read (the app secret changed). Nothing was sent."}
    days, item = e["draft_days"], f"{e['mod']} {e['title']}"
    first = {"approve": f"Your request for more time on {item} has been approved for {days} day{'s' if days != 1 else ''}. "
                        f"Your new deadline is {days} day{'s' if days != 1 else ''} after the original Week {e['due_week']} deadline. This applies to you only.",
             "decline": f"Your request for more time on {item} has not been approved. The deadline stays in Week {e['due_week']}.",
             "refer": f"Your request for more time on {item} needs a closer look. Your lecturer will reply to you directly."}[e["verdict"]]
    body = "\n\n".join(["Hello,", first, *e["why"], "This decision was drafted by CrunchRadar and approved by your lecturer.", "CrunchRadar"])
    sysm.mailer.send(email, f"Extension request: {item}", body, kind="extension", cc=sysm.s.lecturer_emails.get(e["mod"], f"{e['mod']} lecturer"), record_to=who)
    sysm.store.set_extension_status(ext_id, "approved", by)
    _close_run(sysm, e, f"Draft approved ({e['verdict']}{f' {days} day(s)' if days else ''}); student emailed.")
    return 200, {"ok": True, "message": "Approved. The student has been emailed."}


def _close_run(sysm, e: dict, text: str) -> None:
    r = sysm.store.run(e["run_id"]) if e.get("run_id") else None
    if r:
        sysm.store.update_run(r["id"], "Completed", f"{r['note']} {text}", json.loads(r["detail"] or "{}"))
    else:
        sysm.store.add_run("Extension triage", "Human step · lecturer", "Completed", text)
