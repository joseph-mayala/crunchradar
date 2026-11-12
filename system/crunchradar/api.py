"""HTTP API: the dashboard and approval pages, the data endpoints, and an OpenAPI description a Gemini Enterprise agent can call as a tool."""
import hmac
import os

from fastapi import Depends, FastAPI, Form, Header, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from . import rules, ui
from .workflows import System


def create_app(system: System | None = None) -> FastAPI:
    sysm = system or System()
    app = FastAPI(title="CrunchRadar", description="Finds crunch weeks, proposes deadline moves, and waits for a human to approve.", version="0.1.0")

    def cron_auth(x_cron_key: str = Header(default="")):
        key = os.getenv("CRON_KEY", "")
        if key and not hmac.compare_digest(x_cron_key, key):
            raise HTTPException(401, "Missing or wrong X-Cron-Key")

    def operator(request: Request, x_admin_key: str = Header(default="")):
        """Operator pages show emails that contain approval links, so they need ADMIN_KEY when the app is not local."""
        key = os.getenv("ADMIN_KEY", "")
        given = x_admin_key or request.query_params.get("key", "") or request.cookies.get("admin_key", "")
        if key and not hmac.compare_digest(given, key):
            raise HTTPException(401, "Operator key required (ADMIN_KEY)")

    if os.getenv("SCHEDULER") == "1":
        from . import scheduler
        scheduler.start(sysm)

    def is_sample() -> bool:
        return not sysm.s.calendar_ics

    @app.get("/healthz")
    def healthz():
        return {"ok": True, "gemini": bool(sysm.s.gemini_key), "smtp": bool(sysm.s.smtp_host), "operator_pages_protected": bool(os.getenv("ADMIN_KEY"))}

    @app.get("/", response_class=HTMLResponse, dependencies=[Depends(operator)])
    def dashboard():
        return ui.dashboard(sysm.summary(), sysm.store.runs(10), sysm.store.proposals(), sysm.store.outbox(8), sysm.s.holidays, is_sample())

    @app.get("/summary", summary="Weekly hours, limit, issues and sensitivity for the cohort", dependencies=[Depends(operator)])
    def summary():
        return sysm.summary()

    @app.post("/workflows/monday-check", summary="Run the Monday crunch check (also fired by the schedule)", dependencies=[Depends(cron_auth)])
    def monday():
        return sysm.monday_check(trigger="Manual · API")

    @app.post("/workflows/follow-up", summary="Confirm approved moves against the calendar feed", dependencies=[Depends(cron_auth)])
    def follow():
        return sysm.follow_up(trigger="Manual · API")

    class Draft(BaseModel):
        mod: str
        title: str = "New assignment"
        type: str
        weight: float = 0
        words: int = 0
        group: bool = False
        due: int
        brief_text: str = ""

    @app.post("/workflows/pre-publish", summary="Check a draft assignment against the cohort's load before it is published")
    def pre(d: Draft):
        return sysm.pre_publish(d.model_dump(exclude={"brief_text"}), d.brief_text)

    @app.get("/runs", dependencies=[Depends(operator)])
    def runs():
        return sysm.store.runs()

    @app.get("/proposals", dependencies=[Depends(operator)])
    def proposals():
        return [{k: v for k, v in p.items() if k not in ("token", "lec_token")} for p in sysm.store.proposals()]

    @app.get("/outbox", summary="Every email the system has sent or drafted", dependencies=[Depends(operator)])
    def outbox():
        return sysm.store.outbox()

    # --- the human step ---
    @app.get("/approve/{token}", response_class=HTMLResponse)
    def approve_page(token: str):
        p = sysm.store.proposal_by_token(token)
        if not p:
            raise HTTPException(404, "Unknown link")
        if p["status"] == "pending" and sysm.store.is_expired(p.get("expires")):
            sysm.store.expire_stale()
            return ui.message_page("Link expired", "This link has expired. The next Monday check will propose the move again if it is still needed.", "grey")
        if p["status"] != "pending":
            return ui.message_page(f"Already {p['status']}", "This link has already been used.", "grey")
        plan = sysm.load_plan()["plan"]
        cur = next((a for a in plan if a.id == p["assess_id"]), None)
        before = after = None
        if cur:
            before = max(rules.loads(plan, sysm.s.weeks))
            after = max(rules.loads(rules.apply_move(plan, p["assess_id"], p["to_w"]), sysm.s.weeks))
        return ui.decision_page(p, before, after, p["expires"].replace("T", " ")[:16] + " UTC")

    @app.post("/approve/{token}", response_class=HTMLResponse)
    def approve_do(token: str, decision: str = Form(...)):
        r = sysm.decide(token, decision == "approve")
        return ui.message_page("Done" if r["ok"] else "Not applied", r["message"], "ok" if r["ok"] else "bad")

    @app.get("/lecturer/{token}/decline", response_class=HTMLResponse)
    def decline_page(token: str):
        p = sysm.store.proposal_by_token(token, "lec_token")
        if not p:
            raise HTTPException(404, "Unknown link")
        if p["status"] != "approved":
            return ui.message_page("Not available", "This move is not currently approved, so there is nothing to decline.", "grey")
        return ui.decline_page(p)

    @app.post("/lecturer/{token}/decline", response_class=HTMLResponse)
    def decline_do(token: str):
        r = sysm.lecturer_decline(token)
        return ui.message_page("Recorded" if r["ok"] else "Not applied", r["message"], "ok" if r["ok"] else "bad")

    class Pulse(BaseModel):
        email: str
        token: str
        week: int

    @app.post("/pulse", summary="A student says a week is too much. One response per student per week.")
    def pulse(p: Pulse):
        return sysm.pulse(p.email, p.token, p.week)

    return app
