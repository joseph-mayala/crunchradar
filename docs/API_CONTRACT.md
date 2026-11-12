# CrunchRadar web app: API contract

Shared by the backend (`system/crunchradar/`) and the frontend (`system/web/`). The existing routes (`/approve/{token}`, `/lecturer/{token}/decline`, `/workflows/*`, `/pulse`, `/summary`, `/runs`, `/proposals`, `/outbox`, `/healthz`) and their server-rendered HTML pages stay working. Everything new lives under `/api` and returns JSON. Errors are `{"detail": "..."}` with the right HTTP status.

## Auth (one operator role plus link-based roles)
- **Operator** (programme leader or team): `POST /api/login {"key": "..."}` sets an HttpOnly cookie `admin_key`; `POST /api/logout` clears it. If env `ADMIN_KEY` is unset the app is open (local mode) and `/api/session` says `auth_required:false`.
- **Link roles** need no login: approval link (programme leader), decline link (lecturer), student link (email + token).
- Operator endpoints below are marked **[op]** and return 401 without the key.

## Endpoints

`GET /api/session` → `{auth_required, authenticated, sample_data, gemini, smtp, limit, weeks, semester_start, holidays: {"3":"Thaipusam (approx.)"}, avoid_weeks:[], protected_weeks:[], cohort:"APD2F2606SE"}`

`GET /api/overview` **[op]** →
```
{limit, peak, crunch_weeks, hidden_tasks, waiting_for_person,
 weekly_hours:[14 numbers], sensitivity:{"24":3,...},
 modules:[{id,name,credits}],
 grid:{"CCP":[14 hours], ...},            // hours per module per week
 issues:[{kind:"crunch|holiday|hidden|feedback", week?, hours?, text}],
 briefs:[{brief, mode:"gemini|rules", note, tasks}]}
```

`GET /api/assessments` **[op]** → `[{id, mod, title, type, weight, words, group, due, fixed, hidden, parent, hours, hours_why:[str], feedback_week, source:"calendar|brief"}]` (the effective plan including approved moves and hidden tasks).

`GET /api/assumptions` **[op]** → `{credits, weeks, slt_per_week, classes_h, revision_h, limit, limit_source:"computed|env", base:{code,report,presentation,test,quiz,logbook}, base_default:{...}, source:{title,url}}`
`PUT /api/assumptions` **[op]** body `{classes_h?, revision_h?, base?}` (validated: 0..40; base 0.5..40) → same shape. Persisted in the database (new `settings` table) and used by every calculation. `POST /api/assumptions/reset` **[op]** restores defaults.

`GET /api/proposals` **[op]** → `[{id, assess_id, mod, title, from_w, to_w, why, status:"pending|approved|rejected|declined|expired", created, expires, decided, decided_by, followup, run_id}]` (never tokens).
`GET /api/runs?limit=50` **[op]** → `[{id, workflow, trigger, started, status, note, mode:"gemini|rules|null", model, detail}]`
`GET /api/outbox?limit=50` **[op]** → `[{id, created, to_addr, cc, subject, body, kind, sent, error}]`

`POST /api/workflows/monday-check` **[op]** → the existing monday_check result. `POST /api/workflows/follow-up` **[op]** → existing result.
`POST /api/pre-publish` **[op]** body `{mod,title,type,weight,words,group,due,brief_text?}` → existing pre_publish result (adds `brief_reader` when `brief_text` is given).
`POST /api/brief-reader` **[op]** body `{text}` → `{tasks:[{title,type,week,words,group,hours,why,source, formula_hours, cohort_hours_that_week, over_limit}], mode, note}`

`GET /api/approve/{token}` → `{status, expired, mod, title, from_w, to_w, why, peak_before, peak_after, expires}` (404 unknown). `POST /api/approve/{token} {"decision":"approve|reject"}` → `{ok, message}`.
`GET /api/lecturer/{token}` → `{status, mod, title, from_w, to_w, expired}`; `POST /api/lecturer/{token}/decline` → `{ok, message}`.

**Student** (link role): `GET /api/student?email=&token=&week=` → `{week, hours, limit, heavy, due:[{mod,title,hours,hidden}], start_now:[{mod,title,due,hours_this_week}], marks_per_hour:[{mod,title,weight,hours,due,mph}], pulse:{count, cohort, share, threshold, mine}}`; `POST /api/pulse {email, token, week}` unchanged; `GET /api/student-link?email=` **[op]** → `{email, token, url}` (so the team can mint links for the demo).

**Extension requests** (new workflow, ported from the prototype's logic): 
`POST /api/extensions` body `{email, token, assess_id, days, reason:"medical|family|workload|other", personal_hours}` (student link) → `{id, status:"pending", draft:{verdict:"approve|decline|refer", days, why:[str]}, pattern:{students_asking?, note?}}` 
`GET /api/extensions` **[op]** → list with draft and status; `POST /api/extensions/{id}/decide` **[op]** `{decision:"approve|override"}` → `{ok, message}`; approving emails the student (outbox/SMTP) and logs a run named "Extension triage". Rules: medical up to 7 days; family up to 5; workload: approve up to 3 days only when the assessment's week is over the limit, otherwise decline; other: refer to the lecturer. The pattern note appears when several students ask about a crunch-week task. Hash the student email like pulse does; never store plain emails.

`GET /api/healthz` → existing healthz plus `{version, scheduler:bool}`.

## Conventions
- All timestamps ISO 8601 UTC. Weeks are 1..14. Hours are numbers rounded to 0.1.
- The data is a sample unless `CALENDAR_ICS` is set; every response that carries numbers is shown with a "Sample data" label by the UI when `sample_data` is true.
- No endpoint can change a deadline except an approved proposal via the approval link flow.
