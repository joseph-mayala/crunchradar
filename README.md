# CrunchRadar

**Spots crunch weeks before students hit them, and fixes them with a human in the loop.**

APU Cloud Innovation Hackathon 2026 · Theme: Intelligent Automation & Digital Transformation · Team: _[team name]_

![CrunchRadar crunch radar view](docs/screenshot-radar.png)

## The problem

Each lecturer sets deadlines on Moodle for their own module, without seeing the other modules. So a cohort gets 4–5 assignments and tests due in the same week, then nothing for weeks.

- Work quality drops and stress goes up in crunch weeks.
- Hidden tasks (presentations, vivas) are written inside briefs but never appear on the Moodle calendar.
- Deadlines land in festive weeks (Chinese New Year, Hari Raya).
- Students get the next assignment before feedback on the last one comes back.

_[Add our survey results here: e.g. "X% of APD2F2606SE students had 3+ deadlines in one week; average Y hours of lost sleep."]_

## The solution

CrunchRadar measures **hours of work per week**, not just the number of deadlines. It reads each assignment brief, estimates the effort, spreads the work over the weeks before the deadline, and compares the total with a weekly limit.

The limit comes from Malaysia's **Student Learning Time** rule (1 credit = 40 hours of student effort):
21 credits × 40 h = 840 h ≈ 60 h/week, minus ~20 h of classes and ~12 h of revision = **~28 h/week of assignment work**.

When a week goes over the limit, the agent proposes pushing a deadline up to 2 weeks later. It skips festive and revision weeks, never moves fixed test dates, and never breaks the feedback rule. A programme leader approves every move.

## Features

| Feature | Who it helps | What it does |
| --- | --- | --- |
| Crunch radar | Programme leader | Heatmap of hours per module per week, crunch detection, approve/reject deadline moves |
| Hidden task finder | Students | Pulls presentations and vivas out of briefs and counts them |
| Holiday awareness | Everyone | Flags deadlines in festive weeks; protects the revision week before finals |
| Feedback rule | Students | Flags when the next assignment is due before feedback on the last one returns |
| Lecturer pre-check | Lecturers | `@CrunchRadar` checks a draft assignment against the cohort's load and the brief's quality before it is published |
| Monday digest | Students | Weekly email: hours this week, what's due, what to start now |
| Marks per hour | Students | Ranks open tasks by marks earned per hour of work |
| "Too much" button | Students | Anonymous tap; at 30% of the cohort the programme leader is alerted |
| Extension triage | Lecturers | Checks workload and policy, drafts a decision, lecturer approves |
| Follow-up | Programme leader | Checks approved moves actually happened on Moodle |

## How it runs on Gemini Enterprise

| Workflow | Trigger | Steps | Human in the loop |
| --- | --- | --- | --- |
| Monday crunch check | Schedule · Mon 08:00 MYT | Read Moodle calendar (Google Calendar) → read briefs (Google Drive) → Gemini estimates hours + hidden tasks → condition: over limit? | Approval: programme leader → email lecturers (Outlook) |
| Lecturer pre-check | Manual · `@CrunchRadar` | Read draft brief → brief quality check → compare cohort load → reply | — |
| Extension triage | Event · new form response | Read request → check workload → check policy → draft decision | Approval: lecturer → email student |
| "Too much" pulse | Event · new form response | Count taps → condition: ≥ 30%? → alert programme leader | — |
| Follow-up | Schedule · Mon 08:30 MYT | Check approved moves are live → remind lecturer | — |

**Connectors:** Google Calendar, Google Drive, Google Forms (1P) · Microsoft Outlook (3P).

**How we used Antigravity:** _[add: connector setup steps, building and deploying this dashboard to Cloud Run, etc.]_

## Try the prototype

**Live demo: https://joseph-mayala.github.io/crunchradar/**, or download this repo and open `index.html` in any browser. All modules, assessments and holiday dates are **demo data** (holiday dates approximate).

Demo path:
1. **Crunch radar:** 3 crunch weeks, peak 48 h. Approve the proposals and watch the peak fall.
2. **Lecturer pre-check:** check a new Week 11 assignment and see the warning.
3. **Student view:** preview the Monday digest; tap "This week is too much" to trigger the escalation.
4. **Extension requests:** draft a decision and approve it.
5. **Automation runs:** press "Run Monday check now".

## Impact

- Peak weekly workload in the demo cohort: **48 h → 32 h** after 4 approved moves.
- Crunch weeks: **3 → 2**, with the rest escalated with options.
- Fewer extension requests and clarification emails (to be measured).
- _[Add survey-based estimate: staff hours saved, students affected per semester.]_

## Team

| Name | Role |
| --- | --- |
| _[name]_ | Agent builder (Gemini Enterprise workflows) |
| _[name]_ | Connectors and integrations |
| _[name]_ | Research and survey |
| _[name]_ | README, slides and video |
