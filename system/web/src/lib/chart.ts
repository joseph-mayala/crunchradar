/** Pure helpers for the hand-written SVG charts. */

/** Round a maximum up to a tidy axis top (multiple of 2, 5 or 10 depending on size). */
export function niceMax(...values: number[]): number {
  const m = Math.max(0, ...values.filter((v) => Number.isFinite(v)));
  if (m <= 0) return 10;
  const padded = m * 1.1;
  const step = padded <= 20 ? 2 : padded <= 60 ? 5 : 10;
  return Math.ceil(padded / step) * step;
}

/** Evenly spaced axis ticks from 0 to max inclusive, rounded to whole numbers. */
export function ticks(max: number, count = 4): number[] {
  if (max <= 0 || count < 1) return [0];
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(Math.round((max * i) / count));
  return out;
}

/** Map a value onto an SVG y coordinate (0 at the top), clamped to the plot. */
export function scaleY(value: number, max: number, top: number, bottom: number): number {
  if (max <= 0) return bottom;
  const v = Math.min(Math.max(value, 0), max);
  return bottom - (v / max) * (bottom - top);
}

/** x position and width of bar i of n inside [left, right], with a gap ratio between bars. */
export function band(i: number, n: number, left: number, right: number, gap = 0.36): { x: number; w: number; cx: number } {
  const slot = (right - left) / Math.max(n, 1);
  const w = slot * (1 - gap);
  const x = left + i * slot + (slot - w) / 2;
  return { x, w, cx: x + w / 2 };
}

/** Heat level 0..5 for one heatmap cell, relative to the weekly limit. */
export function heatLevel(hours: number, limit: number): number {
  if (!(hours > 0.05)) return 0;
  const r = hours / Math.max(limit, 1);
  if (r < 0.08) return 1;
  if (r < 0.18) return 2;
  if (r < 0.3) return 3;
  if (r < 0.45) return 4;
  return 5;
}

/** Number of weeks over the limit. */
export function crunchCount(weekly: number[], limit: number): number {
  return weekly.filter((h) => h > limit).length;
}

/** 1-based index of the heaviest week (first one wins on a tie). */
export function worstWeek(weekly: number[]): number {
  let best = 0;
  weekly.forEach((h, i) => {
    if (h > weekly[best]) best = i;
  });
  return weekly.length ? best + 1 : 0;
}

/** "1 crunch week" / "3 crunch weeks". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Round to one decimal for display, without trailing ".0". */
export function fmtHours(h: number): string {
  const r = Math.round(h * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/**
 * Heat step 0..5 for one module-week cell (0 = no work). Same hour bands as the original grid:
 * under 4 h, under 8 h, under 12 h, under 16 h, 16 h and more.
 */
export function heatStep(h: number): number {
  if (!(h > 0.1)) return 0;
  if (h < 4) return 1;
  if (h < 8) return 2;
  if (h < 12) return 3;
  if (h < 16) return 4;
  return 5;
}

/**
 * Indigo ramp for the heat grid: near-surface, through dusty violet, to periwinkle at the top.
 * No red here. Coral is kept for the over-limit totals only.
 */
export const HEAT_RAMP = [
  "rgba(165,175,255,.03)",
  "rgba(123,132,207,.16)",
  "rgba(123,132,207,.32)",
  "rgba(123,132,207,.56)",
  "#7b84cf",
  "#8f94f5",
] as const;

/** Heat colour for one module-week cell. */
export function heatColor(h: number): string {
  return HEAT_RAMP[heatStep(h)];
}

/** Value label above a bar: hidden under 1 h so the empty weeks stay quiet. */
export function barValueLabel(h: number): string {
  return h >= 1 ? String(Math.round(h)) : "";
}

/** Week label under bar i (0-based). Narrow charts label every second week, plus any week that must stand out. */
export function weekTick(i: number, narrow: boolean, mustShow = false): string {
  if (!narrow) return `W${i + 1}`;
  return i % 2 === 0 || mustShow ? String(i + 1) : "";
}

/** Axis top as in the original: at least 1.35 x the limit, rounded up to 20. */
export function chartTop(values: number[], limit: number): number {
  return Math.ceil(Math.max(...values, limit * 1.35, 1) / 20) * 20;
}
