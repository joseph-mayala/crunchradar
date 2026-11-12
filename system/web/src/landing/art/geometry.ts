/*
 * Pure geometry for the landing page artwork (radar, skyline, countdown ring).
 * No React, no DOM, so every shape the page draws from the public summary can be unit tested.
 */

const r2 = (x: number) => Math.round(x * 100) / 100;

/** A point on a circle. 0 degrees is straight up and angles run clockwise, like the radar needle. */
export function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: r2(cx + r * Math.cos(a)), y: r2(cy + r * Math.sin(a)) };
}

/** The angle at the middle of week `week` (1-based) when n weeks go once round the dial. */
export function weekAngle(week: number, n: number): number {
  if (n <= 0) return 0;
  return ((week - 0.5) / n) * 360;
}

/** One dot per week for the radar: angle by week, distance from centre by hours. */
export interface RadarDot {
  week: number;
  x: number;
  y: number;
  over: boolean;
  peak: boolean;
}

export function radarDots(hours: number[], limit: number | null, radius: number, top?: number): RadarDot[] {
  if (!hours.length) return [];
  const max = top ?? Math.max(limit ?? 0, ...hours, 1);
  const peakH = Math.max(...hours);
  const peakI = hours.indexOf(peakH);
  return hours.map((h, i) => {
    const p = polar(0, 0, (Math.max(0, h) / max) * radius, weekAngle(i + 1, hours.length));
    return { week: i + 1, x: p.x, y: p.y, over: limit != null && h > limit, peak: i === peakI };
  });
}

/**
 * A stepped silhouette of weekly bars, as one closed path along the bottom of a w by h box.
 * Each week gets an equal slot; bars fill `fill` of their slot. Empty input gives an empty string.
 */
export function skylinePath(hours: number[], w: number, h: number, fill = 0.72, top?: number): string {
  if (!hours.length || w <= 0 || h <= 0) return "";
  const max = top ?? Math.max(...hours, 1);
  const slot = w / hours.length;
  const bw = slot * fill;
  let d = "";
  hours.forEach((v, i) => {
    const x0 = r2(i * slot + (slot - bw) / 2);
    const x1 = r2(x0 + bw);
    const y = r2(h - (Math.max(0, v) / max) * h);
    d += `M${x0} ${h}V${y}H${x1}V${h}Z`;
  });
  return d;
}

/** An open arc from 12 o'clock, clockwise, covering `frac` (0..1) of the circle. */
export function arcPath(cx: number, cy: number, r: number, frac: number): string {
  const f = Math.min(Math.max(frac, 0), 0.9999);
  if (f === 0) return "";
  const start = polar(cx, cy, r, 0);
  const end = polar(cx, cy, r, f * 360);
  const large = f > 0.5 ? 1 : 0;
  return `M${start.x} ${start.y}A${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

/** A pie wedge from the centre, `deg` wide, starting at 12 o'clock and opening anticlockwise (the sweep's trail). */
export function wedgePath(r: number, deg: number): string {
  const a = polar(0, 0, r, 0);
  const b = polar(0, 0, r, -deg);
  return `M0 0L${a.x} ${a.y}A${r} ${r} 0 0 0 ${b.x} ${b.y}Z`;
}
