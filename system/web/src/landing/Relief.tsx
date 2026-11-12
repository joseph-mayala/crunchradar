import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import type { IllustratedMove, PublicSummary } from "../types";
import { RELIEF, countAt, fixAt, hoursText, lerp, moveWindow, numberWord, overCount, peakWeek, riseAt, stepAt } from "../lib/scrolly";
import { SPRING, SampleLabel, usePinned } from "./shared";
import { Radar, WeekRuler } from "./art/Motif";

const BAR = "var(--pal-bar)";
const CRIT = "var(--pal-crit)";
const STEPS = ["Detect", "Propose", "Approve", "Notify"];

/* ---------- geometry shared by the animated and the static chart ---------- */
const W = 720;
const H = 480;
const PAD = { l: 46, r: 6, t: 14, b: 30 };
const PLOT_H = H - PAD.t - PAD.b;

function geom(n: number, yMax: number) {
  const slot = (W - PAD.l - PAD.r) / Math.max(1, n);
  const barW = slot * 0.6;
  return {
    slot,
    barW,
    x: (i: number) => PAD.l + i * slot + (slot - barW) / 2,
    y: (h: number) => PAD.t + PLOT_H - (Math.max(0, h) / yMax) * PLOT_H,
  };
}

export const axisTop = (values: number[], limit: number) => Math.ceil((Math.max(limit, ...values, 1) + 2) / 5) * 5;

function Axis({ n, limit, yMax, compact }: { n: number; limit: number | null; yMax: number; compact?: boolean }) {
  const g = geom(n, yMax);
  const ly = limit == null ? 0 : g.y(limit);
  return (
    <g>
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + PLOT_H} y2={PAD.t + PLOT_H} stroke="var(--pal-line-2)" />
      {limit != null && (
        <>
          <line x1={PAD.l} x2={W - PAD.r} y1={ly} y2={ly} stroke="var(--pal-ink)" strokeOpacity={0.5} strokeDasharray="6 6" strokeWidth={1.5} />
          <text x={PAD.l - 8} y={ly + 4} textAnchor="end" className="chart-axis">
            {hoursText(limit)} h
          </text>
        </>
      )}
      {Array.from({ length: n }, (_, i) =>
        compact && i % 2 === 1 ? null : (
          <text key={i} x={g.x(i) + g.barW / 2} y={H - 9} textAnchor="middle" className="chart-axis">
            W{i + 1}
          </text>
        ),
      )}
    </g>
  );
}

/** A plain SVG chart of hours per week; used for the static before/after pair and the loading frame. */
export function WeekChart({ hours, limit, yMax, label, ghost, compact }: { hours: number[]; limit: number | null; yMax: number; label: string; ghost?: { i: number; h: number }; compact?: boolean }) {
  const n = hours.length || 14;
  const g = geom(n, yMax);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="week-chart" role="img" aria-label={label}>
      <Axis n={n} limit={limit} yMax={yMax} compact={compact} />
      {ghost && <rect x={g.x(ghost.i)} y={g.y(ghost.h)} width={g.barW} height={PAD.t + PLOT_H - g.y(ghost.h)} className="chart-ghost" />}
      {hours.map((h, i) => (
        <rect key={i} x={g.x(i)} y={g.y(h)} width={g.barW} height={PAD.t + PLOT_H - g.y(h)} rx={2} fill={limit != null && h > limit ? CRIT : BAR} />
      ))}
    </svg>
  );
}

/* ---------- the pinned, scroll-driven version ---------- */

function Bar({ p, i, n, before, after, m, limit, yMax }: { p: MotionValue<number>; i: number; n: number; before: number; after: number; m: number; limit: number; yMax: number }) {
  const g = geom(n, yMax);
  const target = useTransform(p, (v) => riseAt(v, i, n) * lerp(before, after, fixAt(v, m)));
  const h = useSpring(target, SPRING);
  const scaleY = useTransform(h, (v) => Math.max(0, v) / yMax);
  const fill = useTransform(h, (v) => (v > limit + 0.05 ? CRIT : BAR));
  return (
    <motion.rect
      x={g.x(i)}
      y={PAD.t}
      width={g.barW}
      height={PLOT_H}
      style={{ scaleY, fill, originX: 0.5, originY: 1 }}
    />
  );
}

/** A caption that fades in over [a, b], holds, and fades out over [c, d] (or holds to the end with `hold`). */
function Fade({ p, range, hold, children, className = "" }: { p: MotionValue<number>; range: [number, number, number, number]; hold?: boolean; children: React.ReactNode; className?: string }) {
  const [a, b, c, d] = range;
  const opacity = useTransform(p, [a, b, c, d], [0, 1, 1, hold ? 1 : 0]);
  const y = useTransform(p, [a, b], [10, 0]);
  return (
    <motion.p className={`relief-caption ${className}`} style={{ opacity, y }}>
      {children}
    </motion.p>
  );
}

function Step({ p, i, m }: { p: MotionValue<number>; i: number; m: number }) {
  const opacity = useTransform(p, (v) => (stepAt(v, m) === i ? 1 : 0.42));
  const on = useTransform(p, (v) => (stepAt(v, m) === i ? 1 : 0));
  return (
    <motion.li style={{ opacity }} className="relief-step">
      {STEPS[i]}
      <motion.span aria-hidden className="relief-step-bar" style={{ scaleX: on }} />
    </motion.li>
  );
}

const moveLabel = (mv: IllustratedMove) => `${mv.mod} ${mv.title}, Week ${mv.from} to Week ${mv.to}`;

function PinnedRelief({ before, after, moves, limit, peak, peakAfter, crunch, crunchAfter }: Data) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const n = before.length;
  const m = moves.length;
  const yMax = axisTop([...before, ...after], limit);
  const g = geom(n, yMax);
  const pk = peakWeek(before);
  const ghostOpacity = useTransform(p, [RELIEF.B_START, RELIEF.B_START + 0.05], [0, 1]);
  const peakText = useTransform(p, (v) => hoursText(countAt(peak, peakAfter, fixAt(v, m), 1)));
  const crunchNum = useTransform(p, (v) => countAt(crunch, crunchAfter, fixAt(v, m)));
  const crunchText = useTransform(crunchNum, (v) => String(v));
  const crunchWord = useTransform(crunchNum, (v): string => (v === 1 ? "crunch week" : "crunch weeks"));
  const endAt = moveWindow(m - 1, m)[1];
  return (
    <section ref={ref} className="relief" id="the-fix" data-section aria-labelledby="relief-h" style={{ height: "420vh" }}>
      <div className="relief-stage">
        <Radar data={{ hours: before, limit }} className="relief-radar" dots={false} />
        <WeekRuler data={{ hours: before, limit }} className="relief-ruler" />
        <div className="relief-copy">
          <h2 id="relief-h" className="beat-h">
            Scroll moves the deadline.
          </h2>
          <div className="relief-captions" aria-live="off">
            {pk && (
              <Fade p={p} range={[0.1, 0.18, RELIEF.B_START - 0.02, RELIEF.B_START + 0.01]}>
                Week {pk.week} is carrying {Math.round(pk.hours)} hours.
              </Fade>
            )}
            {moves.map((mv, k) => {
              const [a, b] = moveWindow(k, m);
              return (
                <Fade key={k} p={p} range={[a, a + 0.02, b - 0.012, b + (k === m - 1 ? 0.004 : 0.012)]} className="is-move">
                  {moveLabel(mv)}
                </Fade>
              );
            })}
            <Fade p={p} range={[endAt + 0.004, endAt + 0.03, 0.99, 1]} hold>
              {numberWord(m)} moves. Each one approved by a person. Sample cohort.
            </Fade>
          </div>
          <dl className="relief-nums">
            <div>
              <dt>Peak week</dt>
              <dd>
                <motion.span>{peakText}</motion.span>
                <small> h</small>
              </dd>
            </div>
            <div>
              <dt>
                <motion.span>{crunchWord}</motion.span>
              </dt>
              <dd>
                <motion.span>{crunchText}</motion.span>
                <small> of {n}</small>
              </dd>
            </div>
          </dl>
          <ol className="relief-steps" aria-label="The weekly loop">
            {STEPS.map((_, i) => (
              <Step key={i} p={p} i={i} m={m} />
            ))}
          </ol>
        </div>
        <figure className="relief-chart">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="week-chart"
            role="img"
            aria-label={`Hours per week, sample cohort. Today week ${pk?.week} peaks at ${hoursText(peak)} hours against a ${hoursText(limit)} hour limit. After ${numberWord(m).toLowerCase()} approved moves the peak is ${hoursText(peakAfter)} hours.`}
          >
            <Axis n={n} limit={limit} yMax={yMax} />
            {pk && <motion.rect x={g.x(pk.week - 1)} y={g.y(pk.hours)} width={g.barW} height={PAD.t + PLOT_H - g.y(pk.hours)} className="chart-ghost" style={{ opacity: ghostOpacity }} />}
            {before.map((b, i) => (
              <Bar key={i} p={p} i={i} n={n} before={b} after={after[i] ?? b} m={m} limit={limit} yMax={yMax} />
            ))}
          </svg>
          <figcaption>
            Hours per week, all modules. Dashed line: the {hoursText(limit)} h limit. <SampleLabel />
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function StaticRelief({ before, after, moves, limit, peak, peakAfter, crunch, crunchAfter }: Data) {
  const yMax = axisTop([...before, ...after], limit);
  const pk = peakWeek(before);
  const ghost = pk ? { i: pk.week - 1, h: pk.hours } : undefined;
  return (
    <section className="relief-static" id="the-fix" data-section aria-labelledby="relief-h">
      <h2 id="relief-h" className="beat-h">
        Scroll moves the deadline.
      </h2>
      {pk && <p className="relief-lead">Week {pk.week} is carrying {Math.round(pk.hours)} hours.</p>}
      <div className="relief-pair">
        <figure>
          <figcaption>
            <b>Today</b>
            <span>
              Peak {hoursText(peak)} h, {crunch} {crunch === 1 ? "crunch week" : "crunch weeks"}
            </span>
          </figcaption>
          <WeekChart hours={before} limit={limit} yMax={yMax} compact label={`Today: week ${pk?.week} peaks at ${hoursText(peak)} hours against a ${hoursText(limit)} hour limit.`} />
        </figure>
        <figure>
          <figcaption>
            <b>After {numberWord(moves.length).toLowerCase()} approved moves</b>
            <span>
              Peak {hoursText(peakAfter)} h, {crunchAfter} {crunchAfter === 1 ? "crunch week" : "crunch weeks"}
            </span>
          </figcaption>
          <WeekChart hours={after} limit={limit} yMax={yMax} compact ghost={ghost} label={`After the moves: the peak is ${hoursText(peakAfter)} hours.`} />
        </figure>
      </div>
      <ol className="relief-moves">
        {moves.map((mv, k) => (
          <li key={k}>{moveLabel(mv)}</li>
        ))}
      </ol>
      <p className="relief-end">
        {numberWord(moves.length)} moves. Each one approved by a person. Sample cohort. <SampleLabel />
      </p>
      <ol className="relief-steps is-static" aria-label="The weekly loop">
        {STEPS.map((s) => (
          <li key={s} className="relief-step">
            {s}
          </li>
        ))}
      </ol>
    </section>
  );
}

interface Data {
  before: number[];
  after: number[];
  moves: IllustratedMove[];
  limit: number;
  peak: number;
  peakAfter: number;
  crunch: number;
  crunchAfter: number;
}

function toData(s: PublicSummary | null): Data | null {
  if (!s || !s.weekly_hours?.length || !s.weekly_hours_after?.length || !s.illustrated_moves?.length) return null;
  const before = s.weekly_hours;
  const after = s.weekly_hours_after;
  return {
    before,
    after,
    moves: s.illustrated_moves,
    limit: s.limit,
    peak: s.peak ?? Math.max(...before),
    peakAfter: s.peak_after ?? Math.max(...after),
    crunch: s.crunch_weeks ?? overCount(before, s.limit),
    crunchAfter: s.crunch_weeks_after ?? overCount(after, s.limit),
  };
}

/**
 * Beat 1, the peak and the signature move. The page never waits for the API: while the summary
 * loads (or if it fails) the chart frame renders with empty bars and an inline note.
 */
export function Relief({ summary, loading }: { summary: PublicSummary | null; loading: boolean }) {
  const pinned = usePinned();
  const d = toData(summary);
  if (!d) {
    return (
      <section className="relief-static" id="the-fix" data-section aria-labelledby="relief-h" aria-busy={loading}>
        <h2 id="relief-h" className="beat-h">
          Scroll moves the deadline.
        </h2>
        <p className="relief-lead">{loading ? "Loading the weekly hours." : "The weekly hours are not available right now."}</p>
        <WeekChart hours={Array.from({ length: 14 }, () => 0)} limit={summary?.limit ?? null} yMax={50} label="Hours per week: not available." />
      </section>
    );
  }
  return pinned ? <PinnedRelief {...d} /> : <StaticRelief {...d} />;
}
