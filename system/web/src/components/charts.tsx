import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { band, barValueLabel, chartTop, fmtHours, heatColor, heatStep, plural, weekTick } from "../lib/chart";
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

/** What the chart and the heat grid hand to the week overlay when a week is pressed. */
export type OpenWeek = (week: number, trigger: HTMLElement | SVGElement, mod?: string) => void;

interface LoadChartProps {
  weekly: number[];
  limit: number;
  holidays?: Record<string, string>;
  semesterStart?: string;
  compact?: boolean;
  title?: string;
  onOpenWeek?: OpenWeek;
}

/**
 * Weekly cohort load as plain bars, in the landing page's language: dusty violet within the limit,
 * coral over it, a thin dashed limit line, value labels above, week labels below with a sky dot
 * for public-holiday weeks. Each bar is focusable (Left and Right move between weeks) and pressing
 * it opens the week overlay.
 */
export function LoadChart({ weekly, limit, holidays = {}, semesterStart, compact = false, title = "Weekly assignment load", onOpenWeek }: LoadChartProps) {
  const reduce = useReducedMotion();
  const [ref, W] = useWidth(1000);
  const narrow = W < 560;
  const H = compact ? 200 : narrow ? 240 : 300;
  const L = narrow ? 28 : 44;
  const R = narrow ? 6 : 16;
  const T = 28;
  const B = 40;
  const ih = H - T - B;
  const base = T + ih;
  const n = weekly.length;
  const ymax = chartTop(weekly, limit);
  const y = (v: number) => T + ih - (Math.max(0, v) / ymax) * ih;
  const slot = (i: number) => band(i, n, L, W - R, narrow ? 0.28 : 0.36);
  const ly = y(limit);
  const [active, setActive] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const hits = useRef<(SVGRectElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<SVGRectElement>, i: number) => {
    if ((e.key === "Enter" || e.key === " ") && onOpenWeek) {
      e.preventDefault();
      onOpenWeek(i + 1, e.currentTarget);
      return;
    }
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
    return `Week ${i + 1}${semesterStart ? `, from ${weekDate(semesterStart, i + 1)}` : ""}: about ${fmtHours(v)} h${v > limit ? `, ${fmtHours(v - limit)} h over the ${fmtHours(limit)} h limit` : ""}${hol ? `. ${hol}` : ""}`;
  };
  const limText = `limit ${fmtHours(limit)} h`;
  const limW = limText.length * 6.8 + 14;
  // The limit label sits over the emptiest end of the chart so it never covers a bar.
  const half = Math.ceil(n / 2);
  const leftLoad = Math.max(0, ...weekly.slice(0, Math.min(3, half)));
  const rightLoad = Math.max(0, ...weekly.slice(Math.max(half, n - 3)));
  const limX = leftLoad < rightLoad ? L + 4 : W - R - limW;

  return (
    <figure className="relative m-0" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart block h-auto w-full overflow-visible" role="group" aria-label={`${title}. Limit ${fmtHours(limit)} h. Use the arrow keys to move between weeks${onOpenWeek ? " and Enter to open a week" : ""}.`}>
        {[0, 1, 2, 3, 4].map((k) => {
          const v = (ymax * k) / 4;
          return (
            <g key={k} aria-hidden>
              {k > 0 && <line className="gridl" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />}
              <text className="axis" x={L - (narrow ? 6 : 10)} y={y(v) + 4} textAnchor="end">
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        <line className="base" x1={L} x2={W - R} y1={base + 0.5} y2={base + 0.5} aria-hidden />
        {weekly.map((v, i) => {
          const hot = v > limit;
          const { x, w, cx } = slot(i);
          const top = y(v);
          const hol = holidays[String(i + 1)];
          const val = barValueLabel(v);
          return (
            <g key={i} aria-hidden>
              {v > 0.05 && (
                <motion.rect
                  className={`bar${hot ? " hot" : ""}`}
                  x={x}
                  y={top}
                  width={w}
                  height={Math.max(0, base - top)}
                  rx={Math.min(3, w / 4)}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.6, delay: reduce ? 0 : 0.04 * i }}
                  style={{ originY: 1, originX: 0.5 }}
                />
              )}
              {val && (
                <motion.text
                  className={`val${hot ? " hot" : ""}`}
                  x={cx}
                  y={top - 7}
                  textAnchor="middle"
                  style={narrow ? { fontSize: 10 } : undefined}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: reduce ? 0 : 0.3 + 0.04 * i }}
                >
                  {val}
                </motion.text>
              )}
              <text className={`axis${hol ? " hol" : ""}`} x={cx} y={base + 18} textAnchor="middle">
                {weekTick(i, narrow, hot || !!hol)}
              </text>
              {hol && <circle className="holdot" cx={cx} cy={base + 29} r={2.6} />}
            </g>
          );
        })}
        <g aria-hidden>
          <line className="lim" x1={L} x2={W - R} y1={ly} y2={ly} />
          <rect x={limX} y={ly - 22} width={limW} height={18} rx={9} fill="var(--color-bg)" stroke="var(--color-line-2)" />
          <text className="limlab" x={limX + limW / 2} y={ly - 9} textAnchor="middle">
            {limText}
          </text>
        </g>
        {weekly.map((_, i) => {
          const { x, w } = slot(i);
          const pad = narrow ? 2 : Math.min(8, w * 0.3);
          return (
            <rect
              key={`h${i}`}
              ref={(el) => {
                hits.current[i] = el;
              }}
              className={`hit${active === i ? " on" : ""}`}
              x={x - pad}
              y={T - 14}
              width={w + pad * 2}
              height={base - T + 36}
              rx="6"
              tabIndex={i === focusIdx ? 0 : -1}
              role={onOpenWeek ? "button" : "img"}
              aria-label={`${tip(i)}${onOpenWeek ? ". Press to see the week." : ""}`}
              data-week={i + 1}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive((a) => (a === i ? null : a))}
              onFocus={() => {
                setActive(i);
                setFocusIdx(i);
              }}
              onBlur={() => setActive((a) => (a === i ? null : a))}
              onKeyDown={(e) => onKey(e, i)}
              onClick={(e) => onOpenWeek?.(i + 1, e.currentTarget)}
            />
          );
        })}
      </svg>
      <AnimatePresence>
        {active !== null && (
          <motion.div
            key="tip"
            role="presentation"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, left: `${(Math.min(Math.max(slot(active).cx, 90), W - 90) / W) * 100}%`, top: `${(Math.min(y(weekly[active]), ly) / H) * 100}%` }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className="pointer-events-none absolute z-10 w-max max-w-[15rem] -translate-x-1/2 -translate-y-[calc(100%+1.4rem)] rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-xs text-ink shadow-[0_20px_40px_-12px_rgba(0,0,0,.8)]"
          >
            <span className="font-mono font-semibold">W{active + 1}</span> <span className="text-ink-2">{tip(active).replace(/^Week \d+/, "").replace(/^, /, "").replace(/^: /, "")}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {!compact && (
        <figcaption className="mt-2 flex flex-wrap gap-x-4.5 gap-y-1.5 text-xs text-mute">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-[2px] bg-accent-2" aria-hidden />
            Within the limit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-[2px] bg-crit" aria-hidden />
            Over the limit
          </span>
          {Object.keys(holidays).length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block size-[5px] rounded-full bg-hol" aria-hidden />
              Public holiday week
            </span>
          )}
          {onOpenWeek && <span className="text-mute">Press a bar to see the week.</span>}
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
          <span key={l} className={`rounded-full border px-3 py-1 font-mono ${current ? "border-accent/50 bg-accent/10 text-ink" : "border-line text-ink-2"}`}>
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
  onOpenWeek?: OpenWeek;
}

/**
 * Module by week grid. Cells step through an indigo ramp; coral appears only in the Total row,
 * for weeks over the limit. Week headers and cells are buttons that open the week overlay.
 */
export function Heatmap({ modules, grid, weekly, limit, holidays = {}, semesterStart, assessments, onOpenWeek }: HeatmapProps) {
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
              const date = semesterStart ? weekDate(semesterStart, i + 1) : "";
              const inner = (
                <>
                  <b className={`block font-mono text-[0.71875rem] ${hol ? "text-hol" : "text-ink-2"}`}>W{i + 1}</b>
                  {date}
                  {hol && <i className="mx-auto mt-0.5 block size-[5px] rounded-full bg-hol" aria-hidden />}
                </>
              );
              return (
                <div role="columnheader" key={i} className="pb-1" title={hol}>
                  {onOpenWeek ? (
                    <button type="button" className="heat-head pressable" data-week={i + 1} aria-label={`Open week ${i + 1}${date ? `, from ${date}` : ""}${hol ? `, ${hol}` : ""}`} onClick={(e) => onOpenWeek(i + 1, e.currentTarget)}>
                      {inner}
                    </button>
                  ) : (
                    <div className="heat-head">{inner}</div>
                  )}
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
                const lv = heatStep(h);
                const body = (
                  <>
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
                  </>
                );
                return (
                  <div role="cell" key={i} className="flex">
                    {onOpenWeek ? (
                      <button type="button" className={`heat-cell lv${lv} pressable`} style={{ background: heatColor(h) }} aria-label={`${label}. Open week ${i + 1}.`} title={label} data-week={i + 1} data-mod={m.id} onClick={(e) => onOpenWeek(i + 1, e.currentTarget, m.id)}>
                        {body}
                      </button>
                    ) : (
                      <div className={`heat-cell lv${lv}`} style={{ background: heatColor(h) }} aria-label={label} title={label}>
                        {body}
                      </div>
                    )}
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
          {[2, 6, 10, 14, 18].map((h) => (
            <i key={h} className="inline-block h-2.5 w-3.5 rounded-bar border border-line" style={{ background: heatColor(h) }} aria-hidden />
          ))}
          heavy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono font-semibold text-crit">OVER</span> = week total over the limit
        </span>
        <span className="inline-flex items-center gap-1.5 text-hol">
          <i className="inline-block h-2.5 w-3.5 rounded-bar border-[1.5px] border-hol" aria-hidden /> hidden task found in a brief
        </span>
        <span>(fixed) = test date set by the exams unit</span>
        {onOpenWeek && <span>Press a week or a cell to see that week.</span>}
      </div>
    </div>
  );
}
