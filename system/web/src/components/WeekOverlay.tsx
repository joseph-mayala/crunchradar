/**
 * The week overlay: everything about one teaching week, from GET /api/week/{n}.
 * Opens with a spring from the element that was pressed and closes back into it. Under 768 px it is a
 * bottom sheet that slides up and can be dragged down to close. Focus is trapped inside and goes back
 * to the trigger on close. Left and Right arrows (and the two buttons) move between weeks.
 * Reduced motion gives a short cross-fade; reduced transparency gives a solid backdrop (index.css).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "motion/react";
import { CaretLeft, CaretRight, LockSimple, SealCheck, Warning, X } from "@phosphor-icons/react";
import { api } from "../api";
import { fmtHours, plural } from "../lib/chart";
import { TYPE_LABEL } from "../lib/model";
import { issueTag, proposalTag } from "../lib/status";
import { limitLine, moduleShares, sheetShouldClose, stepWeek, weekNotes, weekRangeLabel } from "../lib/weekDetail";
import type { WeekDetail, WeekRow } from "../types";
import { ErrorBox, Tag } from "./ui";

export interface WeekTarget {
  week: number;
  /** Module whose rows to highlight (set when a grid cell was pressed). */
  mod?: string;
  /** Centre of the pressed element, in viewport px. The overlay grows out of this point. */
  ox: number;
  oy: number;
}

function useMedia(query: string): boolean {
  const get = () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches;
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return m;
}

/** Fetches a week, keeping answers it has already seen so moving back and forth is instant. */
function useWeek(week: number) {
  const cache = useRef(new Map<number, WeekDetail>());
  const [state, setState] = useState<{ data: WeekDetail | null; error: unknown; loading: boolean }>({ data: cache.current.get(week) ?? null, error: null, loading: !cache.current.has(week) });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    const hit = cache.current.get(week);
    if (hit) {
      setState({ data: hit, error: null, loading: false });
      return;
    }
    setState({ data: null, error: null, loading: true });
    api
      .week(week)
      .then((d) => {
        cache.current.set(week, d);
        if (live) setState({ data: d, error: null, loading: false });
      })
      .catch((e) => live && setState({ data: null, error: e, loading: false }));
    return () => {
      live = false;
    };
  }, [week, nonce]);
  return { ...state, retry: () => setNonce((n) => n + 1) };
}

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function WeekOverlay({ target, weeks, onClose, onWeek }: { target: WeekTarget | null; weeks: number; onClose: () => void; onWeek: (w: number) => void }) {
  return <AnimatePresence>{target && <Panel key="week-overlay" target={target} weeks={weeks} onClose={onClose} onWeek={onWeek} />}</AnimatePresence>;
}

function Panel({ target, weeks, onClose, onWeek }: { target: WeekTarget; weeks: number; onClose: () => void; onWeek: (w: number) => void }) {
  const reduce = useReducedMotion();
  const sheet = useMedia("(max-width: 767px)");
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const drag = useDragControls();
  const { week, mod } = target;
  const res = useWeek(week);
  const go = useCallback((dir: -1 | 1) => onWeek(stepWeek(week, dir, weeks)), [onWeek, week, weeks]);

  // Keys: Escape closes, Tab stays inside, Left and Right move between weeks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        go(e.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      const inside = panel.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, go]);

  // First focus on the close button; lock the page scroll while open.
  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const spring = { type: "spring", bounce: 0.08, duration: 0.46 } as const;
  const hidden = reduce ? { opacity: 0 } : sheet ? { y: "100%" } : { opacity: 0, scale: 0.3, x: target.ox - vw / 2, y: target.oy - vh / 2 };
  const shown = reduce ? { opacity: 1 } : sheet ? { y: 0 } : { opacity: 1, scale: 1, x: 0, y: 0 };
  const transition = reduce ? { duration: 0.16 } : spring;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (sheetShouldClose(info.offset.y, info.velocity.y, panel.current?.offsetHeight ?? 600)) onClose();
  };

  const d = res.data;
  const range = d ? weekRangeLabel(d.starts, d.ends) : "";

  return (
    <div className={`fixed inset-0 z-50 flex ${sheet ? "items-end" : "items-center justify-center p-4"}`}>
      <motion.div className="overlay-scrim absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.12 : 0.22 }} onClick={onClose} aria-hidden />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="week-overlay-h"
        aria-describedby="week-overlay-sub"
        className={`week-panel relative flex flex-col overflow-hidden border border-line-2 bg-surface ${sheet ? "max-h-[90dvh] w-full rounded-t-[22px] border-b-0" : "max-h-[min(88dvh,54rem)] w-full max-w-[46rem] rounded-card"}`}
        initial={hidden}
        animate={shown}
        exit={hidden}
        transition={transition}
        drag={sheet && !reduce ? "y" : false}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={onDragEnd}
      >
        <header className={`shrink-0 border-b border-line px-5 pb-3 ${sheet ? "touch-none pt-2" : "pt-4"}`} onPointerDown={(e) => sheet && drag.start(e)}>
          {sheet && <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-2" aria-hidden />}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="week-overlay-h" className="text-[1.5rem] font-bold">
                Week {week}
              </h2>
              <p id="week-overlay-sub" className="mt-0.5 font-mono text-[0.8125rem] text-ink-2">
                {range || " "}
                {d?.holiday && <span className="ml-2 text-hol">{d.holiday}</span>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" className="btn-ghost !min-h-11 !min-w-11 !px-0" aria-label={`Previous week, week ${stepWeek(week, -1, weeks)}`} disabled={week <= 1} onClick={() => go(-1)}>
                <CaretLeft size={18} aria-hidden />
              </button>
              <button type="button" className="btn-ghost !min-h-11 !min-w-11 !px-0" aria-label={`Next week, week ${stepWeek(week, 1, weeks)}`} disabled={week >= weeks} onClick={() => go(1)}>
                <CaretRight size={18} aria-hidden />
              </button>
              <button ref={closeBtn} type="button" className="btn-ghost !min-h-11 !min-w-11 !px-0" aria-label="Close the week" onClick={onClose}>
                <X size={18} aria-hidden />
              </button>
            </div>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4" aria-live="polite" aria-busy={res.loading}>
          {res.loading ? (
            <Skeleton />
          ) : res.error ? (
            <ErrorBox error={res.error} onRetry={res.retry} title={`Could not load week ${week}.`} />
          ) : d ? (
            <motion.div key={d.week} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
              <Body d={d} mod={mod} onClose={onClose} />
            </motion.div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

function Skeleton() {
  return (
    <div role="status" className="space-y-5">
      <span className="sr-only">Loading the week</span>
      <div className="skeleton h-10 w-40" aria-hidden />
      <div className="skeleton h-3.5 w-56" aria-hidden />
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-14 w-full" aria-hidden />
      ))}
      <div className="skeleton h-24 w-full" aria-hidden />
    </div>
  );
}

function Section({ title, children, count }: { title: string; children: ReactNode; count?: number }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="label-caps mb-2.5 flex items-baseline gap-2">
        {title}
        {count !== undefined && <span className="font-mono normal-case tracking-normal text-mute">{count}</span>}
      </h3>
      {children}
    </section>
  );
}

function Row({ r, mod, building }: { r: WeekRow; mod?: string; building?: boolean }) {
  const on = !!mod && r.mod === mod;
  const meta = [TYPE_LABEL[r.type] ?? r.type, r.weight ? `${fmtHours(r.weight)}%` : null, r.group ? "group" : null, building ? `due Week ${r.due_week}` : null].filter(Boolean).join(", ");
  return (
    <li className={`rounded-inset border px-3.5 py-3 ${on ? "border-accent/60 bg-accent/[0.07]" : "border-line bg-tint"}`} data-mod={r.mod} data-selected={on || undefined}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-xs font-semibold text-accent-2">{r.mod}</span>
            <span className="font-semibold text-ink">{r.title}</span>
            {r.fixed && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                <LockSimple size={13} aria-hidden /> fixed test date
              </span>
            )}
            {r.hidden && <Tag spec={{ label: "found in a brief", tone: "hol" }} />}
            {on && <span className="text-xs font-semibold text-accent">the module you pressed</span>}
          </div>
          <p className="mt-0.5 text-xs text-mute">{meta}</p>
          {r.hidden && <blockquote className="mt-2 border-l-2 border-hol py-0.5 pl-2.5 text-[0.8125rem] text-ink-2">{r.hidden}</blockquote>}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[0.9375rem] font-semibold text-ink">{fmtHours(r.hours_this_week)} h</div>
          <div className="text-[0.6875rem] text-mute">this week, of {fmtHours(r.hours_total)} h</div>
        </div>
      </div>
    </li>
  );
}

function Body({ d, mod, onClose }: { d: WeekDetail; mod?: string; onClose: () => void }) {
  const lim = limitLine(d);
  const notes = weekNotes(d);
  const shares = moduleShares(d.modules);
  return (
    <>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div className="font-display text-[2.75rem] font-extrabold leading-none tracking-[-0.03em] text-ink">
          {fmtHours(d.hours)}
          <small className="ml-1 font-sans text-base font-medium text-mute">h of work</small>
        </div>
        <p className={`inline-flex items-center gap-1.5 pb-1 text-[0.9375rem] font-semibold ${lim.over ? "text-crit" : "text-good"}`}>
          {lim.over && <Warning size={16} aria-hidden />}
          {lim.text}
        </p>
      </div>
      {notes.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {notes.map((n) => (
            <li key={n} className="guard warn !py-2 text-[0.8125rem]">
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Section title="Due this week" count={d.due.length}>
          {d.due.length ? (
            <ul className="grid gap-2">
              {d.due.map((r) => (
                <Row key={r.id} r={r} mod={mod} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Nothing is due this week.</p>
          )}
        </Section>

        <Section title="Work building toward later deadlines" count={d.building.length}>
          {d.building.length ? (
            <ul className="grid gap-2">
              {d.building.map((r) => (
                <Row key={r.id} r={r} mod={mod} building />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">No work for later deadlines lands in this week.</p>
          )}
        </Section>

        <Section title="Hours by module">
          {shares.length ? (
            <>
              <ul className="grid gap-1.5" aria-label={`Hours by module, adding up to ${fmtHours(d.hours)} h`}>
                {shares.map((s) => {
                  const on = !!mod && s.mod === mod;
                  return (
                    <li key={s.mod} className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.75rem] items-center gap-2.5 text-[0.8125rem]">
                      <span className={`font-mono text-xs font-semibold ${on ? "text-accent" : "text-ink-2"}`}>{s.mod}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-tint" aria-hidden>
                        <span className={`block h-full rounded-full ${on ? "bg-accent" : "bg-accent-2"}`} style={{ width: `${Math.max(2, s.share * 100)}%` }} />
                      </span>
                      <span className="text-right font-mono text-ink">{fmtHours(s.hours)} h</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-mute">Adds up to {fmtHours(d.hours)} h across {plural(shares.length, "module")}.</p>
            </>
          ) : (
            <p className="text-sm text-mute">No module has work in this week.</p>
          )}
        </Section>

        <Section title="What the check noticed" count={d.issues.length}>
          {d.issues.length ? (
            <ul>
              {d.issues.map((x, i) => (
                <li key={i} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-line py-2 first:border-t-0 first:pt-0">
                  <Tag spec={issueTag(x.kind)} className="mt-0.5" />
                  <span className="min-w-0 flex-1 text-[0.84375rem] text-ink-2">{x.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Nothing to flag in this week.</p>
          )}
        </Section>

        <Section title="Moves touching this week" count={d.moves.length}>
          {d.moves.length ? (
            <ul className="grid gap-2">
              {d.moves.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-inset border border-line bg-tint px-3.5 py-2.5 text-sm">
                  <Tag spec={proposalTag(m.status)} />
                  <span className="text-ink">
                    Move <span className="font-mono text-accent-2">{m.mod}</span> {m.title} from Week {m.from_w} to Week {m.to_w}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">No move touches this week.</p>
          )}
          <p className="mt-2.5 text-sm">
            <Link to="/app/approvals" className="link inline-flex min-h-11 items-center gap-1.5" onClick={onClose}>
              <SealCheck size={14} aria-hidden /> Moves to approve
            </Link>
          </p>
        </Section>
      </div>
    </>
  );
}
