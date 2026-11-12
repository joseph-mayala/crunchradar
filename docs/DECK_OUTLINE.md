# Deck outline (PDF under 10 MB, 9 slides, about 3 minutes)

Built around the briefing's five required points (Problem, Solution, Research, Teamwork, Impact) and how NTT judges. `[FILL]` marks things only the team can supply. Do not invent them.

Style: one idea per slide, a number or a screenshot on every slide, no paragraphs.

---

### 1. Title
**CrunchRadar.** "Spots crunch weeks before students hit them, and fixes them with a human in the loop." Team name, APD2F2606SE, APU Cloud Innovation Hackathon 2026, theme Intelligent Automation & Digital Transformation.

### 2. Problem (Real-world fit)
- Each lecturer sets Moodle deadlines for one module and cannot see the others. Nobody owns the whole cohort's calendar.
- Result: crunch weeks, tasks hidden inside briefs (a demo or viva never on the calendar), deadlines in festive weeks, no time for feedback.
- **Evidence slot:** `[FILL: tasks that landed in last semester's worst week, from a real cohort]` and one quote `[FILL: programme leader or lecturer, with permission]`.
- Until real evidence exists, say "sample cohort" on the slide. Do not present sample numbers as real.

### 3. Research (Research & problem statement)
- The ceiling is not our guess: Malaysia's MQA rule is **1 credit = 40 hours** of student effort. 21 credits x 40 h / 14 weeks = 60 h a week. Minus classes (20 h) and revision (12 h) leaves **28 h** for assignments. The 20 and 12 are our assumptions and are editable.
- Show the sensitivity strip: crunch weeks at 24 / 28 / 32 / 36 h, so the result does not hang on one number.
- Existing tools aggregate deadlines (Workload Radar and Brickfield Assessment Bundle count items, not hours, and propose nothing). Universities write rules against "assessment bunching" (Hertfordshire) and staff check by hand.
- Sources on the slide: MQA guideline, the two marketplace listings, the Hertfordshire page. Not the Leeds quote and not ACSE.

### 4. Solution in one picture (Solution)
The loop, left to right: **Calendar feed + briefs → find crunch weeks (hours vs limit) → propose a move under hard rules → programme leader approves → lecturer emailed → follow-up checks the calendar.** Mark the human step in a different colour. Hard rules in small print: never earlier, never fixed tests, skip festive and revision weeks, feedback rule.

### 5. The agent (Technical depth, Built the right way)
- A Gemini agent calls tools; it cannot invent a move or change a deadline. Tools expose only rule-approved moves, and every change stops at a person.
- Architecture diagram: connectors → rules (tools via MCP and OpenAPI) → agent → approval → email → follow-up.
- Connectors today (1P stand-ins): calendar feed, briefs folder, SMTP. In Gemini Enterprise: Google Calendar and Drive (1P), Outlook (3P).
- Say plainly: **Gemini Enterprise not yet available to us; the agent runs on the Gemini API today and moves to Workflow Builder for the final.**

### 6. It runs on its own (Day-to-day productivity)
- Monday 08:00 check and 08:30 follow-up on a real schedule, with catch-up after downtime.
- Screenshot of the run history with scheduled runs, a paused approval, and the follow-up result `[FILL: capture after the first scheduled run]`.
- Failure handling: if Gemini is down the rules planner runs and the log says so.

### 7. Demo (embed the video or three screenshots)
Detect, propose, approve. Then the reject path and the lecturer decline. Lead with the programme leader's one-click approval, not the architecture. Script: `docs/DEMO_SCRIPT.md`.

### 8. Impact (Real-world fit & impact)
- **Measured on the sample cohort (label it):** peak week 48 h → 32 h after 4 approved moves; crunch weeks 3 → 2; 2 hidden tasks found in briefs. The loop stops at 4 because no further safe move exists, and the remaining weeks are escalated.
- **Expected over 3 to 6 months (targets, not results):** fewer crunch weeks per semester, fewer extension requests and clarification emails, less time spent by programme leaders checking calendars by hand.
- `[FILL: real before/after from a real cohort, staff minutes saved]`.

### 9. Team, safeguards, next steps (Teamwork)
- Who did what: `[FILL: five names and roles]`.
- Safeguards in one line each: single-use expiring approval links; nothing sent before approval; the system never claims to read Moodle, only the calendar feed; the "too much" button is one response per student, hashed, and never moves a deadline.
- Next: connect Calendar and Drive, build the agent in Gemini Enterprise, pilot with one real cohort and one programme leader.

---

## Checks before exporting
- Every number is labelled sample, measured, or target.
- Five criteria each have a slide (fit & impact: 2, 8; research: 3; technical depth: 5; productivity: 6; built the right way: 5).
- No competitor test results, no unchecked claims (Leeds, ACSE), no API keys or private data in screenshots.
- PDF under 10 MB; repo link is HTTPS.
