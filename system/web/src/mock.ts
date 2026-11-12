/**
 * Mock backend, switched on with VITE_MOCK=1. It follows docs/API_CONTRACT.md and
 * runs the same estimate model as the backend so the assumptions panel, approvals
 * and Monday check change the numbers. Sample: peak 48 h in W11, limit 28 h,
 * 3 crunch weeks, 2 hidden tasks.
 *
 * Demo tokens: /approve/demo (pending), /approve/used, /approve/expired,
 * /lecturer/demo/decline, /lecturer/used/decline, /lecturer/expired/decline,
 * /student?email=student@example.edu&token=demo-token (token "bad" is rejected).
 * VITE_MOCK_LOCKED=1 simulates a server started with ADMIN_KEY (operator calls return 401).
 */
import { ApiError } from "./api";
import { BASE_DEFAULT, computedLimit, estimate, loads, spread, type PlanItem } from "./lib/model";
import type {
  ApprovalView,
  Assessment,
  Assumptions,
  AssumptionsUpdate,
  BaseHours,
  BriefTask,
  DeclineView,
  Draft,
  Extension,
  ExtensionDraft,
  ExtensionRequest,
  Issue,
  OutboxMail,
  Overview,
  PrePublishResult,
  Proposal,
  Run,
  Session,
  StudentDigest,
  TaskType,
} from "./types";

const WEEKS = 14;
const SEMESTER_START = "2027-01-04";
const COHORT = "APD2F2606SE";
const COHORT_SIZE = 52;
const HOLIDAYS: Record<string, string> = { "3": "Thaipusam (approx.)", "6": "Chinese New Year", "10": "Hari Raya Aidilfitri (approx.)" };
const AVOID = [6, 10];
const PROTECTED = [14];
const MODULES = [
  { id: "CCP", name: "Concurrent Programming", credits: 4 },
  { id: "SWAT", name: "Software Architecture and Testing", credits: 4 },
  { id: "FWD", name: "Further Web Design", credits: 4 },
  { id: "RMCT", name: "Research Methods for Computing and Technology", credits: 3 },
  { id: "DSTR", name: "Data Structures", credits: 3 },
  { id: "IAC", name: "Integrity and Anti-Corruption", credits: 3 },
];
const CREDITS = MODULES.reduce((s, m) => s + m.credits, 0);
const MQA = {
  title: "MQA Guidelines to Good Practices: Curriculum Design and Delivery (1 credit = 40 notional learning hours)",
  url: "https://www2.mqa.gov.my/qad/v2/garispanduan/2019/GGP%20CDD/4.%20GGP%20-%20Curriculum%20Design%20and%20Delivery_BI%20-%20[FB].pdf",
};

const ORIGINAL: PlanItem[] = [
  { id: "a1", mod: "CCP", title: "Individual assignment", type: "code", weight: 20, words: 0, group: false, due: 5 },
  { id: "a2", mod: "CCP", title: "Group project", type: "code", weight: 40, words: 0, group: true, due: 11 },
  { id: "a2h", mod: "CCP", title: "Project demo", type: "presentation", weight: 0, words: 0, group: true, due: 12, hidden: 'Brief p.3: "Each group demos their system in Week 12."', parent: "a2" },
  { id: "b1", mod: "SWAT", title: "Mid-term test", type: "test", weight: 20, words: 0, group: false, due: 7, fixed: true },
  { id: "b2", mod: "SWAT", title: "Architecture report", type: "report", weight: 30, words: 3000, group: true, due: 11 },
  { id: "c1", mod: "FWD", title: "Lab logbook 1", type: "logbook", weight: 5, words: 0, group: false, due: 4, feedback: 9 },
  { id: "c2", mod: "FWD", title: "Lab logbook 2", type: "logbook", weight: 5, words: 0, group: false, due: 8 },
  { id: "c3", mod: "FWD", title: "Website project", type: "code", weight: 40, words: 0, group: false, due: 10 },
  { id: "c3h", mod: "FWD", title: "Project viva", type: "presentation", weight: 0, words: 0, group: false, due: 11, hidden: 'Brief p.2: "A 10-minute viva follows submission."', parent: "c3" },
  { id: "d1", mod: "RMCT", title: "Research proposal", type: "report", weight: 30, words: 3500, group: false, due: 7 },
  { id: "d2", mod: "RMCT", title: "Group presentation", type: "presentation", weight: 20, words: 0, group: true, due: 12 },
  { id: "e1", mod: "DSTR", title: "Lab test", type: "test", weight: 25, words: 0, group: false, due: 7, fixed: true },
  { id: "e2", mod: "DSTR", title: "Algorithm report", type: "report", weight: 25, words: 2000, group: false, due: 11 },
  { id: "f1", mod: "IAC", title: "Quiz", type: "quiz", weight: 5, words: 0, group: false, due: 3 },
  { id: "f2", mod: "IAC", title: "Mid-term test", type: "test", weight: 20, words: 0, group: false, due: 8, fixed: true },
  { id: "f3", mod: "IAC", title: "Case study essay", type: "report", weight: 15, words: 1500, group: false, due: 11 },
];

const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z");

interface State {
  classes: number;
  revision: number;
  base: BaseHours;
  plan: PlanItem[];
  proposals: (Proposal & { token: string; lec_token: string; lec_expires: string | null })[];
  runs: Run[];
  outbox: OutboxMail[];
  extensions: Extension[];
  pulse: Record<number, { count: number; mine: boolean }>;
  nextId: number;
}

const S: State = {
  classes: 20,
  revision: 12,
  base: { ...BASE_DEFAULT },
  plan: ORIGINAL.map((a) => ({ ...a })),
  proposals: [],
  runs: [],
  outbox: [],
  extensions: [],
  pulse: { 11: { count: 15, mine: false }, 12: { count: 9, mine: false } },
  nextId: 100,
};

const limitNow = () => computedLimit(CREDITS, WEEKS, S.classes, S.revision);
const totals = () => loads(S.plan, WEEKS, S.base, MODULES.map((m) => m.id));
const item = (id: string) => S.plan.find((a) => a.id === id);

function seed() {
  S.proposals = [
    { id: 4, assess_id: "b2", mod: "SWAT", title: "Architecture report", from_w: 11, to_w: 13, why: "Week 11 is severely overloaded at 48.3 hours; moving the SWAT Architecture report to Week 13 reduces this peak to 41.7 hours.", status: "pending", created: iso(-3), expires: iso(69), decided: null, decided_by: null, followup: null, run_id: 7, token: "demo", lec_token: "lec-demo", lec_expires: null },
    { id: 3, assess_id: "a2", mod: "CCP", title: "Group project", from_w: 11, to_w: 13, why: "Moving the CCP group project to Week 13 cuts Week 11 by 9 h.", status: "declined", created: iso(-170), expires: iso(-98), decided: iso(-150), decided_by: "lecturer", followup: null, run_id: 5, token: "used", lec_token: "used", lec_expires: iso(-20) },
    { id: 2, assess_id: "f3", mod: "IAC", title: "Case study essay", from_w: 11, to_w: 12, why: "Week 11 is over the limit; Week 12 has room for a 1,500-word essay.", status: "rejected", created: iso(-172), expires: iso(-100), decided: iso(-160), decided_by: "programme leader", followup: null, run_id: 5, token: "rejected-tok", lec_token: "rejected-lec", lec_expires: null },
    { id: 1, assess_id: "e2", mod: "DSTR", title: "Algorithm report", from_w: 11, to_w: 12, why: "Moves 6 h of report writing out of Week 11.", status: "expired", created: iso(-340), expires: iso(-268), decided: null, decided_by: null, followup: null, run_id: 2, token: "expired", lec_token: "expired", lec_expires: iso(-1) },
  ];
  // A lecturer link that is still valid needs an approved proposal behind it.
  S.proposals.push({ id: 5, assess_id: "d1", mod: "RMCT", title: "Research proposal", from_w: 7, to_w: 8, why: "Week 7 is over the limit with three assessments; Week 8 has room.", status: "approved", created: iso(-30), expires: iso(42), decided: iso(-26), decided_by: "programme leader", followup: "awaiting calendar update", run_id: 6, token: "approved-tok", lec_token: "demo", lec_expires: iso(140) });
  S.runs = [
    { id: 7, workflow: "Monday crunch check", trigger: "Manual · API", started: iso(-3), status: "Needs review", note: "3 crunch week(s). 1 move(s) sent for approval. Agent: gemini (gemini-3-flash-preview). I asked to move the SWAT Architecture report to Week 13 to bring down the Week 11 peak, and escalated the rest to the programme leader.", mode: "gemini", model: "gemini-3-flash-preview", detail: null },
    { id: 6, workflow: "Notification", trigger: "Event · approval", started: iso(-26), status: "Completed", note: "Approved RMCT Research proposal W7→W8; lecturer emailed.", mode: null, model: null, detail: null },
    { id: 5, workflow: "Monday crunch check", trigger: "Schedule · Mon 08:00 MYT", started: iso(-172), status: "Needs review", note: "3 crunch week(s). 2 move(s) sent for approval. Agent: rules. Gemini did not answer in time, so the rules planner chose the moves.", mode: "rules", model: null, detail: null },
    { id: 4, workflow: "Pre-publish check", trigger: "Manual · API", started: iso(-200), status: "Completed", note: "FWD Website project planned W10: worst week 10 at 35.2 h.", mode: null, model: null, detail: null },
    { id: 3, workflow: '"Too much" pulse', trigger: "Event · new response", started: iso(-220), status: "Completed", note: "16/52 students flagged Week 7. Programme leader alerted.", mode: null, model: null, detail: null },
    { id: 2, workflow: "Monday crunch check", trigger: "Schedule · Mon 08:00 MYT", started: iso(-340), status: "Completed", note: "3 crunch week(s). 1 move(s) sent for approval. Agent: gemini (gemini-3-flash-preview).", mode: "gemini", model: "gemini-3-flash-preview", detail: null },
  ];
  S.outbox = [
    { id: 9, created: iso(-3), to_addr: `${COHORT} students`, cc: null, subject: "CrunchRadar: your weeks ahead", body: "Week 1: ~0 h of assignment work\nWeek 2: ~0 h of assignment work\nWeek 3: ~6 h of assignment work\nWeek 4: ~8 h of assignment work\n\nLimit used: 28 h/week.", kind: "digest", sent: false, error: null },
    { id: 8, created: iso(-3), to_addr: "programme.leader@example.edu", cc: null, subject: "CrunchRadar: crunch week needs a bigger decision", body: "Weeks 7 and 10 stay over the limit after the best single move.\n\nOptions: merge two small assessments, swap a report for an in-class task, or move a deadline more than 2 weeks.", kind: "escalation", sent: false, error: null },
    { id: 7, created: iso(-3), to_addr: "programme.leader@example.edu", cc: null, subject: "Approval needed: move SWAT Architecture report to Week 13", body: "SWAT Architecture report: move from Week 11 to Week 13.\n\nWeek 11 is severely overloaded at 48.3 hours; moving the SWAT Architecture report to Week 13 reduces this peak to 41.7 hours.\n\nNothing changes until you decide.\nApprove or reject: http://localhost:8000/approve/••••••\nThis link works once and expires in 72 hours.", kind: "approval-request", sent: false, error: null },
    { id: 6, created: iso(-26), to_addr: "rmct.lecturer@example.edu", cc: "Programme leader", subject: "CrunchRadar: please move RMCT Research proposal to Week 8", body: "The programme leader has approved moving RMCT Research proposal from Week 7 to Week 8.\n\nWhy: Week 7 drops from ~33 h to ~25 h of assignment work for the cohort (limit 28 h).\n\nPlease update the deadline in Moodle. CrunchRadar will check the calendar feed on Monday at 08:30.", kind: "reschedule", sent: false, error: null },
    { id: 5, created: iso(-220), to_addr: "programme.leader@example.edu", cc: null, subject: "CrunchRadar: 16 of 52 students say Week 7 is too much", body: "This is a prompt to review the week. No deadline has been changed.", kind: "pulse-alert", sent: false, error: null },
  ];
  S.extensions = [
    { id: 3, status: "pending", assess_id: "b2", mod: "SWAT", title: "Architecture report", due: 11, days: 3, reason: "workload", personal_hours: 6, created: iso(-5), draft: { verdict: "approve", days: 3, why: ["Week 11 is about 48 h for the cohort, over the 28 h limit.", "Workload requests can get up to 3 days when the week is over the limit."] }, pattern: { students_asking: 4, note: "4 students asked about SWAT Architecture report in a crunch week. Moving the deadline may help more than single extensions." } },
    { id: 2, status: "pending", assess_id: "c2", mod: "FWD", title: "Lab logbook 2", due: 8, days: 2, reason: "workload", personal_hours: 4, created: iso(-30), draft: { verdict: "decline", days: 0, why: ["Week 8 is about 16 h, under the 28 h limit.", "Suggest starting earlier using the Monday digest."] }, pattern: {} },
    { id: 1, status: "approved", assess_id: "d1", mod: "RMCT", title: "Research proposal", due: 7, days: 5, reason: "family", personal_hours: 0, created: iso(-80), decided: iso(-70), draft: { verdict: "approve", days: 5, why: ["Family reasons can get up to 5 days."] }, pattern: {} },
  ];
}
seed();

function overview(): Overview {
  const limit = limitNow();
  const { total, byMod } = totals();
  const issues: Issue[] = [];
  total.forEach((h, i) => {
    if (h > limit) issues.push({ kind: "crunch", week: i + 1, hours: Math.round(h), text: `Week ${i + 1}: ~${Math.round(h)} h of assignment work (limit ${limit} h)` });
  });
  for (const a of S.plan) {
    if (AVOID.includes(a.due) && !a.hidden) issues.push({ kind: "holiday", week: a.due, text: `${a.mod} ${a.title} is due in Week ${a.due}, ${HOLIDAYS[String(a.due)]} week` });
    if (a.hidden) issues.push({ kind: "hidden", week: a.due, text: `Hidden task found: ${a.mod} ${a.title} (Week ${a.due}), not in the calendar feed` });
  }
  const c1 = item("c1");
  const c2 = item("c2");
  if (c1?.feedback && c2 && c2.due < c1.feedback) issues.push({ kind: "feedback", week: c2.due, text: `FWD: ${c2.title} is due Week ${c2.due}, but feedback on ${c1.title} only returns Week ${c1.feedback}` });
  const sensitivity: Record<string, number> = {};
  for (const l of [24, 28, 32, 36]) sensitivity[String(l)] = total.filter((h) => h > l).length;
  return {
    limit,
    peak: Math.max(...total),
    crunch_weeks: total.filter((h) => h > limit).length,
    hidden_tasks: S.plan.filter((a) => a.hidden).length,
    waiting_for_person: S.proposals.filter((p) => p.status === "pending").length + S.extensions.filter((e) => e.status === "pending").length,
    weekly_hours: total,
    sensitivity,
    modules: MODULES,
    grid: byMod,
    issues,
    briefs: [
      { brief: "CCP group project brief", mode: "gemini", note: "model gemini-3-flash-preview", tasks: 3 },
      { brief: "FWD website project brief", mode: "gemini", note: "model gemini-3-flash-preview", tasks: 2 },
      { brief: "SWAT architecture report brief", mode: "rules", note: "Gemini timed out; used rules", tasks: 1 },
    ],
  };
}

function assessments(): Assessment[] {
  return S.plan.map((a) => {
    const e = estimate(a, S.base);
    return {
      id: a.id, mod: a.mod, title: a.title, type: a.type, weight: a.weight, words: a.words, group: a.group, due: a.due,
      fixed: !!a.fixed, hidden: a.hidden ?? null, parent: a.parent ?? null, hours: e.hours, hours_why: e.parts,
      feedback_week: a.feedback ?? null, source: a.hidden ? "brief" : "calendar",
    };
  });
}

function assumptions(): Assumptions {
  return {
    credits: CREDITS, weeks: WEEKS, slt_per_week: Math.round(((CREDITS * 40) / WEEKS) * 10) / 10,
    classes_h: S.classes, revision_h: S.revision, limit: limitNow(), limit_source: "computed",
    base: { ...S.base }, base_default: { ...BASE_DEFAULT }, source: MQA,
  };
}

function inRange(v: unknown, lo: number, hi: number, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) throw new ApiError(422, `${name} must be between ${lo} and ${hi}.`);
  return n;
}

function putAssumptions(b: AssumptionsUpdate) {
  if (b.classes_h !== undefined) S.classes = inRange(b.classes_h, 0, 40, "Classes");
  if (b.revision_h !== undefined) S.revision = inRange(b.revision_h, 0, 40, "Revision");
  if (b.base) for (const [k, v] of Object.entries(b.base)) S.base[k as TaskType] = inRange(v, 0.5, 40, `Base hours for ${k}`);
  return assumptions();
}

function addRun(workflow: string, trigger: string, status: string, note: string, mode: Run["mode"] = null, model: string | null = null): Run {
  const r: Run = { id: ++S.nextId, workflow, trigger, started: iso(0), status, note, mode, model, detail: null };
  S.runs.unshift(r);
  return r;
}
function mail(to_addr: string, subject: string, body: string, kind: string, cc: string | null = null) {
  S.outbox.unshift({ id: ++S.nextId, created: iso(0), to_addr, cc, subject, body, kind, sent: false, error: null });
}

function mondayCheck() {
  const ov = overview();
  const open = S.proposals.some((p) => p.status === "pending");
  const note = `${ov.crunch_weeks} crunch week(s). ${open ? "0 new move(s); one is already waiting for approval" : "0 move(s) sent for approval"}. Agent: gemini (gemini-3-flash-preview).`;
  const r = addRun("Monday crunch check", "Manual · API", open ? "Needs review" : "Completed", note, "gemini", "gemini-3-flash-preview");
  mail(`${COHORT} students`, "CrunchRadar: your weeks ahead", ov.weekly_hours.slice(0, 4).map((h, i) => `Week ${i + 1}: ~${Math.round(h)} h of assignment work`).join("\n") + `\n\nLimit used: ${ov.limit} h/week.`, "digest");
  return { run_id: r.id, status: r.status, note, requested: [], mode: "gemini" as const, model: "gemini-3-flash-preview", summary: "" };
}

function prePublish(d: Draft): PrePublishResult {
  const limit = limitNow();
  const a: PlanItem = { id: "draft", mod: d.mod, title: d.title || "New assignment", type: d.type, weight: Number(d.weight) || 0, words: Number(d.words) || 0, group: !!d.group, due: Number(d.due) };
  const mods = MODULES.map((m) => m.id);
  const before = loads(S.plan, WEEKS, S.base, mods).total;
  const after = loads([...S.plan, a], WEEKS, S.base, mods).total;
  const weeks = Object.keys(spread(a, S.base)).map(Number);
  const worst = weeks.length ? weeks.reduce((b, w) => (after[w - 1] > after[b - 1] ? w : b), weeks[0]) : a.due;
  const alts: { week: number; peak: number }[] = [];
  for (let t = Math.max(2, a.due - 3); t <= Math.min(WEEKS, a.due + 3); t++) {
    if (AVOID.includes(t) || PROTECTED.includes(t)) continue;
    const moved = { ...a, due: t };
    const tot = loads([...S.plan, moved], WEEKS, S.base, mods).total;
    alts.push({ week: t, peak: Math.round(Math.max(...Object.keys(spread(moved, S.base)).map((w) => tot[Number(w) - 1])) * 10) / 10 });
  }
  alts.sort((x, y) => x.peak - y.peak);
  const problems: string[] = [];
  if (a.type === "report" && !a.words) problems.push("No word count.");
  if (!a.weight) problems.push("Weighting is missing.");
  if (AVOID.includes(a.due)) problems.push(`Week ${a.due} is ${HOLIDAYS[String(a.due)]} week.`);
  if (PROTECTED.includes(a.due)) problems.push("Revision week before finals.");
  const e = estimate(a, S.base);
  const res: PrePublishResult = {
    hours: e.hours, why: e.parts, worst_week: worst, worst_hours: after[worst - 1], before_hours: before[worst - 1],
    over_limit: after[worst - 1] > limit, limit, lightest_weeks: alts.slice(0, 3), brief_problems: problems,
  };
  if (d.brief_text) res.brief_reader = briefReader(d.brief_text);
  addRun("Pre-publish check", "Manual · API", "Completed", `${a.mod} ${a.title} planned W${a.due}: worst week ${worst} at ${res.worst_hours} h.`);
  return res;
}

function briefReader(text: string) {
  const limit = limitNow();
  const total = totals().total;
  const found: BriefTask[] = [];
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const kinds: [RegExp, TaskType, string][] = [
    [/\b(viva|demos?|demonstrations?|presentations?|present)\b/i, "presentation", "Presentation"],
    [/\b(report|essay|write-?up|reflection)\b/i, "report", "Report"],
    [/\b(code|program|system|implementation|website|app)\b/i, "code", "Coding task"],
    [/\b(logbook|journal)\b/i, "logbook", "Logbook"],
    [/\b(test|exam)\b/i, "test", "Test"],
    [/\bquiz\b/i, "quiz", "Quiz"],
  ];
  for (const s of sentences) {
    const k = kinds.find(([re]) => re.test(s));
    if (!k) continue;
    const wk = /week\s*(\d{1,2})/i.exec(s);
    const words = /([\d,]{3,6})\s*-?\s*words?/i.exec(s);
    const weight = /(\d{1,2})\s*%/.exec(s);
    const group = /\b(group|team|pairs?)\b/i.test(s);
    const item: PlanItem = { id: "b", mod: "X", title: k[2], type: k[1], weight: weight ? Number(weight[1]) : 0, words: words ? Number(words[1].replace(/,/g, "")) : 0, group, due: wk ? Number(wk[1]) : 0 };
    const f = estimate(item, S.base);
    const modelH = Math.round(f.hours * (k[1] === "presentation" ? 1.6 : 1.2) * 10) / 10;
    const week = wk ? Math.min(Math.max(Number(wk[1]), 1), WEEKS) : null;
    const cohort = week ? Math.round((total[week - 1] + modelH) * 10) / 10 : null;
    found.push({
      title: `${k[2]}${wk ? ` (Week ${week})` : ""}`, type: k[1], week, words: item.words, group, hours: modelH,
      why: `"${s.length > 110 ? `${s.slice(0, 107)}...` : s}"`, source: "brief", formula_hours: f.hours,
      cohort_hours_that_week: cohort, over_limit: cohort !== null && cohort > limit,
    });
  }
  return { tasks: found.slice(0, 6), mode: "gemini" as const, note: "Sample answer from the mock layer, shaped like a Gemini reply." };
}

function approvalView(token: string): ApprovalView {
  const p = S.proposals.find((x) => x.token === token);
  if (!p) throw new ApiError(404, "Unknown link.");
  const mods = MODULES.map((m) => m.id);
  const before = loads(S.plan, WEEKS, S.base, mods).total;
  const moved = S.plan.map((a) => (a.id === p.assess_id ? { ...a, due: p.to_w } : a));
  const after = loads(moved, WEEKS, S.base, mods).total;
  const expired = p.status === "expired" || (p.status === "pending" && !!p.expires && Date.parse(p.expires) < Date.now());
  return { status: p.status, expired, mod: p.mod, title: p.title, from_w: p.from_w, to_w: p.to_w, why: p.why, peak_before: Math.max(...before), peak_after: Math.max(...after), expires: p.expires };
}

function decide(token: string, decision: string) {
  const p = S.proposals.find((x) => x.token === token);
  if (!p) throw new ApiError(404, "Unknown link.");
  if (p.status !== "pending") return { ok: false, message: `Already ${p.status}.` };
  p.decided = iso(0);
  p.decided_by = "programme leader";
  if (decision === "reject") {
    p.status = "rejected";
    addRun("Programme leader rejected a move", "Human step · approval", "Completed", `${p.mod} ${p.title} W${p.from_w}→W${p.to_w} rejected. Nothing was sent to the lecturer and no date changed.`);
    return { ok: true, message: "Rejected. Nothing was sent." };
  }
  p.status = "approved";
  p.followup = "awaiting calendar update";
  const a = item(p.assess_id);
  if (a) a.due = p.to_w;
  mail(`${p.mod.toLowerCase()}.lecturer@example.edu`, `CrunchRadar: please move ${p.mod} ${p.title} to Week ${p.to_w}`, `The programme leader has approved moving ${p.mod} ${p.title} from Week ${p.from_w} to Week ${p.to_w}.`, "reschedule", "Programme leader");
  addRun("Notification", "Event · approval", "Completed", `Approved ${p.mod} ${p.title} W${p.from_w}→W${p.to_w}; lecturer emailed.`);
  return { ok: true, message: "Approved. The lecturer has been emailed." };
}

function lecturerView(token: string): DeclineView {
  const p = S.proposals.find((x) => x.lec_token === token);
  if (!p) throw new ApiError(404, "Unknown link.");
  const expired = !!p.lec_expires && Date.parse(p.lec_expires) < Date.now();
  return { status: p.status, mod: p.mod, title: p.title, from_w: p.from_w, to_w: p.to_w, expired };
}

function decline(token: string) {
  const p = S.proposals.find((x) => x.lec_token === token);
  if (!p || p.status !== "approved") return { ok: false, message: "Unknown link, or the move is not currently approved." };
  if (p.lec_expires && Date.parse(p.lec_expires) < Date.now()) return { ok: false, message: "This decline link has expired. Please reply to the programme leader directly." };
  p.status = "declined";
  p.decided_by = "lecturer";
  const a = item(p.assess_id);
  if (a) a.due = p.from_w;
  addRun("Lecturer declined a move", "Event · lecturer reply", "Completed", `${p.mod} ${p.title} stays in Week ${p.from_w}. Finding the next option.`);
  return { ok: true, message: "Recorded. The move is undone and the next option has gone to the programme leader." };
}

function checkStudent(email: unknown, token: unknown) {
  if (!email || !token || token === "bad") throw new ApiError(403, "Invalid student link.");
}

function student(email: string, token: string, weekParam: string | null): StudentDigest {
  checkStudent(email, token);
  const limit = limitNow();
  const week = weekParam ? inRange(weekParam, 1, WEEKS, "Week") : 11;
  const total = totals().total;
  const due = S.plan.filter((a) => a.due === week).map((a) => ({ id: a.id, mod: a.mod, title: a.title, hours: estimate(a, S.base).hours, hidden: !!a.hidden }));
  const start_now = S.plan
    .filter((a) => a.due > week && spread(a, S.base)[week])
    .map((a) => ({ id: a.id, mod: a.mod, title: a.title, due: a.due, hours_this_week: Math.round(spread(a, S.base)[week] * 10) / 10 }));
  const marks_per_hour = S.plan
    .filter((a) => a.due >= week && a.weight > 0)
    .map((a) => {
      const h = estimate(a, S.base).hours;
      return { id: a.id, mod: a.mod, title: a.title, weight: a.weight, hours: h, due: a.due, mph: Math.round((a.weight / h) * 100) / 100 };
    })
    .sort((x, y) => y.mph - x.mph);
  const p = S.pulse[week] ?? { count: 0, mine: false };
  return {
    week, hours: total[week - 1], limit, heavy: total[week - 1] > limit, due, start_now, marks_per_hour,
    pulse: { count: p.count, cohort: COHORT_SIZE, share: Math.round((p.count / COHORT_SIZE) * 100) / 100, threshold: 0.3, mine: p.mine },
  };
}

function pulse(b: { email: string; token: string; week: number }) {
  checkStudent(b.email, b.token);
  const p = (S.pulse[b.week] ??= { count: 0, mine: false });
  if (p.mine) return { ok: false, message: "You already responded for this week." };
  p.count += 1;
  p.mine = true;
  const share = p.count / COHORT_SIZE;
  const alerted = share >= 0.3 && (p.count - 1) / COHORT_SIZE < 0.3;
  if (alerted) mail("programme.leader@example.edu", `CrunchRadar: ${p.count} of ${COHORT_SIZE} students say Week ${b.week} is too much`, "This is a prompt to review the week. No deadline has been changed.", "pulse-alert");
  return { ok: true, count: p.count, share: Math.round(share * 100) / 100, alerted };
}

function extensionDraft(r: ExtensionRequest): ExtensionDraft {
  const a = item(r.assess_id);
  if (!a) throw new ApiError(404, "Unknown assessment.");
  const limit = limitNow();
  const load = totals().total[a.due - 1];
  const days = Math.max(1, Math.round(Number(r.days) || 1));
  if (r.reason === "medical") return { verdict: "approve", days: Math.min(days, 7), why: [`Medical reasons can get up to 7 days${days > 7 ? "; the request was trimmed to 7" : ""}.`, "A medical certificate is still checked by the lecturer."] };
  if (r.reason === "family") return { verdict: "approve", days: Math.min(days, 5), why: [`Family reasons can get up to 5 days${days > 5 ? "; the request was trimmed to 5" : ""}.`] };
  if (r.reason === "workload") {
    if (load > limit) return { verdict: "approve", days: Math.min(days, 3), why: [`Week ${a.due} is about ${Math.round(load)} h for the cohort, over the ${limit} h limit.`, "Workload requests can get up to 3 days when the week is over the limit."] };
    return { verdict: "decline", days: 0, why: [`Week ${a.due} is about ${Math.round(load)} h, under the ${limit} h limit.`, "Suggest starting earlier using the Monday digest."] };
  }
  return { verdict: "refer", days: 0, why: ["This reason is not covered by the policy, so the lecturer decides."] };
}

function createExtension(r: ExtensionRequest) {
  checkStudent(r.email, r.token);
  const a = item(r.assess_id);
  if (!a) throw new ApiError(404, "Unknown assessment.");
  const draft = extensionDraft(r);
  const others = S.extensions.filter((e) => e.assess_id === r.assess_id).length + 1;
  const crunch = totals().total[a.due - 1] > limitNow();
  const pattern = crunch && others >= 3 ? { students_asking: others, note: `${others} students asked about ${a.mod} ${a.title} in a crunch week. Moving the deadline may help more than single extensions.` } : {};
  const e: Extension = { id: ++S.nextId, status: "pending", assess_id: a.id, mod: a.mod, title: a.title, due: a.due, days: r.days, reason: r.reason, personal_hours: r.personal_hours, created: iso(0), draft, pattern };
  S.extensions.unshift(e);
  addRun("Extension triage", "Event · new form response", "Needs review", `Request on ${a.mod} ${a.title}, ${r.days} days. Draft: ${draft.verdict}.`);
  return { id: e.id, status: "pending" as const, draft, pattern };
}

function decideExtension(id: number, decision: string) {
  const e = S.extensions.find((x) => x.id === id);
  if (!e) throw new ApiError(404, "Unknown request.");
  if (e.status !== "pending") return { ok: false, message: `Already ${e.status}.` };
  e.status = decision === "approve" ? "approved" : "overridden";
  e.decided = iso(0);
  if (decision === "approve") mail("student (hashed, link only)", `Extension request: ${e.mod} ${e.title}`, `Your request was decided: ${e.draft.verdict}${e.draft.days ? `, ${e.draft.days} days` : ""}.\n\n${e.draft.why.join("\n")}`, "extension");
  addRun("Extension triage", "Human step · operator", "Completed", `${e.mod} ${e.title}: ${decision === "approve" ? "draft approved, student emailed" : "draft overridden, nothing sent"}.`);
  return { ok: true, message: decision === "approve" ? "Approved. The student has been emailed." : "Overridden. Nothing was sent to the student." };
}

const MOCK_LOCKED = import.meta.env.VITE_MOCK_LOCKED === "1";
const OPERATOR = /^\/api\/(overview|assessments|assumptions|proposals|runs|outbox|workflows|pre-publish|brief-reader|student-link|extensions$|extensions\/)/;

function session(): Session {
  return {
    auth_required: MOCK_LOCKED, authenticated: !MOCK_LOCKED, sample_data: true, gemini: true, smtp: false,
    limit: limitNow(), weeks: WEEKS, semester_start: SEMESTER_START, holidays: HOLIDAYS, avoid_weeks: AVOID, protected_weeks: PROTECTED, cohort: COHORT,
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export async function mockRequest(method: string, url: string, body?: unknown): Promise<unknown> {
  await delay(180 + Math.random() * 160);
  const u = new URL(url, "http://mock.local");
  const path = u.pathname;
  const b = (body ?? {}) as Record<string, unknown>;
  const isOperatorCall = OPERATOR.test(path) && !(method === "POST" && path === "/api/extensions");
  if (MOCK_LOCKED && isOperatorCall) throw new ApiError(401, "Operator key required.");
  const R = (): unknown => {
    let m: RegExpExecArray | null;
    if (path === "/api/session") return session();
    if (path === "/api/public-summary") {
      const ov = overview();
      return { limit: ov.limit, peak: ov.peak, crunch_weeks: ov.crunch_weeks, hidden_tasks: ov.hidden_tasks, waiting_for_person: S.proposals.filter((p) => p.status === "pending").length, weeks: WEEKS, sample_data: true };
    }
    if (path === "/api/overview") return overview();
    if (path === "/api/assessments") return assessments();
    if (path === "/api/assumptions" && method === "GET") return assumptions();
    if (path === "/api/assumptions" && method === "PUT") return putAssumptions(b as AssumptionsUpdate);
    if (path === "/api/assumptions/reset") {
      S.classes = 20;
      S.revision = 12;
      S.base = { ...BASE_DEFAULT };
      return assumptions();
    }
    if (path === "/api/proposals") return S.proposals.map(({ token: _t, lec_token: _l, lec_expires: _e, ...p }) => p);
    if (path === "/api/runs") return S.runs.slice(0, Number(u.searchParams.get("limit") ?? 50));
    if (path === "/api/outbox") return S.outbox.slice(0, Number(u.searchParams.get("limit") ?? 50));
    if (path === "/api/workflows/monday-check") return mondayCheck();
    if (path === "/api/workflows/follow-up") return { run_id: addRun("Follow-up", "Manual · API", "Completed", "RMCT Research proposal: reminder 1 sent").id, checked: ["RMCT Research proposal: reminder 1 sent"] };
    if (path === "/api/pre-publish") return prePublish(b as unknown as Draft);
    if (path === "/api/brief-reader") return briefReader(String(b.text ?? ""));
    if ((m = /^\/api\/approve\/([^/]+)$/.exec(path))) return method === "GET" ? approvalView(decodeURIComponent(m[1])) : decide(decodeURIComponent(m[1]), String(b.decision));
    if ((m = /^\/api\/lecturer\/([^/]+)\/decline$/.exec(path))) return decline(decodeURIComponent(m[1]));
    if ((m = /^\/api\/lecturer\/([^/]+)$/.exec(path))) return lecturerView(decodeURIComponent(m[1]));
    if (path === "/api/student") return student(u.searchParams.get("email") ?? "", u.searchParams.get("token") ?? "", u.searchParams.get("week"));
    if (path === "/api/pulse") return pulse(b as { email: string; token: string; week: number });
    if (path === "/api/student-link") {
      const email = u.searchParams.get("email") ?? "student@example.edu";
      return { email, token: "demo-token", url: `/student?email=${encodeURIComponent(email)}&token=demo-token` };
    }
    if (path === "/api/extensions" && method === "POST") return createExtension(b as unknown as ExtensionRequest);
    if (path === "/api/extensions") return S.extensions;
    if ((m = /^\/api\/extensions\/(\d+)\/decide$/.exec(path))) return decideExtension(Number(m[1]), String(b.decision));
    if (path === "/api/healthz") return { ok: true, version: "mock", scheduler: false };
    throw new ApiError(404, "Not found.");
  };
  return clone(R());
}
