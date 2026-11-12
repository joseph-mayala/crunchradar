# Demo script (about 2 minutes, record it as the backup video)

Setup: `cd system && rm -f crunchradar.db`, then `serve`. Keep the outbox tab (`/outbox`) open.

1. **Problem (15 s).** "No lecturer sees the whole cohort's calendar. This cohort has three weeks above 28 hours; Week 11 is 48." Show `crunchradar summary`.
2. **Detect (15 s).** Run `monday-check`. Point out: 2 hidden tasks (a demo and a viva) found in briefs that were never on the calendar, and whether Gemini or the rules planner ran (it is printed).
3. **Propose (15 s).** Show the approval email in the outbox: one move, why, and "Nothing changes until you decide."
4. **Approve (20 s).** Open the link, approve. Show the lecturer email (with the decline link) and the run history.
5. **Reject path (20 s).** Run `monday-check` again, reject the next option. Show that no lecturer email was sent. Then use the lecturer decline link on the approved move: the move is undone and a new proposal appears.
6. **Follow-up (15 s).** Run `follow-up`: the calendar feed still shows the old date, so a reminder goes out. After two reminders it escalates.
7. **Close (20 s).** "Same loop on a real schedule, in Gemini Enterprise on the 17th: the rules become tools, the instructions become the agent, Calendar and Drive are the connectors."

Say before they ask: the 28 h limit is the MQA 40 h per credit rule minus two team assumptions (classes, revision), editable and shown with a sensitivity table. The data is a sample until we get a real cohort export.
