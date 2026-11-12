// Types taken from docs/API_CONTRACT.md. Fields marked "not in contract" are
// optional extras the UI uses when present and degrades without.

export type Mode = "gemini" | "rules";
export type TaskType = "code" | "report" | "presentation" | "test" | "quiz" | "logbook";

export interface Session {
  auth_required: boolean;
  authenticated: boolean;
  sample_data: boolean;
  gemini: boolean;
  smtp: boolean;
  limit: number;
  weeks: number;
  semester_start: string; // ISO date of Monday, week 1
  holidays: Record<string, string>;
  avoid_weeks: number[];
  protected_weeks: number[];
  cohort: string;
}

export interface PublicSummary {
  limit: number;
  peak: number;
  crunch_weeks: number;
  hidden_tasks: number;
  waiting_for_person: number;
  weeks: number;
  sample_data: boolean;
  /** Hours per week today, one number per teaching week. Optional: older servers do not send it. */
  weekly_hours?: number[];
  /** Hours per week if the best allowed move were approved four times in a row. */
  weekly_hours_after?: number[];
  peak_after?: number;
  crunch_weeks_after?: number;
  /** The moves behind weekly_hours_after, in the order they were applied. */
  illustrated_moves?: IllustratedMove[];
}

export interface IllustratedMove {
  mod: string;
  title: string;
  from: number;
  to: number;
}

export interface Module {
  id: string;
  name: string;
  credits: number;
}

export type IssueKind = "crunch" | "holiday" | "hidden" | "feedback";
export interface Issue {
  kind: IssueKind;
  week?: number;
  hours?: number;
  text: string;
}

export interface BriefNote {
  brief: string;
  mode: Mode;
  note: string;
  tasks: number;
}

export interface Overview {
  limit: number;
  peak: number;
  crunch_weeks: number;
  hidden_tasks: number;
  waiting_for_person: number;
  weekly_hours: number[];
  sensitivity: Record<string, number>;
  modules: Module[];
  grid: Record<string, number[]>;
  issues: Issue[];
  briefs: BriefNote[];
}

export interface Assessment {
  id: string;
  mod: string;
  title: string;
  type: TaskType;
  weight: number;
  words: number;
  group: boolean;
  due: number;
  fixed: boolean;
  hidden: string | boolean | null;
  parent: string | null;
  hours: number;
  hours_why: string[];
  feedback_week: number | null;
  source: "calendar" | "brief";
}

export type BaseHours = Record<TaskType, number>;

export interface Assumptions {
  credits: number;
  weeks: number;
  slt_per_week: number;
  classes_h: number;
  revision_h: number;
  limit: number;
  limit_source: "computed" | "env";
  base: BaseHours;
  base_default: BaseHours;
  source: { title: string; url: string };
}

export interface AssumptionsUpdate {
  classes_h?: number;
  revision_h?: number;
  base?: Partial<BaseHours>;
}

export type ProposalStatus = "pending" | "approved" | "rejected" | "declined" | "expired";
export interface Proposal {
  id: number;
  assess_id: string;
  mod: string;
  title: string;
  from_w: number;
  to_w: number;
  why: string;
  status: ProposalStatus;
  created: string;
  expires: string | null;
  decided: string | null;
  decided_by: string | null;
  followup: string | null;
  run_id: number | null;
}

export interface Run {
  id: number;
  workflow: string;
  trigger: string;
  started: string;
  status: string;
  note: string;
  mode: Mode | null;
  model: string | null;
  detail: unknown;
}

export interface OutboxMail {
  id: number;
  created: string;
  to_addr: string;
  cc: string | null;
  subject: string;
  body: string;
  kind: string;
  sent: boolean | number;
  error: string | null;
}

export interface MondayCheckResult {
  run_id: number;
  status: string;
  note: string;
  requested?: unknown[];
  mode?: Mode;
  model?: string | null;
  summary?: string;
}

export interface Draft {
  mod: string;
  title: string;
  type: TaskType;
  weight: number;
  words: number;
  group: boolean;
  due: number;
  brief_text?: string;
}

export interface BriefTask {
  title: string;
  type: TaskType | string;
  week: number | null;
  words: number;
  group: boolean;
  hours: number;
  why: string | string[];
  source: string;
  formula_hours: number;
  cohort_hours_that_week: number | null;
  over_limit: boolean;
}

export interface BriefReaderResult {
  tasks: BriefTask[];
  mode: Mode;
  note: string;
}

export interface PrePublishResult {
  hours: number;
  why: string[];
  worst_week: number;
  worst_hours: number;
  before_hours: number;
  over_limit: boolean;
  limit: number;
  lightest_weeks: { week: number; peak: number }[];
  brief_problems: string[];
  brief_reader?: BriefReaderResult;
}

export interface ApprovalView {
  status: ProposalStatus;
  expired: boolean;
  mod: string;
  title: string;
  from_w: number;
  to_w: number;
  why: string;
  peak_before: number | null;   // null once the link has been used or has expired
  peak_after: number | null;
  expires: string | null;
}

export interface DeclineView {
  status: ProposalStatus;
  mod: string;
  title: string;
  from_w: number;
  to_w: number;
  expired: boolean;
}

export interface OkMessage {
  ok: boolean;
  message: string;
}

export interface StudentDigest {
  week: number;
  hours: number;
  limit: number;
  heavy: boolean;
  // `id` is not in the contract; the extension form needs it (see README).
  due: { id?: string; mod: string; title: string; hours: number; hidden: boolean }[];
  start_now: { id?: string; mod: string; title: string; due: number; hours_this_week: number }[];
  marks_per_hour: { id?: string; mod: string; title: string; weight: number; hours: number; due: number; mph: number }[];
  pulse: { count: number; cohort: number; share: number; threshold: number; mine: boolean };
}

export interface PulseResult {
  ok: boolean;
  message?: string;
  count?: number;
  share?: number;
  alerted?: boolean;
}

export type Verdict = "approve" | "decline" | "refer";
export type ExtensionReason = "medical" | "family" | "workload" | "other";

export interface ExtensionDraft {
  verdict: Verdict;
  days: number;
  why: string[];
}

export interface ExtensionPattern {
  students_asking?: number;
  note?: string;
}

export interface ExtensionRequest {
  email: string;
  token: string;
  assess_id: string;
  days: number;
  reason: ExtensionReason;
  personal_hours: number;
}

export interface ExtensionCreated {
  id: number;
  status: "pending";
  draft: ExtensionDraft;
  pattern: ExtensionPattern;
}

// The contract says "list with draft and status"; the other fields are what
// the UI shows when the backend includes them.
export interface Extension {
  id: number;
  status: string;
  draft: ExtensionDraft;
  pattern: ExtensionPattern;
  assess_id?: string;
  mod?: string;
  title?: string;
  due?: number;
  due_week?: number;
  student?: string;
  decided_by?: string | null;
  days?: number;
  reason?: ExtensionReason;
  personal_hours?: number;
  created?: string;
  decided?: string | null;
}

export interface StudentLink {
  email: string;
  token: string;
  url: string;
}

/** One assessment as seen from one week (GET /api/week/{n}). `hidden` is the brief quote, or "". */
export interface WeekRow {
  id: string;
  mod: string;
  title: string;
  type: TaskType;
  weight: number;
  group: boolean;
  fixed: boolean;
  hidden: string;
  due_week: number;
  hours_this_week: number;
  hours_total: number;
}

export interface WeekMove {
  id: number;
  mod: string;
  title: string;
  from_w: number;
  to_w: number;
  status: ProposalStatus | string;
}

/** Everything about one teaching week (GET /api/week/{n}, operator). Feeds the week overlay. */
export interface WeekDetail {
  week: number;
  starts: string;
  ends: string;
  hours: number;
  limit: number;
  over: boolean;
  over_by: number;
  holiday: string | null;
  festive_week: boolean;
  revision_week: boolean;
  due: WeekRow[];
  building: WeekRow[];
  modules: Record<string, number>;
  issues: Issue[];
  moves: WeekMove[];
}
