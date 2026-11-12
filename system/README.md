# CrunchRadar system

The working system behind the prototype page: a workflow agent that runs on a schedule, reads a calendar feed and assignment briefs, finds crunch weeks (hours against a credit-hour ceiling), proposes deadline moves under hard rules, **stops for a named human**, emails only after approval, and checks afterwards that the change happened.

`index.html` at the repo root is only the demo face. This folder is the system.

## Run it (no keys needed)

```bash
cd system
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m crunchradar summary          # weekly hours, 3 crunch weeks, 2 hidden tasks found in briefs
.venv/bin/python -m crunchradar monday-check     # the agent run: proposals + approval emails (to the outbox)
.venv/bin/python -m crunchradar serve            # API, approval pages, and the real Monday schedule
.venv/bin/python -m pytest                       # 22 tests
```

Open `http://localhost:8000/docs` for the API, `GET /outbox` for the emails, and use the approval link from an `approval-request` email.

## What is real

| Piece | How it works |
| --- | --- |
| Schedule | `serve` with `SCHEDULER=1` fires the Monday 08:00 check and 08:30 follow-up (Malaysia time) with nobody logged in. On scale-to-zero hosts call `POST /workflows/*` from Cloud Scheduler with `X-Cron-Key`. |
| Calendar connector | Reads any ICS feed (URL or file) via `CALENDAR_ICS`. Default is a sample feed, `data/cohort.ics`. |
| Briefs connector | Reads a folder of `<assessment id>.txt` via `BRIEFS_DIR`. |
| Agent | Gemini function calling: it chooses the tools and writes the explanation. Tools only expose what the rules allow, so it cannot invent a move. Without a key, or if Gemini fails or is slow, a rules planner does the same steps and says so in the run log. |
| Guardrails | `rules.py`: never earlier, never fixed tests, no festive or revision weeks, feedback rule, 1–2 week moves, at most 3 approval requests per run, model output clamped. |
| Human step | A single-use link in an email to the programme leader. Rejecting sends nothing. A link works once. Moves are re-validated at approval time. |
| Notification | Lecturer email after approval only, with a decline link. A decline undoes the move and re-runs the check. |
| Follow-up | Re-reads the calendar feed: confirms the new date, reminds twice, then escalates. It only claims what the feed shows, never "Moodle updated". |
| Pulse | "This week is too much": one response per student per week (database key), tokens signed per student, stored hashed, alerts the programme leader at 30% and never moves a deadline. |
| Mail | SMTP if configured, otherwise an outbox that stores every message. |

## What is still sample or not done

- The cohort data is made up (real module names). Point `CALENDAR_ICS` and `BRIEFS_DIR` at a real export to change that.
- Email goes to the outbox until SMTP settings are added. Outlook needs an app password or an Azure registration.
- Student sign-in is a signed link, standing in for APU sign-in.
- Extension triage is not ported yet.
- Base hours per task type are placeholders until a real cohort is surveyed. The 20 h classes and 12 h revision are team assumptions (`CLASSES_H`, `REVISION_H`).
- Gemini Enterprise is not used. See `docs/MIGRATION.md` for how this maps onto it.

## Check the live Gemini path

Put `GEMINI_API_KEY=...` in `system/.env` (gitignored), then:

```bash
.venv/bin/python scripts/live_check.py
```

It runs the brief reader and the agent once and exits non-zero if either fell back to rules, with the reason.
