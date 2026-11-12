"""HTTP API: the approval page, the data endpoints, and an OpenAPI description a Gemini Enterprise agent can call as a tool."""
import html

import os

from fastapi import Depends, FastAPI, Form, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from .workflows import System


def page(title: str, body: str) -> HTMLResponse:
    return HTMLResponse(f"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>{html.escape(title)}</title>"
                        f"<body style='font:16px system-ui;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5'>{body}</body>")


def create_app(system: System | None = None) -> FastAPI:
    sysm = system or System()
    app = FastAPI(title="CrunchRadar", description="Finds crunch weeks, proposes deadline moves, and waits for a human to approve.", version="0.1.0")

    def cron_auth(x_cron_key: str = Header(default="")):
        key = os.getenv("CRON_KEY", "")
        if key and x_cron_key != key:
            raise HTTPException(401, "Missing or wrong X-Cron-Key")

    if os.getenv("SCHEDULER") == "1":
        from . import scheduler
        scheduler.start(sysm)

    @app.get("/healthz")
    def healthz():
        return {"ok": True, "gemini": bool(sysm.s.gemini_key), "smtp": bool(sysm.s.smtp_host)}

    @app.get("/summary", summary="Weekly hours, limit, issues and sensitivity for the cohort")
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

    @app.get("/runs")
    def runs():
        return sysm.store.runs()

    @app.get("/proposals")
    def proposals():
        return [{k: v for k, v in p.items() if k not in ("token", "lec_token")} for p in sysm.store.proposals()]

    @app.get("/outbox", summary="Every email the system has sent or drafted")
    def outbox():
        return sysm.store.outbox()

    # --- the human step ---
    @app.get("/approve/{token}", response_class=HTMLResponse)
    def approve_page(token: str):
        p = sysm.store.proposal_by_token(token)
        if not p:
            raise HTTPException(404, "Unknown link")
        if p["status"] != "pending":
            return page("Already decided", f"<h2>Already {html.escape(p['status'])}</h2>")
        return page("Approve a deadline move", f"<h2>{html.escape(p['mod'])} {html.escape(p['title'])}</h2><p>Move from <b>Week {p['from_w']}</b> to <b>Week {p['to_w']}</b>.</p>"
                    f"<p>{html.escape(p['why'])}</p><p>Nothing changes until you choose.</p>"
                    f"<form method=post action='/approve/{html.escape(token)}'><button name=decision value=approve style='padding:10px 18px'>Approve</button> "
                    f"<button name=decision value=reject style='padding:10px 18px'>Reject</button></form>")

    @app.post("/approve/{token}", response_class=HTMLResponse)
    def approve_do(token: str, decision: str = Form(...)):
        r = sysm.decide(token, decision == "approve")
        return page("Done" if r["ok"] else "Not applied", f"<h2>{html.escape(r['message'])}</h2>")

    @app.get("/lecturer/{token}/decline", response_class=HTMLResponse)
    def decline_page(token: str):
        p = sysm.store.proposal_by_token(token, "lec_token")
        if not p:
            raise HTTPException(404, "Unknown link")
        return page("Decline a move", f"<h2>{html.escape(p['mod'])} {html.escape(p['title'])}</h2><p>Week {p['to_w']} is not possible?</p>"
                    f"<form method=post action='/lecturer/{html.escape(token)}/decline'><button style='padding:10px 18px'>Yes, this date is not possible</button></form>")

    @app.post("/lecturer/{token}/decline", response_class=HTMLResponse)
    def decline_do(token: str):
        r = sysm.lecturer_decline(token)
        return page("Recorded" if r["ok"] else "Not applied", f"<h2>{html.escape(r['message'])}</h2>")

    class Pulse(BaseModel):
        email: str
        token: str
        week: int

    @app.post("/pulse", summary="A student says a week is too much. One response per student per week.")
    def pulse(p: Pulse):
        return sysm.pulse(p.email, p.token, p.week)

    return app
