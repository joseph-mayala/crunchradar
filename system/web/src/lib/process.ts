import type { OutboxMail, Proposal } from "../types";

export type StepState = "done" | "now" | "todo";
export interface ProcessStep {
  key: "detect" | "propose" | "approve" | "notify";
  label: string;
  hint: string;
  state: StepState;
}

/**
 * The live process tracker on the Overview, driven by real data:
 * Detect = crunch weeks found, Propose = a move was proposed, Approve = a move was approved,
 * Notify = a lecturer email (kind "reschedule") was sent or drafted. The first open step is "now".
 */
export function processSteps({ crunchWeeks, proposals, outbox }: { crunchWeeks: number; proposals: Proposal[]; outbox: OutboxMail[] }): ProcessStep[] {
  const done = [
    crunchWeeks > 0,
    proposals.length > 0,
    proposals.some((p) => p.status === "approved"),
    outbox.some((m) => m.kind === "reschedule"),
  ];
  const meta: [ProcessStep["key"], string, string][] = [
    ["detect", "Detect", crunchWeeks > 0 ? `${crunchWeeks} crunch week${crunchWeeks === 1 ? "" : "s"} found` : "no crunch week yet"],
    ["propose", "Propose", "a move within the rules"],
    ["approve", "Approve", "a named person decides"],
    ["notify", "Notify", "email only after approval"],
  ];
  const firstOpen = done.findIndex((x) => !x);
  return meta.map(([key, label, hint], i) => ({ key, label, hint, state: done[i] ? "done" : i === firstOpen ? "now" : "todo" }));
}
