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
 * Smooth Catmull-Rom style path through points (from the original prototype),
 * with control points clamped so the curve never dips below the baseline.
 */
export function smoothPath(pts: [number, number][], base: number): string {
  if (!pts.length) return "";
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(base, p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(base, p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

/** Heat colour for one module-week cell, the original prototype's six steps. */
export function heatColor(h: number): string {
  if (h <= 0.1) return "rgba(255,255,255,.028)";
  if (h < 4) return "rgba(255,255,255,.085)";
  if (h < 8) return "rgba(179,161,255,.18)";
  if (h < 12) return "rgba(160,132,255,.38)";
  if (h < 16) return "rgba(205,105,235,.58)";
  return "rgba(255,59,59,.86)";
}

/** Axis top as in the original: at least 1.35 x the limit, rounded up to 20. */
export function chartTop(values: number[], limit: number): number {
  return Math.ceil(Math.max(...values, limit * 1.35, 1) / 20) * 20;
}
