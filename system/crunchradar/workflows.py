"""The workflows. Each one is a trigger, some steps, and a stop for a human wherever a deadline or decision would change."""
import hashlib
import hmac

from . import rules
from .brief_reader import read_brief
from .config import Settings, get_settings
from .connectors import Mailer, read_briefs, read_calendar
from .models import Assessment
from .store import Store


class System:
    def __init__(self, settings: Settings | None = None, store: Store | None = None, llm_post=None):
        self.s = settings or get_settings()
        self.store = store or Store(self.s.db_path)
        self.mailer = Mailer(self.s, self.store)
        self.llm_post = llm_post          # injectable for tests; None = real Gemini over HTTPS
        self.defaults = {"classes_h": self.s.classes_h, "revision_h": self.s.revision_h}   # env/team assumptions before any operator edit
        self.base = dict(rules.BASE_DEFAULT)
        self.apply_assumptions()

    # ---------- assumptions (operator-editable, persisted in the settings table) ----------
    def apply_assumptions(self) -> None:
        """Load the persisted classes/revision hours and base hours. With nothing saved, the defaults apply unchanged."""
        a = self.store.get_setting("assumptions") or {}
        self.s.classes_h = float(a.get("classes_h", self.defaults["classes_h"]))
        self.s.revision_h = float(a.get("revision_h", self.defaults["revision_h"]))
        self.base = {**rules.BASE_DEFAULT, **{k: float(v) for k, v in (a.get("base") or {}).items() if k in rules.BASE_DEFAULT}}

    def save_assumptions(self, changes: dict) -> None:
        a = self.store.get_setting("assumptions") or {}
        for k in ("classes_h", "revision_h"):
            if changes.get(k) is not None:
                a[k] = float(changes[k])
        if changes.get("base"):
            a["base"] = {**(a.get("base") or {}), **{k: float(v) for k, v in changes["base"].items()}}
        self.store.set_setting("assumptions", a)
        self.apply_assumptions()

    def reset_assumptions(self) -> None:
        self.store.delete_setting("assumptions")
        self.apply_assumptions()

    def student_id(self, email: str) -> str:
        """Salted hash of a student email. Plain emails are never stored."""
        return hashlib.sha256((self.s.secret + email.strip().lower()).encode()).hexdigest()[:16]

    # ---------- plan assembly ----------
    def _read_brief_cached(self, text: str) -> dict:
        """Real Gemini readings are cached by brief text and model. Rules readings are cheap and not stored. A failed Gemini call is not retried
        for 2 minutes, so a slow or busy model cannot make every page wait."""
        import hashlib
        import time
        key = hashlib.sha256(f"{self.s.gemini_model}|{self.s.weeks}|{text}".encode()).hexdigest()[:32]
        hit = self.store.cache_get(key) if self.s.gemini_key else None
        if hit:
            return hit
        if not hasattr(self, "_brief_fail"):
            self._brief_fail = {}
        if self.s.gemini_key and time.monotonic() - self._brief_fail.get(key, -1e9) < 120:
            from .brief_reader import read_with_rules
            return {"tasks": read_with_rules(text, self.s.weeks), "mode": "rules", "note": "Gemini failed recently; used rules"}
        res = read_brief(text, self.s)
        if res["mode"] == "gemini":
            self.store.cache_put(key, res)
        elif self.s.gemini_key:
            self._brief_fail[key] = time.monotonic()
        return res

    def find_hidden(self, items: list[Assessment]) -> tuple[list[Assessment], list[dict]]:
        """Read every brief and add tasks that are in the brief but not on the calendar."""
        notes, hidden = [], []
        by_id = {a.id: a for a in items}
        for aid, text in read_briefs(self.s).items():
            parent = by_id.get(aid)
            if not parent:
                continue
            res = self._read_brief_cached(text)
            notes.append({"brief": aid, "mode": res["mode"], "note": res["note"], "tasks": len(res["tasks"])})
            for n, t in enumerate(res["tasks"]):
                if any(a.mod == parent.mod and a.type == t["type"] and a.due == t["week"] for a in items + hidden):
                    continue  # already on the calendar (including the parent itself)
                hidden.append(Assessment(id=f"{aid}h{n}", mod=parent.mod, title=t["title"][:60], type=t["type"], weight=0, words=t["words"], group=t["group"], due=t["week"],
                                         hidden=f'Brief {aid}: "{t["title"]}"', parent=aid))
        return hidden, notes

    def load_plan(self) -> dict:
        self.apply_assumptions()
        feed = read_calendar(self.s)
        hidden, notes = self.find_hidden(feed)
        plan = feed + hidden
        for p in self.store.proposals("approved"):          # approved moves not yet visible in the feed
            cur = next((a for a in plan if a.id == p["assess_id"]), None)
            if cur and cur.due == p["from_w"]:
                plan = rules.apply_move(plan, p["assess_id"], p["to_w"])
        return {"feed": feed, "plan": plan, "hidden": hidden, "brief_notes": notes}

    def summary(self) -> dict:
        d = self.load_plan()
        tot = rules.loads(d["plan"], self.s.weeks, self.base)
        return {"limit": self.s.limit, "weekly_hours": [round(v, 1) for v in tot[1:]], "peak": round(max(tot), 1), "crunch_weeks": sum(1 for v in tot[1:] if v > self.s.limit),
                "hidden_tasks": len(d["hidden"]), "issues": rules.issues(d["plan"], self.s, self.base), "sensitivity": rules.sensitivity(d["plan"], self.s, base=self.base), "briefs": d["brief_notes"]}

    # ---------- workflow 1: Monday crunch check ----------
    def monday_check(self, trigger: str = "Schedule · Mon 08:00 MYT") -> dict:
        from .agent import Agent
        expired = self.store.expire_stale()
        run_id = self.store.add_run("Monday crunch check", trigger, "Running", "started")
        d = self.load_plan()
        plan = d["plan"]
        opts = rules.suggestions(plan, self.s, self.store.rejected_keys(), base=self.base)
        agent = Agent(self, run_id, plan, opts, llm_post=self.llm_post)
        result = agent.run()
        crunch = sum(1 for v in rules.loads(plan, self.s.weeks, self.base)[1:] if v > self.s.limit)
        self._digest(plan)
        status = "Needs review" if result["requested"] else "Completed"
        note = f"{crunch} crunch week(s). {len(result['requested'])} move(s) sent for approval. Agent: {result['mode']}{' (' + result['model'] + ')' if result['model'] else ''}. {result['summary']}"
        self.store.update_run(run_id, status, note, {"requested": result["requested"], "mode": result["mode"], "tool_calls": result["tool_calls"], "briefs": d["brief_notes"]})
        return {"run_id": run_id, "status": status, "note": note, **result}

    def _digest(self, plan: list[Assessment]) -> None:
        tot = rules.loads(plan, self.s.weeks, self.base)
        lines = [f"Week {w}: ~{round(tot[w])} h of assignment work{' (heavy)' if tot[w] > self.s.limit else ''}" for w in range(1, min(self.s.weeks, 4) + 1)]
        self.mailer.send("APD2F2606SE students", "CrunchRadar: your weeks ahead", "\n".join(lines) + f"\n\nLimit used: {self.s.limit:g} h/week.", kind="digest")

    def request_approval(self, run_id: int, opt: dict, explanation: str) -> dict | None:
        if self.store.has_open(opt["id"], opt["to"]):
            return None
        p = self.store.add_proposal(run_id, opt, explanation, self.s.approval_ttl_hours)
        link = f"{self.s.base_url}/approve/{p['token']}"
        body = (f"{opt['mod']} {opt['title']}: move from Week {opt['from']} to Week {opt['to']}.\n\n{explanation}\n\n"
                f"Nothing changes until you decide.\nApprove or reject: {link}\nThis link works once and expires in {self.s.approval_ttl_hours:g} hours.\n")
        self.mailer.send(self.s.programme_leader_email, f"Approval needed: move {opt['mod']} {opt['title']} to Week {opt['to']}", body, kind="approval-request")
        return p

    def escalate(self, reason: str) -> None:
        self.mailer.send(self.s.programme_leader_email, "CrunchRadar: crunch week needs a bigger decision", reason + "\n\nOptions: merge two small assessments, swap a report for an in-class task, or move a deadline more than 2 weeks.", kind="escalation")

    # ---------- approval (the human step) ----------
    def decide(self, token: str, approve: bool, by: str = "programme leader") -> dict:
        p = self.store.proposal_by_token(token)
        if not p:
            return {"ok": False, "message": "Unknown or expired link."}
        if p["status"] != "pending":
            return {"ok": False, "message": f"Already {p['status']}."}
        if self.store.is_expired(p.get("expires")):
            self.store.expire_stale()
            return {"ok": False, "message": "This link has expired. The next Monday check will propose the move again if it is still needed."}
        if not approve:
            self.store.set_status(p["id"], "rejected", by)
            self.store.add_run("Programme leader rejected a move", "Human step · approval", "Completed", f"{p['mod']} {p['title']} W{p['from_w']}→W{p['to_w']} rejected. Nothing was sent to the lecturer and no date changed.")
            return {"ok": True, "message": "Rejected. Nothing was sent."}
        plan = self.load_plan()["plan"]
        cur = next((a for a in plan if a.id == p["assess_id"]), None)
        if not cur or cur.due != p["from_w"] or not rules.valid_target(cur, p["to_w"], plan, self.s):
            self.store.set_status(p["id"], "rejected", "system: no longer valid")
            return {"ok": False, "message": "This move is no longer valid after other changes. It was cancelled; the next Monday check will propose a new one."}
        before = rules.loads(plan, self.s.weeks, self.base)
        after = rules.loads(rules.apply_move(plan, p["assess_id"], p["to_w"]), self.s.weeks, self.base)
        if rules.excess(after, self.s.limit) >= rules.excess(before, self.s.limit) - 0.5 and cur.due not in self.s.avoid_weeks:
            self.store.set_status(p["id"], "rejected", "system: no longer helps")
            return {"ok": False, "message": "After other approved moves this one no longer reduces the overload, so it was cancelled. The next Monday check will propose a new one."}
        self.store.set_status(p["id"], "approved", by)
        self.store.set_followup(p["id"], "awaiting calendar update")
        self.store.set_lec_expiry(p["id"], self.s.lecturer_ttl_days)
        peak_w = max(range(1, self.s.weeks + 1), key=lambda w: before[w] - after[w])
        body = (f"The programme leader has approved moving {p['mod']} {p['title']} from Week {p['from_w']} to Week {p['to_w']}.\n\n"
                f"Why: Week {peak_w} drops from ~{round(before[peak_w])} h to ~{round(after[peak_w])} h of assignment work for the cohort (limit {self.s.limit:g} h).\n\n"
                f"Please update the deadline in Moodle. CrunchRadar will check the calendar feed on Monday at 08:30.\n"
                f"If this date is not possible, tell us here (link works once, valid {self.s.lecturer_ttl_days:g} days): {self.s.base_url}/lecturer/{p['lec_token']}/decline\n")
        to = self.s.lecturer_emails.get(p["mod"], f"{p['mod']} lecturer")
        self.mailer.send(to, f"CrunchRadar: please move {p['mod']} {p['title']} to Week {p['to_w']}", body, kind="reschedule", cc="Programme leader")
        self.store.add_run("Notification", "Event · approval", "Completed", f"Approved {p['mod']} {p['title']} W{p['from_w']}→W{p['to_w']}; lecturer emailed.", {"proposal": p["id"]})
        return {"ok": True, "message": "Approved. The lecturer has been emailed."}

    def lecturer_decline(self, lec_token: str) -> dict:
        p = self.store.proposal_by_token(lec_token, "lec_token")
        if not p or p["status"] != "approved":
            return {"ok": False, "message": "Unknown link, or the move is not currently approved."}
        if self.store.is_expired(p.get("lec_expires")):
            return {"ok": False, "message": "This decline link has expired. Please reply to the programme leader directly."}
        self.store.set_status(p["id"], "declined", "lecturer")
        self.store.add_run("Lecturer declined a move", "Event · lecturer reply", "Completed", f"{p['mod']} {p['title']} stays in Week {p['from_w']}. Finding the next option.")
        self.mailer.send(self.s.programme_leader_email, f"Lecturer declined: {p['mod']} {p['title']} to Week {p['to_w']}", "The lecturer says this date is not possible. The move is undone and the next option is being proposed.", kind="decline")
        nxt = self.monday_check(trigger="Event · lecturer declined")
        return {"ok": True, "message": "Recorded. The move is undone and the next option has gone to the programme leader.", "next_run": nxt["run_id"]}

    # ---------- workflow 5: follow-up ----------
    def follow_up(self, trigger: str = "Schedule · Mon 08:30 MYT") -> dict:
        """Confirm approved moves against what the calendar feed actually shows. It does not claim to read Moodle itself."""
        feed = {a.id: a for a in read_calendar(self.s)}
        out = []
        for p in self.store.proposals("approved"):
            a = feed.get(p["assess_id"])
            n = int(p["followup"].split(":")[1]) if (p["followup"] or "").startswith("reminded:") else 0
            if a and a.due == p["to_w"]:
                self.store.set_followup(p["id"], "confirmed in calendar feed")
                out.append(f"{p['mod']} {p['title']}: confirmed in Week {p['to_w']}")
            elif n >= 2:
                self.mailer.send(self.s.programme_leader_email, f"CrunchRadar: {p['mod']} {p['title']} still not updated", "Two reminders sent and the calendar feed still shows the old date. Needs your attention.", kind="escalation")
                self.store.set_followup(p["id"], f"escalated after {n} reminders")
                out.append(f"{p['mod']} {p['title']}: escalated")
            elif p["followup"] != "confirmed in calendar feed":
                self.mailer.send(self.s.lecturer_emails.get(p["mod"], f"{p['mod']} lecturer"), f"Reminder: update {p['mod']} {p['title']} to Week {p['to_w']}", "The calendar feed still shows the old date.", kind="reminder")
                self.store.set_followup(p["id"], f"reminded:{n + 1}")
                out.append(f"{p['mod']} {p['title']}: reminder {n + 1} sent")
        status = "Completed"
        rid = self.store.add_run("Follow-up", trigger, status, "; ".join(out) or "No approved moves to check.", {"checked": out})
        return {"run_id": rid, "checked": out}

    # ---------- workflow 2: pre-publish check ----------
    def pre_publish(self, draft: dict, brief_text: str = "") -> dict:
        plan = self.load_plan()["plan"]
        a = Assessment(id="draft", mod=draft["mod"], title=draft.get("title", "New assignment"), type=draft["type"], weight=float(draft.get("weight", 0)), words=int(draft.get("words", 0)), group=bool(draft.get("group")), due=int(draft["due"]))
        before = rules.loads(plan, self.s.weeks, self.base)
        after = rules.loads(plan + [a], self.s.weeks, self.base)
        weeks = list(rules.spread(a, self.base))
        worst = max(weeks, key=lambda w: after[w]) if weeks else a.due
        alts = []
        for t in range(max(2, a.due - 3), min(self.s.weeks, a.due + 3) + 1):
            if t in self.s.avoid_weeks or t in self.s.protected_weeks:
                continue
            tot = rules.loads(plan + [a.with_due(t)], self.s.weeks, self.base)
            alts.append({"week": t, "peak": round(max(tot[w] for w in rules.spread(a.with_due(t), self.base)), 1)})
        alts.sort(key=lambda x: x["peak"])
        problems = []
        if a.type == "report" and not a.words:
            problems.append("No word count.")
        if not a.weight:
            problems.append("Weighting is missing.")
        if a.due in self.s.avoid_weeks:
            problems.append(f"Week {a.due} is {self.s.holidays.get(a.due, 'festive')} week.")
        if a.due in self.s.protected_weeks:
            problems.append("Revision week before finals.")
        res = {"hours": rules.estimate(a, self.base)[0], "why": rules.estimate(a, self.base)[1], "worst_week": worst, "worst_hours": round(after[worst], 1), "before_hours": round(before[worst], 1),
               "over_limit": after[worst] > self.s.limit, "limit": self.s.limit, "lightest_weeks": alts[:3], "brief_problems": problems}
        if brief_text:
            res["brief_reader"] = read_brief(brief_text, self.s)
        self.store.add_run("Pre-publish check", "Manual · API", "Completed", f"{a.mod} {a.title} planned W{a.due}: worst week {worst} at {res['worst_hours']} h.", res)
        return res

    # ---------- workflow 4: "this week is too much" pulse ----------
    def student_token(self, email: str) -> str:
        return hmac.new(self.s.secret.encode(), email.strip().lower().encode(), hashlib.sha256).hexdigest()[:20]

    def pulse(self, email: str, token: str, week: int) -> dict:
        """One response per student per week. Needs a token issued for that email, so anyone can't invent respondents. Stored hashed."""
        if not hmac.compare_digest(self.student_token(email), token):
            return {"ok": False, "message": "Invalid student link."}
        if not 1 <= week <= self.s.weeks:
            return {"ok": False, "message": "Invalid week."}
        sid = self.student_id(email)
        if not self.store.add_pulse(sid, week):
            return {"ok": False, "message": "You already responded for this week."}
        n = self.store.pulse_count(week)
        share = n / self.s.cohort_size
        alerted = False
        if share >= self.s.pulse_threshold and self.store.mark_pulse_alert(week):
            self.mailer.send(self.s.programme_leader_email, f"CrunchRadar: {n} of {self.s.cohort_size} students say Week {week} is too much",
                             "This is a prompt to review the week. No deadline has been changed.", kind="pulse-alert")
            self.store.add_run('"Too much" pulse', "Event · new response", "Completed", f"{n}/{self.s.cohort_size} students flagged Week {week}. Programme leader alerted.")
            alerted = True
        return {"ok": True, "count": n, "share": round(share, 2), "alerted": alerted}
