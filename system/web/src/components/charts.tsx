import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Diamond } from "@phosphor-icons/react";
import { chartTop, fmtHours, heatColor, plural, smoothPath } from "../lib/chart";
import { weekDate } from "../lib/weeks";
import type { Assessment, Module } from "../types";
import { SPRING } from "./ui";

/** Width of an element in CSS px, so the SVG draws 1:1 and text stays readable on phones. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

interface LoadChartProps {
  weekly: number[];
  limit: number;
  holidays?: Record<string, string>;
  semesterStart?: string;
  compact?: boolean;
  title?: string;
}

/**
 * Weekly cohort load in the original style: smooth line with glow and area fill, the part above the
 * limit clipped red, a dashed limit line. Each week is a focusable hit area with a tooltip
 * (Left and Right arrows move between weeks).
 */
export function LoadChart({ weekly, limit, holidays = {}, semesterStart, compact = false, title = "Weekly assignment load" }: LoadChartProps) {
  const uid = useId().replace(/:/g, "");
  const [ref, W] = useWidth(1000);
  const narrow = W < 560;
  const H = compact ? 200 : narrow ? 250 : 300;
  const L = narrow ? 30 : 46;
  const R = narrow ? 10 : 24;
  const T = 30;
  const B = 44;
  const iw = W - L - R;
  const ih = H - T - B;
  const base = T + ih;
  const n = weekly.length;
  const ymax = chartTop(weekly, limit);
  const x = (i: number) => L + (n > 1 ? (i * iw) / (n - 1) : iw / 2);
  const y = (v: number) => T + ih - (Math.max(0, v) / ymax) * ih;
  const pts = weekly.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smoothPath(pts, base);
  const area = `${line} L${x(n - 1)},${base} L${x(0)},${base} Z`;
  const ly = y(limit);
  const col = n > 1 ? iw / (n - 1) : iw;
  const [active, setActive] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const hits = useRef<(SVGRectElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const j = Math.min(n - 1, Math.max(0, next));
    setFocusIdx(j);
    hits.current[j]?.focus();
  };
  const tip = (i: number) => {
    const v = weekly[i];
    const hol = holidays[String(i + 1)];
    return `Week ${i + 1}${semesterStart ? `, from ${weekDate(semesterStart, i + 1)}` : ""}: about ${fmtHours(v)} h${v > limit ? `, over the ${fmtHours(limit)} h limit` : ""}${hol ? `. ${hol}` : ""}`;
  };

  return (
    <figure className="relative m-0" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart block h-auto w-full overflow-visible" role="group" aria-label={`${title}. Limit ${fmtHours(limit)} h. Use the arrow keys to move between weeks.`}>
        <defs>
          <linearGradient id={`gA${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b3a1ff" stopOpacity=".42" />
            <stop offset=".7" stopColor="#b3a1ff" stopOpacity=".06" />
            <stop offset="1" stopColor="#b3a1ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`gH${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff3b3b" stopOpacity=".75" />
            <stop offset="1" stopColor="#ff3b3b" stopOpacity=".12" />
          </linearGradient>
          <linearGradient id={`gB${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff3b3b" stopOpacity=".14" />
            <stop offset="1" stopColor="#ff3b3b" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`cH${uid}`}>
            <rect x="0" y="0" width={W} height={Math.max(0, ly)} />
          </clipPath>
          <filter id={`glow${uid}`} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {weekly.map((v, i) => (v > limit ? <rect key={`b${i}`} x={x(i) - col / 2} y={T - 10} width={col} height={base - T + 10} rx="10" fill={`url(#gB${uid})`} /> : null))}
        {[0, 1, 2, 3, 4].map((k) => {
          const v = (ymax * k) / 4;
          return (
            <g key={k}>
              <line className="gridl" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
              <text className="axis" x={L - (narrow ? 6 : 12)} y={y(v) + 4} textAnchor="end">
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        <path d={area} fill={`url(#gA${uid})`} />
        <path d={area} fill={`url(#gH${uid})`} clipPath={`url(#cH${uid})`} />
        <path d={line} fill="none" stroke="#d8ff6a" strokeWidth="2.6" strokeLinecap="round" filter={`url(#glow${uid})`} />
        <path d={line} fill="none" stroke="#ff5c5c" strokeWidth="2.8" strokeLinecap="round" clipPath={`url(#cH${uid})`} filter={`url(#glow${uid})`} />
        <line className="lim" x1={L} x2={W - R} y1={ly} y2={ly} />
        <rect x={narrow ? L + 4 : W - R - 92} y={ly - 24} width="92" height="19" rx="9.5" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.18)" />
        <text className="limlab" x={narrow ? L + 50 : W - R - 46} y={ly - 10.5} textAnchor="middle">
          limit {fmtHours(limit)} h
        </text>
        {weekly.map((v, i) => {
          const hot = v > limit;
          const [px, py] = pts[i];
          const hol = holidays[String(i + 1)];
          const showVal = v > 0.1 && (!narrow || hot || i % 2 === 0);
          return (
            <g key={i}>
              {hot && <circle cx={px} cy={py} r="11" fill="#ff3b3b" opacity=".2" />}
              <circle cx={px} cy={py} r={active === i ? (hot ? 7 : 6) : hot ? 5 : 4} fill="#0b0b0c" stroke={hot ? "#ff5c5c" : "#d8ff6a"} strokeWidth="2.2" style={{ transition: "r .15s" }} />
              {showVal && (
                <text className={`val${hot ? " hot" : ""}`} x={px} y={py - 14} textAnchor="middle">
                  {Math.round(v)}
                </text>
              )}
              <text className={`axis${hol ? " hol" : ""}`} x={px} y={base + 24} textAnchor="middle">
                {narrow ? (i % 2 === 0 || hol ? `${i + 1}` : "") : `W${i + 1}${hol ? " ◆" : ""}`}
              </text>
            </g>
          );
        })}
        {weekly.map((_, i) => (
          <rect
            key={`h${i}`}
            ref={(el) => {
              hits.current[i] = el;
            }}
            className={`hit${active === i ? " on" : ""}`}
            x={x(i) - col / 2}
            y={T - 10}
            width={col}
            height={base - T + 34}
            rx="8"
            tabIndex={i === focusIdx ? 0 : -1}
            role="img"
            aria-label={tip(i)}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive((a) => (a === i ? null : a))}
            onFocus={() => {
              setActive(i);
              setFocusIdx(i);
            }}
            onBlur={() => setActive((a) => (a === i ? null : a))}
            onKeyDown={(e) => onKey(e, i)}
          />
        ))}
      </svg>
      <AnimatePresence>
        {active !== null && (
          <motion.div
            key="tip"
            role="presentation"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, left: `${(pts[active][0] / W) * 100}%`, top: `${(Math.min(pts[active][1], ly) / H) * 100}%` }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className="pointer-events-none absolute z-10 w-max max-w-[15rem] -translate-x-1/2 -translate-y-[calc(100%+1.6rem)] rounded-field border border-line-2 bg-[#17151f]/95 px-3 py-2 text-xs text-ink shadow-[0_20px_40px_-12px_rgba(0,0,0,.8)]"
          >
            <span className="font-mono font-semibold">W{active + 1}</span> <span className="text-ink-2">{tip(active).replace(/^Week \d+/, "").replace(/^, /, "").replace(/^: /, "")}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {!compact && (
        <figcaption className="mt-1.5 flex flex-wrap gap-x-4.5 gap-y-1.5 text-xs text-mute">
          <span>
            <i className="mr-1.5 inline-block h-[3px] w-[18px] rounded-bar bg-[#d8ff6a] align-[3px]" aria-hidden />
            Within the limit
          </span>
          <span>
            <i className="mr-1.5 inline-block h-[3px] w-[18px] rounded-bar bg-[#ff5c5c] align-[3px]" aria-hidden />
            Over the limit (crunch week)
          </span>
          {Object.keys(holidays).length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-hol">
              <Diamond size={12} aria-hidden /> Public holiday week
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

/** "At other limits: 24 h -> 3 crunch weeks ..." so the answer is not one assumption deep. */
export function SensitivityStrip({ sensitivity, limit }: { sensitivity: Record<string, number>; limit: number }) {
  const entries = Object.entries(sensitivity).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (!entries.length) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-mute">
      <span className="mr-1">At other limits:</span>
      {entries.map(([l, n]) => {
        const current = Number(l) === limit;
        return (
          <span key={l} className={`rounded-full border px-3 py-1 font-mono ${current ? "border-accent-2/50 bg-accent-2/10 text-ink" : "border-line text-ink-2"}`}>
            {l} h <span className="text-mute">→</span> {plural(n, "crunch week")}
          </span>
        );
      })}
    </div>
  );
}

interface HeatmapProps {
  modules: Module[];
  grid: Record<string, number[]>;
  weekly: number[];
  limit: number;
  holidays?: Record<string, string>;
  semesterStart?: string;
  assessments?: Assessment[] | null;
}

/** Module by week grid in the original style: heat cells with hours, assessment chips, hot-cell glow. */
export function Heatmap({ modules, grid, weekly, limit, holidays = {}, semesterStart, assessments }: HeatmapProps) {
  const weeks = weekly.length;
  const dueIn = (mod: string, w: number) => (assessments ?? []).filter((a) => a.mod === mod && a.due === w);
  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1.5 pt-1" tabIndex={0} role="region" aria-label="Hours per module per week (scrolls sideways on small screens)">
        <div role="table" aria-label="Hours per module per week" className="grid min-w-[53.75rem] gap-[5px] text-[0.78125rem]" style={{ gridTemplateColumns: `10rem repeat(${weeks}, minmax(3rem, 1fr))` }}>
          <div role="row" className="contents">
            <div role="columnheader" className="self-end pb-1 text-[0.6875rem] text-mute">
              Module
            </div>
            {weekly.map((_, i) => {
              const hol = holidays[String(i + 1)];
              return (
                <div role="columnheader" key={i} className="pb-1 text-center text-[0.6875rem] text-mute" title={hol}>
                  <b className={`block font-mono text-[0.71875rem] ${hol ? "text-hol" : "text-ink-2"}`}>W{i + 1}</b>
                  {semesterStart ? weekDate(semesterStart, i + 1) : ""}
                  {hol ? " ◆" : ""}
                </div>
              );
            })}
          </div>
          {modules.map((m) => (
            <div role="row" className="contents" key={m.id}>
              <div role="rowheader" className="flex min-w-0 flex-col justify-center pr-2">
                <b className="font-mono text-xs tracking-[0.02em] text-ink">{m.id}</b>
                <span className="truncate text-[0.71875rem] text-mute">
                  {m.name}, {m.credits} cr
                </span>
              </div>
              {(grid[m.id] ?? []).map((h, i) => {
                const due = dueIn(m.id, i + 1);
                const label = `${m.id} week ${i + 1}: ${fmtHours(h)} h${due.length ? `. Due: ${due.map((a) => `${a.title}${a.hidden ? " (hidden task from a brief)" : ""}${a.fixed ? " (date fixed)" : ""}`).join(", ")}` : ""}`;
                return (
                  <div role="cell" key={i} aria-label={label} title={label} className={`heat-cell${h >= 16 ? " hot" : ""}`} style={{ background: heatColor(h) }}>
                    {h > 0.1 && (
                      <span className="hrs" aria-hidden>
                        {Math.round(h)}
                      </span>
                    )}
                    {due.map((a) => (
                      <span key={a.id} className={`heat-chip${a.hidden ? " hidden-task" : ""}`} aria-hidden>
                        {a.title}
                        {a.fixed ? " (fixed)" : ""}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
          <div role="row" className="contents">
            <div role="rowheader" className="flex items-center font-mono text-xs font-semibold text-mute">
              Total
            </div>
            {weekly.map((h, i) => (
              <div role="cell" key={i} className={`pt-1 text-center font-mono text-[0.71875rem] ${h > limit ? "font-semibold text-crit" : "text-ink-2"}`} aria-label={`Week ${i + 1} total ${fmtHours(h)} h${h > limit ? ", over the limit" : ""}`}>
                {Math.round(h)}
                {h > limit && <span className="block text-[0.5625rem] uppercase tracking-wider">over</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3.5 text-xs text-mute">
        <span className="inline-flex items-center gap-1">
          light
          {[3, 7, 11, 15, 18].map((h) => (
            <i key={h} className="inline-block h-2.5 w-3.5 rounded-bar border border-white/[0.08]" style={{ background: heatColor(h) }} aria-hidden />
          ))}
          crunch
        </span>
        <span className="inline-flex items-center gap-1.5 text-hol">
          <i className="inline-block h-2.5 w-3.5 rounded-bar border-[1.5px] border-hol" aria-hidden /> hidden task found in a brief
        </span>
        <span>(fixed) = test date set by the exams unit</span>
      </div>
    </div>
  );
}
