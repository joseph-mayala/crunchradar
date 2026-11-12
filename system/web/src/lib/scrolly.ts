/*
 * Pure helpers for the scroll-driven landing page. No React, no DOM: every function maps a
 * scroll progress (0 to 1 across a pinned section) to what the page should show, so the
 * mapping can be unit-tested and the components only wire motion values to it.
 *
 * Only the start and end states of the relief chart are real data (weekly_hours and
 * weekly_hours_after from GET /api/public-summary). Frames in between are a straight blend
 * of the two, drawn so the reader can watch the shape change; they are not separate results.
 */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Progress of p through the window [a, b], clamped to 0..1. */
export const seg = (p: number, a: number, b: number) => (b === a ? (p >= b ? 1 : 0) : clamp01((p - a) / (b - a)));
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/* ---- Beat 1: the relief chart timeline ---- */

/** Phase A (bars rise) runs to A_END; phase B (moves) runs B_START..B_END; the rest holds the end state. */
export const RELIEF = { A_END: 0.3, B_START: 0.36, B_END: 0.88 } as const;

/** How far bar i (of n) has risen at progress p, 0..1. Bars rise one after another through phase A. */
export function riseAt(p: number, i: number, n: number): number {
  const u = seg(p, 0.02, RELIEF.A_END);
  const w = 0.28;
  const start = n <= 1 ? 0 : (i / (n - 1)) * (1 - w);
  return easeOut(seg(u, start, start + w));
}

/** The window of scroll progress that belongs to move k of m in phase B. */
export function moveWindow(k: number, m: number): [number, number] {
  const len = (RELIEF.B_END - RELIEF.B_START) / Math.max(1, m);
  return [RELIEF.B_START + k * len, RELIEF.B_START + (k + 1) * len];
}

/**
 * How much of the fix is applied at progress p, 0..1. Each of the m moves eases in over the
 * first 60% of its own window and then holds, so every move lands and rests while its caption reads.
 */
export function fixAt(p: number, m: number): number {
  if (m <= 0) return 0;
  let t = 0;
  for (let k = 0; k < m; k++) {
    const [a, b] = moveWindow(k, m);
    t += easeInOut(seg(p, a, a + (b - a) * 0.6));
  }
  return t / m;
}

/** Bar heights at progress p: rise through phase A, then blend from before to after through phase B. */
export function chartAt(p: number, before: number[], after: number[] | null, m: number): number[] {
  const t = after ? fixAt(p, m) : 0;
  return before.map((b, i) => riseAt(p, i, before.length) * lerp(b, after?.[i] ?? b, t));
}

/** Index of the move whose window holds p: -1 before phase B, m once every move has landed. */
export function activeMove(p: number, m: number): number {
  if (p < RELIEF.B_START) return -1;
  if (p >= RELIEF.B_END) return m;
  for (let k = 0; k < m; k++) {
    const [a, b] = moveWindow(k, m);
    if (p >= a && p < b) return k;
  }
  return m;
}

/** Which of the four loop steps (Detect, Propose, Approve, Notify) is lit at progress p. */
export function stepAt(p: number, m: number): number {
  const k = activeMove(p, m);
  if (k < 0) return 0;
  if (k >= m) return 3;
  const [a, b] = moveWindow(k, m);
  return seg(p, a, b) < 0.55 ? 1 : 2;
}

/** A number counted between two real values, rounded to the given decimals. */
export function countAt(from: number, to: number, t: number, decimals = 0): number {
  const f = Math.pow(10, decimals);
  return Math.round(lerp(from, to, clamp01(t)) * f) / f;
}

/** The busiest week (1-based) and its hours; null for an empty list. */
export function peakWeek(hours: number[]): { week: number; hours: number } | null {
  if (!hours.length) return null;
  let best = 0;
  hours.forEach((h, i) => {
    if (h > hours[best]) best = i;
  });
  return { week: best + 1, hours: hours[best] };
}

/** Weeks strictly over the limit. */
export const overCount = (hours: number[], limit: number) => hours.filter((h) => h > limit).length;

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
/** "Four" for 4; digits past ten. */
export const numberWord = (n: number) => WORDS[n] ?? String(n);

/** Hours as the page writes them: one decimal, trailing ".0" dropped. */
export const hoursText = (h: number) => (Math.round(h * 10) / 10).toFixed(1).replace(/\.0$/, "");

/* ---- Beat 2: the agent log ---- */

/** Opacity (0..1) of log line i of n at progress p. Lines arrive in order and stay. */
export function lineAt(p: number, i: number, n: number): number {
  const start = 0.06 + (i / Math.max(1, n)) * 0.7;
  return easeOut(seg(p, start, start + 0.08));
}

/* ---- Beat 3: the sideways pan ---- */

/** Settle for card i of n as the track travels: the first card is already there, the rest arrive in turn. */
export function settleAt(p: number, i: number, n: number): number {
  if (i === 0) return 1;
  const at = ((i - 0.6) / Math.max(1, n - 1)) * 0.92;
  return seg(p, at - 0.12, at + 0.02);
}
