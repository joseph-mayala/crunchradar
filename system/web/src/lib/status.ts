import type { IssueKind, Mode, ProposalStatus, Verdict } from "../types";

/** Brand tones. crit is reserved for overload (and Rejected/Declined per BRAND.md). */
export type Tone = "good" | "warn" | "crit" | "mute" | "info" | "hol";

export interface TagSpec {
  label: string;
  tone: Tone;
  /** Real product logo shown before the label, in its own colours (BrandMark key). */
  brand?: "gemini";
}

export function proposalTag(status: ProposalStatus | string): TagSpec {
  switch (status) {
    case "pending":
      return { label: "Waiting for decision", tone: "warn" };
    case "approved":
      return { label: "Approved", tone: "good" };
    case "rejected":
      return { label: "Rejected", tone: "crit" };
    case "declined":
      return { label: "Declined by lecturer", tone: "crit" };
    case "expired":
      return { label: "Expired", tone: "mute" };
    default:
      return { label: String(status), tone: "mute" };
  }
}

export function runTag(status: string): TagSpec {
  const s = status.toLowerCase();
  if (s === "completed") return { label: "Completed", tone: "good" };
  if (s === "needs review") return { label: "Needs review", tone: "warn" };
  if (s === "running") return { label: "Running", tone: "info" };
  if (s === "failed" || s === "error") return { label: "Failed", tone: "mute" };
  return { label: status, tone: "mute" };
}

export function modeBadge(mode: Mode | null | undefined): TagSpec | null {
  if (mode === "gemini") return { label: "GEMINI", tone: "mute", brand: "gemini" };
  if (mode === "rules") return { label: "RULES", tone: "warn" };
  return null;
}

export function verdictTag(v: Verdict): TagSpec {
  if (v === "approve") return { label: "Draft: approve", tone: "good" };
  if (v === "decline") return { label: "Draft: decline", tone: "mute" };
  return { label: "Draft: refer to lecturer", tone: "warn" };
}

export function extensionStatusTag(status: string): TagSpec {
  const s = status.toLowerCase();
  if (s === "pending") return { label: "Waiting for operator", tone: "warn" };
  if (s === "approved") return { label: "Approved", tone: "good" };
  if (s === "overridden" || s === "override") return { label: "Overridden", tone: "mute" };
  return { label: status, tone: "mute" };
}

export function issueTag(kind: IssueKind | string): TagSpec {
  switch (kind) {
    case "crunch":
      return { label: "Crunch", tone: "crit" };
    case "holiday":
      return { label: "Holiday", tone: "hol" };
    case "hidden":
      return { label: "Hidden task", tone: "hol" };
    case "feedback":
      return { label: "Feedback rule", tone: "warn" };
    default:
      return { label: String(kind), tone: "mute" };
  }
}

/** Mail kind label, e.g. "approval-request" -> "Approval request". */
export function mailKindLabel(kind: string): string {
  const t = kind.replace(/[-_]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "Email";
}
