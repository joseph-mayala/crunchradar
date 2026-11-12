/*
 * The landing page's background motif, drawn from the product's own data.
 *   Radar    concentric rings echoing the logo, a slow sweep (CSS rotate only), and one dot per
 *            teaching week placed by its hours, so the coral dots are the real crunch weeks.
 *   Skyline  the semester's weekly bars as a faint silhouette along the foot of a section.
 *   Ruler    a quiet week ruler, W1 to W14, for section edges.
 * Every piece is decorative (aria-hidden) and quiet, so text over it stays readable.
 */
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { radarDots, skylinePath, wedgePath, polar, weekAngle } from "./geometry";
import { usePinned } from "../shared";

export interface Series {
  hours: number[];
  limit: number | null;
}

const R = 96;

/** Rings, week spokes, the dashed limit ring, a sweep and the weekly dots. viewBox is centred on 0,0. */
export function Radar({ data, className = "", sweep = true, dots = true }: { data?: Series | null; className?: string; sweep?: boolean; dots?: boolean }) {
  const n = data?.hours.length || 14;
  const top = data ? Math.max(data.limit ?? 0, ...data.hours, 1) * 1.08 : 1;
  const pts = data && dots ? radarDots(data.hours, data.limit, R * 0.9, top) : [];
  const limitR = data?.limit != null ? (data.limit / top) * R * 0.9 : null;
  return (
    <svg className={`art-radar ${className}`} viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <circle key={k} r={R * k} className="art-ring" />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const a = polar(0, 0, R, (i / n) * 360);
        const b = polar(0, 0, R - 5, (i / n) * 360);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="art-tick" />;
      })}
      {limitR != null && <circle r={limitR} className="art-limit" />}
      {sweep && (
        <g className="art-sweep">
          <circle r={R} fill="none" stroke="none" />
          <path d={wedgePath(R, 38)} className="art-wedge" />
          <line x1={0} y1={0} x2={0} y2={-R} className="art-needle" />
        </g>
      )}
      {pts.map((d) => (
        <g key={d.week}>
          {d.peak && <circle cx={d.x} cy={d.y} r={4.5} className="art-blip-ring" />}
          <circle cx={d.x} cy={d.y} r={d.over ? 2.2 : 1.5} className={d.over ? "art-dot is-over" : "art-dot"} />
        </g>
      ))}
    </svg>
  );
}

/** The weekly bars as a silhouette along the bottom of the parent. Drifts slightly against the scroll. */
export function Skyline({ data, className = "" }: { data?: Series | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const live = usePinned();
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [18, -18]);
  if (!data?.hours.length) return null;
  const W = 1400;
  const H = 160;
  const top = Math.max(data.limit ?? 0, ...data.hours, 1);
  const ly = data.limit != null ? H - (data.limit / top) * H : null;
  return (
    <div ref={ref} className={`art-skyline ${className}`} aria-hidden="true">
      <motion.svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={live && !reduce ? { y } : undefined}>
        <path d={skylinePath(data.hours, W, H, 0.62, top)} className="art-sky-bars" />
        {ly != null && <line x1={0} x2={W} y1={ly} y2={ly} className="art-sky-limit" vectorEffect="non-scaling-stroke" />}
      </motion.svg>
    </div>
  );
}

/** A quiet week ruler: one tick per week, a label every other week, coral ticks on crunch weeks. */
export function WeekRuler({ data, className = "" }: { data?: Series | null; className?: string }) {
  const hours = data?.hours ?? [];
  const n = hours.length || 14;
  return (
    <div className={`art-ruler ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const over = data?.limit != null && hours[i] > data.limit;
        return (
          <span key={i} className={over ? "is-over" : ""}>
            <i />
            {i % 2 === 0 || over ? <b>W{i + 1}</b> : null}
          </span>
        );
      })}
    </div>
  );
}

/** Where the radar puts a given week (used to pin a label to the peak dot). */
export const weekPoint = (week: number, n: number, r: number) => polar(0, 0, r, weekAngle(week, n));
