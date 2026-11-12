/** Pure helpers for the week overlay (GET /api/week/{n}). */
import type { WeekDetail } from "../types";
import { fmtHours } from "./chart";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string): { d: number; m: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  return { d: Number(m[3]), m: Number(m[2]) - 1 };
}

/** "15 to 21 Mar", or "28 Feb to 6 Mar" when the week crosses a month. Plain words, no dashes. */
export function weekRangeLabel(starts: string, ends: string): string {
  const a = parts(starts);
  const b = parts(ends);
  if (!a || !b) return "";
  if (a.m === b.m) return `${a.d} to ${b.d} ${MONTHS[b.m]}`;
  return `${a.d} ${MONTHS[a.m]} to ${b.d} ${MONTHS[b.m]}`;
}

/** The line under the big number: "20.3 h over the 28 h limit" or "within the 28 h limit". */
export function limitLine(d: Pick<WeekDetail, "over" | "over_by" | "limit">): { text: string; over: boolean } {
  if (d.over) return { text: `${fmtHours(d.over_by)} h over the ${fmtHours(d.limit)} h limit`, over: true };
  return { text: `within the ${fmtHours(d.limit)} h limit`, over: false };
}

/** Notes for festive weeks, public holidays and the revision week. */
export function weekNotes(d: Pick<WeekDetail, "holiday" | "festive_week" | "revision_week">): string[] {
  const out: string[] = [];
  if (d.holiday) out.push(`Public holiday: ${d.holiday}.`);
  if (d.festive_week) out.push("Festive week. The check avoids moving deadlines into it.");
  if (d.revision_week) out.push("Revision week before finals. Deadlines are kept out of it.");
  return out;
}

export interface ModuleShare {
  mod: string;
  hours: number;
  /** Share of the week total, 0..1. The shares add up to 1. */
  share: number;
}

/** Per-module hours, biggest first, with each module's share of the week. */
export function moduleShares(modules: Record<string, number>): ModuleShare[] {
  const rows = Object.entries(modules)
    .filter(([, h]) => h > 0)
    .map(([mod, hours]) => ({ mod, hours }));
  const total = rows.reduce((s, r) => s + r.hours, 0);
  return rows.sort((a, b) => b.hours - a.hours || a.mod.localeCompare(b.mod)).map((r) => ({ ...r, share: total > 0 ? r.hours / total : 0 }));
}

/** The week to show after pressing previous (-1) or next (+1), kept inside 1..weeks. */
export function stepWeek(week: number, dir: -1 | 1, weeks: number): number {
  return Math.min(Math.max(week + dir, 1), Math.max(weeks, 1));
}

/** Where a bottom sheet should settle after a drag: close when pulled far or flicked down. */
export function sheetShouldClose(offsetY: number, velocityY: number, height: number): boolean {
  return offsetY > Math.min(160, height * 0.3) || velocityY > 600;
}
