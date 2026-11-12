/*
 * The small annotated chart beside the agent log: the cohort's weekly hours (public summary),
 * the limit it read, the crunch weeks it counted and the week where it found a task nobody listed.
 * `found` (0..1) brings in the Week 12 highlight in step with the "found" line of the log.
 */
import { motion, useTransform, type MotionValue } from "motion/react";
import { hoursText } from "../../lib/scrolly";

const W = 560;
const H = 330;
const PAD = { l: 8, r: 8, t: 34, b: 26 };
const FOUND_WEEK = 12;

export function LogDiagram({ hours, limit, found }: { hours: number[]; limit: number; found: MotionValue<number> }) {
  const opacity = useTransform(found, (v) => v);
  const y = useTransform(found, (v) => (1 - v) * 8);
  if (!hours.length) return null;
  const n = hours.length;
  const top = Math.max(limit, ...hours, 1) * 1.08;
  const plotH = H - PAD.t - PAD.b;
  const slot = (W - PAD.l - PAD.r) / n;
  const bw = slot * 0.58;
  const bx = (i: number) => PAD.l + i * slot + (slot - bw) / 2;
  const by = (h: number) => PAD.t + plotH - (Math.max(0, h) / top) * plotH;
  const ly = by(limit);
  const fi = Math.min(FOUND_WEEK, n) - 1;
  const fx = bx(fi) + bw / 2;
  const over = hours.filter((h) => h > limit).length;
  return (
    <figure className="log-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`What the agent read: ${n} weeks of hours, ${over} over the ${hoursText(limit)} hour limit, and a task found in Week ${fi + 1}.`}>
        {hours.map((h, i) => (
          <rect key={i} x={bx(i)} y={by(h)} width={bw} height={PAD.t + plotH - by(h)} rx={2} className={h > limit ? "ld-bar is-over" : "ld-bar"} />
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="ld-base" />
        <line x1={PAD.l} x2={W - PAD.r} y1={ly} y2={ly} className="ld-limit" />
        <g className="ld-callout">
          <circle cx={PAD.l + 12} cy={ly - 14} r={9} />
          <text x={PAD.l + 12} y={ly - 10.5} textAnchor="middle">
            1
          </text>
          <text x={PAD.l + 27} y={ly - 10} className="ld-note">
            limit {hoursText(limit)} h
          </text>
        </g>
        <motion.g style={{ opacity, y }}>
          <rect x={bx(fi) - 4} y={PAD.t - 6} width={bw + 8} height={plotH + 10} rx={6} className="ld-found" />
          <g className="ld-callout is-found">
            <circle cx={fx} cy={PAD.t - 16} r={9} />
            <text x={fx} y={PAD.t - 12.5} textAnchor="middle">
              2
            </text>
            <text x={fx - 14} y={PAD.t - 12} textAnchor="end" className="ld-note">
              group demo found in a brief
            </text>
          </g>
        </motion.g>
        {hours.map((_, i) =>
          i % 2 === 0 || i === fi ? (
            <text key={i} x={bx(i) + bw / 2} y={H - 8} textAnchor="middle" className="ld-axis">
              W{i + 1}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption>
        <span>
          <b className="ld-key is-over" /> over the limit
        </span>
        <span>
          <b className="ld-key is-found" /> found in a brief
        </span>
      </figcaption>
    </figure>
  );
}
