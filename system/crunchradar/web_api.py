"""JSON API for the web app (docs/API_CONTRACT.md). Everything lives under /api.

Operator endpoints need ADMIN_KEY (cookie `admin_key` set by POST /api/login, or the X-Admin-Key header) when it is set.
Link roles (approval, lecturer decline, student) need only their token. No endpoint here can change a deadline:
the only path is an approved proposal through the approval link, which reuses System.decide.
"""
import hmac
import json
import os
import re
from datetime import date, timedelta
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import extensions, rules
from .models import TYPES
from .workflows import System

COHORT = "APD2F2606SE"
MODULES = {"CCP": ("Concurrent Programming", 4), "SWAT": ("Software Architecture and Testing", 4), "FWD": ("Further Web Design", 4),
           "RMCT": ("Research Methods for Computing and Technology", 3), "DSTR": ("Data Structures", 3), "IAC": ("Integrity and Anti-Corruption", 3)}
LIMIT_SOURCE = {"title": "Malaysian Qualifications Framework: 1 credit = 40 notional learning hours", "url": "https://www.mqa.gov.my/"}
_TOKEN_LINK = re.compile(r"(/approve/|/lecturer/)[\w-]+")
_AGENT = re.compile(r"Agent: (gemini|rules)(?: \(([^)]+)\))?")
COOKIE = "admin_key"


def _r1(x: float) -> float:
    return rules._r1(x)


def redact(text: str | None) -> str | None:
    """Approval and decline links are bearer tokens: lists never show them."""
    return _TOKEN_LINK.sub(lambda m: m.group(1) + "[link hidden]", text) if text else text


def _admin_key() -> str:
    return os.getenv("ADMIN_KEY", "")


def _given_key(request: Request) -> str:
    return request.headers.get("x-admin-key", "") or request.cookies.get(COOKIE, "")


def _authenticated(request: Request) -> bool:
    key = _admin_key()
    return not key or hmac.compare_digest(_given_key(request), key)


def operator(request: Request) -> None:
    if not _authenticated(request):
        raise HTTPException(401, "Operator login required")


class Login(BaseModel):
    key: str = Field(max_length=500)


class Assumptions(BaseModel):
    classes_h: float | None = Field(default=None, ge=0, le=40)
    revision_h: float | None = Field(default=None, ge=0, le=40)
    base: dict[str, float] | None = None


class Draft(BaseModel):
    mod: str = Field(max_length=20)
    title: str = Field(default="New assignment", max_length=120)
    type: Literal["code", "report", "presentation", "test", "quiz", "logbook"]
    weight: float = Field(default=0, ge=0, le=100)
    words: int = Field(default=0, ge=0, le=20000)
    group: bool = False
    due: int = Field(ge=1, le=14)
    brief_text: str = Field(default="", max_length=20000)


class BriefText(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class Decision(BaseModel):
    decision: Literal["approve", "reject"]


class Pulse(BaseModel):
    email: str = Field(max_length=200)
    token: str = Field(max_length=100)
    week: int


class ExtensionIn(BaseModel):
    email: str = Field(max_length=200)
    token: str = Field(max_length=100)
    assess_id: str = Field(max_length=40)
    days: int = Field(ge=1, le=14)
    reason: Literal["medical", "family", "workload", "other"]
    personal_hours: float = Field(default=0, ge=0, le=40)


class ExtDecision(BaseModel):
    decision: Literal["approve", "override"]


def register(app: FastAPI, sysm: System) -> None:
    api = APIRouter(prefix="/api", tags=["web app"])
    op = [Depends(operator)]
    s = sysm.s

    def sample() -> bool:
        return not s.calendar_ics

    # ---------- session ----------
    @api.get("/session")
    def session(request: Request):
        sysm.apply_assumptions()
        return {"auth_required": bool(_admin_key()), "authenticated": _authenticated(request), "sample_data": sample(), "gemini": bool(s.gemini_key),
                "smtp": bool(s.smtp_host), "limit": s.limit, "weeks": s.weeks, "semester_start": s.semester_start.isoformat(),
                "holidays": {str(k): v for k, v in s.holidays.items()}, "avoid_weeks": list(s.avoid_weeks), "protected_weeks": list(s.protected_weeks), "cohort": COHORT}

    @api.post("/login")
    def login(body: Login, request: Request, response: Response):
        key = _admin_key()
        if not key:
            return {"ok": True, "auth_required": False}
        if not hmac.compare_digest(body.key, key):
            raise HTTPException(401, "Wrong key")
        response.set_cookie(COOKIE, key, httponly=True, samesite="lax", secure=request.url.scheme == "https", max_age=12 * 3600, path="/")
        return {"ok": True, "auth_required": True}

    @api.post("/logout")
    def logout(response: Response):
        response.delete_cookie(COOKIE, path="/")
        return {"ok": True}

    @api.get("/healthz")
    def healthz():
        return {"ok": True, "gemini": bool(s.gemini_key), "smtp": bool(s.smtp_host), "operator_pages_protected": bool(_admin_key()),
                "version": app.version, "scheduler": os.getenv("SCHEDULER") == "1"}

    @api.get("/public-summary")
    def public_summary():
        """Totals only, for the public landing page. No tokens, no emails, no per-person data."""
        sm = sysm.summary()
        # An illustration for the landing page: what the rules would do if the best fix were approved four times (nothing is applied).
        plan = sysm.load_plan()["plan"]
        cur, moves = plan, []
        for _ in range(4):
            opts = rules.suggestions(cur, s, set(), 1, sysm.base)
            if not opts:
                break
            o = opts[0]
            moves.append({"mod": o["mod"], "title": o["title"], "from": o["from"], "to": o["to"]})
            cur = rules.apply_move(cur, o["id"], o["to"])
        after = rules.loads(cur, s.weeks, sysm.base)
        return {"limit": sm["limit"], "peak": sm["peak"], "crunch_weeks": sm["crunch_weeks"], "hidden_tasks": sm["hidden_tasks"],
                "waiting_for_person": len(sysm.store.proposals("pending")), "weeks": s.weeks, "sample_data": not s.calendar_ics,
                "weekly_hours": sm["weekly_hours"], "weekly_hours_after": [_r1(v) for v in after[1:]], "peak_after": _r1(max(after)),
                "crunch_weeks_after": sum(1 for v in after[1:] if v > s.limit), "illustrated_moves": moves}

    # ---------- operator views ----------
    @api.get("/overview", dependencies=op)
    def overview():
        sm = sysm.summary()
        plan = sysm.load_plan()["plan"]
        mods = sorted({a.mod for a in plan}, key=lambda m: (list(MODULES).index(m) if m in MODULES else 99, m))
        grid = {}
        for m in mods:
            row = [0.0] * (s.weeks + 1)
            for a in plan:
                if a.mod == m:
                    for w, h in rules.spread(a, sysm.base).items():
                        if 1 <= w <= s.weeks:
                            row[w] += h
            grid[m] = [_r1(v) for v in row[1:]]
        return {"limit": sm["limit"], "peak": sm["peak"], "crunch_weeks": sm["crunch_weeks"], "hidden_tasks": sm["hidden_tasks"],
                "waiting_for_person": len(sysm.store.proposals("pending")), "weekly_hours": sm["weekly_hours"],
                "sensitivity": {str(int(k)) if float(k).is_integer() else str(k): v for k, v in sm["sensitivity"].items()},
                "modules": [{"id": m, "name": MODULES.get(m, (m, None))[0], "credits": MODULES.get(m, (m, None))[1]} for m in mods],
                "grid": grid, "issues": sm["issues"], "briefs": sm["briefs"]}

    @api.get("/week/{n}", dependencies=op)
    def week_detail(n: int = Path(ge=1, le=14)):
        """Everything about one week, for the overlay that opens when a date is pressed in the heat grid."""
        plan = sysm.load_plan()["plan"]
        total = rules.loads(plan, s.weeks, sysm.base)
        due, building, mods = [], [], {}
        for a in plan:
            h = rules.spread(a, sysm.base).get(n)
            if not h:
                continue
            row = {"id": a.id, "mod": a.mod, "title": a.title, "type": a.type, "weight": a.weight, "group": a.group, "fixed": a.fixed,
                   "hidden": a.hidden or "", "due_week": a.due, "hours_this_week": _r1(h), "hours_total": rules.estimate(a, sysm.base)[0]}
            (due if a.due == n else building).append(row)
            mods[a.mod] = mods.get(a.mod, 0) + h
        for a in plan:   # fixed tests and quizzes with no spread still belong to the week they fall in
            if a.due == n and not any(r["id"] == a.id for r in due):
                due.append({"id": a.id, "mod": a.mod, "title": a.title, "type": a.type, "weight": a.weight, "group": a.group, "fixed": a.fixed,
                            "hidden": a.hidden or "", "due_week": a.due, "hours_this_week": 0.0, "hours_total": rules.estimate(a, sysm.base)[0]})
        issues = [i for i in rules.issues(plan, s, sysm.base) if i.get("week") == n or (i["kind"] in ("holiday", "hidden") and f"Week {n}" in i["text"])]
        moves = [{"id": p["id"], "mod": p["mod"], "title": p["title"], "from_w": p["from_w"], "to_w": p["to_w"], "status": p["status"]}
                 for p in sysm.store.proposals() if p["status"] in ("pending", "approved") and n in (p["from_w"], p["to_w"])]
        start = s.semester_start + timedelta(days=7 * (n - 1))
        key = lambda r: -r["hours_this_week"]
        return {"week": n, "starts": start.isoformat(), "ends": (start + timedelta(days=6)).isoformat(), "hours": _r1(total[n]), "limit": s.limit,
                "over": total[n] > s.limit, "over_by": _r1(max(0.0, total[n] - s.limit)), "holiday": s.holidays.get(n), "festive_week": n in s.avoid_weeks,
                "revision_week": n in s.protected_weeks, "due": sorted(due, key=key), "building": sorted(building, key=key),
                "modules": {m: _r1(h) for m, h in sorted(mods.items(), key=lambda kv: -kv[1])}, "issues": issues, "moves": moves}

    @api.get("/assessments", dependencies=op)
    def assessments():
        out = []
        for a in sorted(sysm.load_plan()["plan"], key=lambda x: (x.due, x.mod, x.id)):
            h, why = rules.estimate(a, sysm.base)
            out.append({"id": a.id, "mod": a.mod, "title": a.title, "type": a.type, "weight": a.weight, "words": a.words, "group": a.group, "due": a.due,
                        "fixed": a.fixed, "hidden": a.hidden, "parent": a.parent, "hours": h, "hours_why": why, "feedback_week": rules.feedback_week(a),
                        "source": "brief" if a.hidden else "calendar"})
        return out

    def assumptions_out():
        sysm.apply_assumptions()
        return {"credits": s.credits, "weeks": s.weeks, "slt_per_week": _r1(s.slt_per_week), "classes_h": s.classes_h, "revision_h": s.revision_h,
                "limit": s.limit, "limit_source": "env" if os.getenv("LIMIT_HOURS") else "computed", "base": dict(sysm.base),
                "base_default": dict(rules.BASE_DEFAULT), "source": LIMIT_SOURCE}

    @api.get("/assumptions", dependencies=op)
    def get_assumptions():
        return assumptions_out()

    @api.put("/assumptions", dependencies=op)
    def put_assumptions(body: Assumptions):
        for k, v in (body.base or {}).items():
            if k not in TYPES:
                raise HTTPException(422, f"Unknown task type: {k}")
            if not 0.5 <= v <= 40:
                raise HTTPException(422, f"Base hours for {k} must be 0.5..40")
        c = body.classes_h if body.classes_h is not None else s.classes_h
        r = body.revision_h if body.revision_h is not None else s.revision_h
        if not os.getenv("LIMIT_HOURS") and round(s.slt_per_week - c - r) < 1:
            raise HTTPException(422, "Classes plus revision leave no time for assignments (limit would be below 1 h)")
        sysm.save_assumptions(body.model_dump())
        return assumptions_out()

    @api.post("/assumptions/reset", dependencies=op)
    def reset_assumptions():
        sysm.reset_assumptions()
        return assumptions_out()

    @api.get("/proposals", dependencies=op)
    def proposals():
        keep = ("id", "assess_id", "mod", "title", "from_w", "to_w", "why", "status", "created", "expires", "decided", "decided_by", "followup", "run_id")
        sysm.store.expire_stale()
        return [{k: p.get(k) for k in keep} for p in sysm.store.proposals()]

    @api.get("/runs", dependencies=op)
    def runs(limit: int = Query(50, ge=1, le=500)):
        out = []
        for r in sysm.store.runs(limit):
            try:
                detail = json.loads(r["detail"] or "{}")
            except ValueError:
                detail = {}
            m = _AGENT.search(r["note"] or "")
            mode = (m.group(1) if m else None) or (detail.get("mode") if isinstance(detail, dict) else None)
            model = (m.group(2) if m else None) or (detail.get("model") if isinstance(detail, dict) else None)
            out.append({"id": r["id"], "workflow": r["workflow"], "trigger": r["trigger"], "started": r["started"], "status": r["status"], "note": redact(r["note"]),
                        "mode": mode if mode in ("gemini", "rules") else None, "model": model or None, "detail": detail})
        return out

    @api.get("/outbox", dependencies=op)
    def outbox(limit: int = Query(50, ge=1, le=500)):
        return [{"id": m["id"], "created": m["created"], "to_addr": m["to_addr"], "cc": m["cc"], "subject": m["subject"], "body": redact(m["body"]),
                 "kind": m["kind"], "sent": bool(m["sent"]), "error": m["error"]} for m in sysm.store.outbox(limit)]

    # ---------- workflows ----------
    @api.post("/workflows/monday-check", dependencies=op)
    def monday():
        return sysm.monday_check(trigger="Manual · web app")

    @api.post("/workflows/follow-up", dependencies=op)
    def follow():
        return sysm.follow_up(trigger="Manual · web app")

    @api.post("/pre-publish", dependencies=op)
    def pre_publish(d: Draft):
        return sysm.pre_publish(d.model_dump(exclude={"brief_text"}), d.brief_text)

    @api.post("/brief-reader", dependencies=op)
    def brief_reader(body: BriefText):
        from .brief_reader import read_brief
        from .models import Assessment
        res = read_brief(body.text, s)
        plan = sysm.load_plan()["plan"]
        total = rules.loads(plan, s.weeks, sysm.base)
        tasks = []
        for t in res["tasks"]:
            a = Assessment(id="brief", mod="BRIEF", title=t["title"], type=t["type"], words=t["words"], group=t["group"], due=t["week"])
            formula = rules.estimate(a, sysm.base)[0]
            cohort = _r1(total[t["week"]])
            tasks.append({**t, "formula_hours": formula, "cohort_hours_that_week": cohort, "over_limit": cohort + (t["hours"] or formula) > s.limit})
        sysm.store.add_run("Brief reader", "Manual · web app", "Completed", f"{len(tasks)} task(s) found. Reader: {res['mode']}.", {"mode": res["mode"], "note": res["note"], "tasks": len(tasks)})
        return {"tasks": tasks, "mode": res["mode"], "note": res["note"]}

    # ---------- link roles: approval (programme leader) and decline (lecturer) ----------
    @api.get("/approve/{token}")
    def approve_get(token: str):
        p = sysm.store.proposal_by_token(token)
        if not p:
            raise HTTPException(404, "Unknown link")
        expired = sysm.store.is_expired(p.get("expires"))
        if p["status"] == "pending" and expired:
            sysm.store.expire_stale()
            p = sysm.store.proposal(p["id"])
        before = after = None
        if p["status"] == "pending":
            plan = sysm.load_plan()["plan"]
            if any(a.id == p["assess_id"] for a in plan):
                before = _r1(max(rules.loads(plan, s.weeks, sysm.base)))
                after = _r1(max(rules.loads(rules.apply_move(plan, p["assess_id"], p["to_w"]), s.weeks, sysm.base)))
        return {"status": p["status"], "expired": expired, "mod": p["mod"], "title": p["title"], "from_w": p["from_w"], "to_w": p["to_w"], "why": p["why"],
                "peak_before": before, "peak_after": after, "expires": p["expires"]}

    @api.post("/approve/{token}")
    def approve_post(token: str, body: Decision):
        if not sysm.store.proposal_by_token(token):
            raise HTTPException(404, "Unknown link")
        r = sysm.decide(token, body.decision == "approve")
        return {"ok": r["ok"], "message": r["message"]}

    @api.get("/lecturer/{token}")
    def lecturer_get(token: str):
        p = sysm.store.proposal_by_token(token, "lec_token")
        if not p:
            raise HTTPException(404, "Unknown link")
        return {"status": p["status"], "mod": p["mod"], "title": p["title"], "from_w": p["from_w"], "to_w": p["to_w"], "expired": sysm.store.is_expired(p.get("lec_expires"))}

    @api.post("/lecturer/{token}/decline")
    def lecturer_decline(token: str):
        if not sysm.store.proposal_by_token(token, "lec_token"):
            raise HTTPException(404, "Unknown link")
        r = sysm.lecturer_decline(token)
        return {"ok": r["ok"], "message": r["message"]}

    # ---------- student (link role) ----------
    def check_student(email: str, token: str) -> None:
        if not email or not token or not hmac.compare_digest(sysm.student_token(email), token):
            raise HTTPException(403, "Invalid student link")

    def current_week() -> int:
        return max(1, min(s.weeks, (date.today() - s.semester_start).days // 7 + 1))

    @api.get("/student")
    def student(email: str = Query(max_length=200), token: str = Query(max_length=100), week: int | None = Query(None, ge=1, le=14)):
        check_student(email, token)
        w = week or current_week()
        plan = sysm.load_plan()["plan"]
        total = rules.loads(plan, s.weeks, sysm.base)
        est = {a.id: rules.estimate(a, sysm.base)[0] for a in plan}
        due = [{"id": a.id, "mod": a.mod, "title": a.title, "hours": est[a.id], "hidden": bool(a.hidden)} for a in plan if a.due == w]
        start = [{"id": a.id, "mod": a.mod, "title": a.title, "due": a.due, "hours_this_week": _r1(rules.spread(a, sysm.base)[w])}
                 for a in plan if w < a.due <= w + 2 and rules.spread(a, sysm.base).get(w)]
        mph = sorted(({"id": a.id, "mod": a.mod, "title": a.title, "weight": a.weight, "hours": est[a.id], "due": a.due, "mph": round(a.weight / est[a.id], 2)}
                      for a in plan if a.due >= w and a.weight and est[a.id]), key=lambda x: -x["mph"])
        n = sysm.store.pulse_count(w)
        return {"week": w, "hours": _r1(total[w]), "limit": s.limit, "heavy": total[w] > s.limit, "due": due, "start_now": start, "marks_per_hour": mph[:6],
                "pulse": {"count": n, "cohort": s.cohort_size, "share": round(n / s.cohort_size, 2), "threshold": s.pulse_threshold,
                          "mine": sysm.store.has_pulse(sysm.student_id(email), w)}}

    @api.post("/pulse")
    def pulse(p: Pulse):
        return sysm.pulse(p.email, p.token, p.week)

    @api.get("/student-link", dependencies=op)
    def student_link(email: str = Query(min_length=3, max_length=200)):
        if "@" not in email:
            raise HTTPException(422, "Not an email address")
        e = email.strip().lower()
        tok = sysm.student_token(e)
        return {"email": e, "token": tok, "url": f"{s.base_url}/student?email={quote(e)}&token={tok}"}

    # ---------- extension requests ----------
    @api.post("/extensions")
    def ext_request(body: ExtensionIn):
        code, out = extensions.request(sysm, body.email, body.token, body.assess_id, body.days, body.reason, body.personal_hours)
        return out if code == 200 else JSONResponse(out, status_code=code)

    @api.get("/extensions", dependencies=op)
    def ext_list():
        total = rules.loads(sysm.load_plan()["plan"], s.weeks, sysm.base)
        return [extensions.public(sysm, e, total) for e in sysm.store.extensions()]

    @api.post("/extensions/{ext_id}/decide", dependencies=op)
    def ext_decide(ext_id: int, body: ExtDecision):
        code, out = extensions.decide(sysm, ext_id, body.decision)
        return out if code == 200 else JSONResponse(out, status_code=code)

    app.include_router(api)
