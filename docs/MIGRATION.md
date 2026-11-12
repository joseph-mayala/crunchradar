# Moving to Gemini Enterprise (17 Nov final)

The system was built so each part has a direct place in Gemini Enterprise. Nothing is thrown away.

| Today (`system/`) | In Gemini Enterprise | Notes |
| --- | --- | --- |
| `rules.py` (limit, hard rules, hour model) | Exposed as tools the agent calls: the OpenAPI at `/openapi.json` (`/summary`, `/workflows/pre-publish`, `/workflows/monday-check`) | Keeps the guardrails in code, so they are testable and the agent cannot talk its way past them |
| `agent.py` instructions (`SYSTEM`) | The agent's plain-English instructions in Workflow Builder | Same text, same five tools |
| Calendar ICS connector | Google Calendar connector (1P) | Moodle exports a calendar feed. Subscribe Google Calendar to it |
| Briefs folder | Google Drive connector (1P) | One file per assessment |
| `Mailer` (SMTP/outbox) | Outlook connector (3P) | Needs an Azure app registration. Fallback: Gmail or SMTP app password |
| Approval link page | Workflow Builder human-in-the-loop "Approval" step | The `proposals` table is the audit trail either way |
| `scheduler.py` | Workflow trigger: Monday 08:00 and 08:30 MYT | |
| Pulse | Google Form + event trigger | One response per student comes from Form sign-in |

## Build order once licences work

1. Today: confirm everyone can open Gemini Enterprise and create an app (location global). Do not wait until the 14th.
2. Deploy `system/` somewhere with a public HTTPS URL (Cloud Run is the natural fit; use Cloud Scheduler with `CRON_KEY` there).
3. Create the app, connect Calendar and Drive, add the system's OpenAPI as a tool, paste the agent instructions, and run the Monday workflow in Preview.
4. Connect Outlook last. If Azure consent is blocked, send through the system's SMTP mailer and say so.
5. Keep Antigravity notes visible: what it generated, what was changed by hand.

## If Enterprise is late

The system already runs the whole loop unattended, so the demo does not depend on the licence. Present it as the working core and show the Enterprise app as the orchestration layer on top.

## The "hand-coded app" concern

The briefing says it does not want an app coded from scratch and wants agents built inside Gemini Enterprise. What we can and cannot do about that:

**What we did (done, tested):**
- There is no hand-built UI to defend. `system/` is headless: rules, connectors and tools. The only pages are the approval and decline pages.
- The rules are exposed as **MCP tools** (`python -m crunchradar mcp`) and as an **OpenAPI** description. An agent built in Gemini Enterprise calls them; it does not need our agent loop. The briefing lists MCP as a bonus.
- `enterprise/` holds the paste-in pack: agent instructions, the OpenAPI, and the MCP tool list. Regenerate with `scripts/export_enterprise_pack.py`.
- No tool can change a deadline. The only write is `request_approval`, which emails a person.

**What we cannot do from here:** build the agent inside Gemini Enterprise without access. Until then, our own agent loop (`agent.py`) is the stand-in and says so in every run log.

**How to say it honestly:** "The agent lives in Gemini Enterprise. What we built is the policy layer it calls: tested rules, connectors and an approval trail, so the agent can never move a deadline on its own. We ran the same agent loop on the Gemini API to prove it works end to end before access arrived."

**Do this today:** ask the organisers (in the help desk) for Gemini Enterprise access or a sandbox date, and check the Google Cloud console for a free trial. Both are one message each. Drafts are in `docs/ORGANISER_QUESTIONS.md`.
