# Demo video script (3 to 4 minutes, target 3:30)

The briefing asks for the problem, the solution, the research, the impact and the agent working. Record in one pass; keep a second take of the live Gemini run in case the first is slow.

Setup before recording: `cd system && rm -f crunchradar.db`, set the key in `system/.env` (use a fresh one), run `python -m crunchradar serve` in one terminal, keep `http://localhost:8000/outbox` open in a browser tab. Close anything with private data.

| Time | Show | Say |
| --- | --- | --- |
| 0:00 to 0:25 | Title slide, then the Week 11 spike in the chart | "Every lecturer sets deadlines for one module and nobody sees the whole cohort. This sample cohort has three weeks above 28 hours, and Week 11 is 48." Say it is sample data. |
| 0:25 to 0:55 | Research slide: the MQA rule and the sensitivity strip | "The ceiling comes from Malaysia's MQA rule: one credit is 40 hours. After classes and revision that is 28 hours a week. The last two numbers are our assumptions and you can change them." |
| 0:55 to 1:35 | Run `python -m crunchradar monday-check` and show the output | "Monday 08:00. The agent reads the calendar feed and the assignment briefs. It found two tasks that were never on the calendar: a demo and a viva, buried in the briefs." Point at the tool calls and the `gemini` mode in the log. |
| 1:35 to 2:05 | The approval email in `/outbox`, then open the link | "It proposes a move the rules allow: never earlier, never a test, never a festive week. Nothing changes until a person decides." Click Approve. |
| 2:05 to 2:35 | The lecturer email; click the decline link | "The lecturer is emailed only after approval. If that date is impossible, one click undoes the move and the agent proposes the next option." |
| 2:35 to 3:00 | Click the same approval link again; then show an old or expired one | "Links work once and expire after 72 hours." |
| 3:00 to 3:20 | Run `python -m crunchradar follow-up` | "Next Monday it checks the calendar feed, reminds the lecturer twice, then escalates. It never claims to have read Moodle." |
| 3:20 to 3:40 | Impact slide: 48 h to 32 h, 3 crunch weeks to 2 | "On the sample cohort: peak week 48 to 32 hours, crunch weeks 3 to 2, two hidden tasks found. Real-cohort numbers are the next step." |
| 3:40 to 4:00 | Final slide | "In Gemini Enterprise the agent calls these rules as tools. We built and tested the policy layer first so the agent can never move a deadline on its own." Do not say the agent is built inside Gemini Enterprise. |

Keep under 4:00. If the live Gemini call is slow, cut to the second take; the run log labels which planner ran, so never hide it.

Say before they ask: the 28 h limit is MQA plus two labelled assumptions; the data is a sample; the calendar is a feed file and email goes to an outbox until real connectors are added.
