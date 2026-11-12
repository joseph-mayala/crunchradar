# Questions we asked the organisers, and their answers

Asked in the hackathon help desk on 12 Nov 2026. Their answers, in the order we asked.

| # | Our question | Their answer | What we did with it |
| --- | --- | --- | --- |
| 1 | Is the 12:00 code freeze on 13 Nov only for the prototype round? If we reach the Top 5, can we keep building between 13 and 17 Nov, including moving our agent into Gemini Enterprise? | Yes. | The freeze applies to this round only. The Gemini Enterprise version is planned for the final (`docs/MIGRATION.md`). |
| 2 | After the freeze, can we still update anything, such as the demo video or the README? | Everything is locked the moment the deadline passes. | Everything was finished and submitted before the deadline. |
| 3 | We have no Gemini Enterprise licences yet. Is there a date, or a sandbox before the 17 Nov final? | They do not control the licences and will announce when they are issued. For now, build with what is available. | The prototype runs on the Gemini API. The tools are ready to paste into an Enterprise agent when access arrives (`system/enterprise/`). |
| 4 | Our rules and approval logic run as a separate service that an agent calls as a tool (API or MCP). Does that count as "built inside Gemini Enterprise"? | If the prototype is sound and simulates a working agentic flow, it will be accepted. | The prototype shows the full flow: scheduled check, agent tool calls, human approval, notification, follow-up. |
| 5 | Is the agent allowed to call an external HTTPS service at the final? Does MCP earn the bonus points the briefing mentions? | As long as these bring value to the project, they will help with the marking. | The rules are exposed both as an OpenAPI service and as MCP tools (`python -m crunchradar mcp`). |
| 6 | Our prototype uses sample data (real module names, made-up assessments). Is that okay for this round? | Yes. Keep it clear and explicit. | "Sample data" is labelled on every screen and slide that shows numbers. The README has a real-versus-sample table. |

Not answered, and still open: the date Gemini Enterprise licences will be issued.
