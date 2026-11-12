import type { PublicSummary } from "../types";

export interface HeroTile {
  key: string;
  label: string;
  value: string;
  /** Number to count up to, and the unit after it ("" or " h"). Null when not available. */
  num: number | null;
  unit: string;
  small: string;
  /** "bad" = over the limit (red), "ok" = within (lime), "" = neutral. */
  state: "bad" | "ok" | "";
}

const NA = "not available";

/** The four hero stat tiles from GET /api/public-summary; null gives the "not available" fallback. */
export function heroTiles(s: PublicSummary | null): HeroTile[] {
  if (!s) {
    return [
      { key: "crunch", label: "Crunch weeks", value: "", num: null, unit: "", small: NA, state: "" },
      { key: "peak", label: "Peak week", value: "", num: null, unit: "", small: NA, state: "" },
      { key: "hidden", label: "Hidden tasks", value: "", num: null, unit: "", small: NA, state: "" },
      { key: "waiting", label: "Waiting for a person", value: "", num: null, unit: "", small: NA, state: "" },
    ];
  }
  return [
    { key: "crunch", label: "Crunch weeks", value: String(s.crunch_weeks), num: s.crunch_weeks, unit: "", small: `of ${s.weeks}`, state: s.crunch_weeks > 0 ? "bad" : "ok" },
    { key: "peak", label: "Peak week", value: `${Math.round(s.peak)} h`, num: Math.round(s.peak), unit: " h", small: `/ ${Math.round(s.limit)} h`, state: s.peak > s.limit ? "bad" : "ok" },
    { key: "hidden", label: "Hidden tasks", value: String(s.hidden_tasks), num: s.hidden_tasks, unit: "", small: "in briefs", state: "" },
    { key: "waiting", label: "Waiting for a person", value: String(s.waiting_for_person), num: s.waiting_for_person, unit: "", small: s.waiting_for_person === 1 ? "decision" : "decisions", state: "" },
  ];
}
