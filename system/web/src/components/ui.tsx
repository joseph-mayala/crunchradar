import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { CheckCircle, Info, Warning, WarningCircle } from "@phosphor-icons/react";
import type { Tone, TagSpec } from "../lib/status";
import { useSession } from "../session";
import { BrandMark } from "./BrandMark";

/** House spring: critically damped, no overshoot. */
export const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

// Tag colours from the original prototype (.tag.*, .badge-live, .badge-rules).
const TONE: Record<Tone, string> = {
  good: "text-good border-good/30 bg-good/10",
  warn: "text-warn border-warn/30 bg-warn/12",
  crit: "text-crit border-crit/30 bg-crit/12",
  mute: "text-ink-2 border-line-2 bg-tint",
  info: "text-accent-2 border-accent-2/40 bg-accent-2/15",
  hol: "text-hol border-hol/25 bg-hol/10",
};

export function Tag({ spec, className = "" }: { spec: TagSpec; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[0.65625rem] font-bold uppercase leading-tight tracking-[0.08em] ${TONE[spec.tone]} ${spec.brand ? "gap-1.5 !bg-surface-2 py-[2px] pl-[5px]" : ""} ${className}`}>
      {spec.brand && <BrandMark brand={spec.brand} size={14} />}
      {spec.label}
    </span>
  );
}

export function Card({ title, sub, actions, children, className = "", id }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${className}`} id={id} aria-labelledby={id && title ? `${id}-h` : undefined}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={id ? `${id}-h` : undefined} className="text-[1.25rem] font-bold">
                {title}
              </h2>
            )}
            {sub && <p className="mt-1 max-w-[70ch] text-[0.84375rem] leading-relaxed text-mute">{sub}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} | CrunchRadar`;
  }, [title]);
  return (
    <header className="mb-6 grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] font-bold sm:text-[2.25rem]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatTile({ label, value, unit, tone = "ink", note }: { label: string; value: ReactNode; unit?: string; tone?: "ink" | "crit" | "warn" | "good"; note?: string }) {
  const color = { ink: "text-ink", crit: "text-crit", warn: "text-warn", good: "text-good" }[tone];
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div className={`v ${color}`}>
        {value} {unit && <small>{unit}</small>}
      </div>
      {note && <div className="mt-1.5 text-xs text-mute">{note}</div>}
    </div>
  );
}

/* ---------- Skeletons shaped like the final layout ---------- */

function Bone({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export type SkeletonShape = "list" | "overview" | "form" | "public" | "cards";

export function Loading({ label = "Loading", shape = "list", rows = 4 }: { label?: string; shape?: SkeletonShape; rows?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {shape === "overview" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="stat">
                <Bone className="h-3 w-24" />
                <Bone className="mt-3 h-8 w-16" />
                <Bone className="mt-3 h-3 w-28" />
              </div>
            ))}
          </div>
          <div className="card">
            <Bone className="h-5 w-56" />
            <Bone className="mt-3 h-3 w-3/4" />
            <div className="mt-6 grid h-56 items-end gap-2" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
              {[3, 3, 14, 18, 30, 36, 70, 34, 52, 78, 100, 32, 3, 3].map((h, i) => (
                <div key={i} className="skeleton w-full !rounded-cell" style={{ height: `${h}%` }} aria-hidden />
              ))}
            </div>
          </div>
        </div>
      ) : shape === "form" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i}>
              <Bone className="h-3.5 w-24" />
              <Bone className="mt-2 h-10 w-full" />
            </div>
          ))}
        </div>
      ) : shape === "public" ? (
        <div className="card">
          <Bone className="h-5 w-36" />
          <Bone className="mt-5 h-9 w-4/5" />
          <Bone className="mt-2 h-9 w-3/5" />
          <Bone className="mt-5 h-3.5 w-full" />
          <Bone className="mt-2 h-3.5 w-11/12" />
          <div className="mt-6 flex gap-3">
            <Bone className="h-11 w-32 !rounded-full" />
            <Bone className="h-11 w-28 !rounded-full" />
          </div>
        </div>
      ) : shape === "cards" ? (
        <div className="space-y-4">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="card">
              <Bone className="h-4 w-1/3" />
              <Bone className="mt-2 h-3 w-1/2" />
              <Bone className="mt-4 h-20 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-line/70">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="grid gap-2 py-4 first:pt-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_8rem] md:gap-4">
              <div>
                <Bone className="h-4 w-3/4" />
                <Bone className="mt-2 h-3 w-1/2" />
              </div>
              <div>
                <Bone className="h-3 w-full" />
                <Bone className="mt-2 h-3 w-4/5" />
              </div>
              <Bone className="h-5 w-24 !rounded-full md:justify-self-end" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Feedback: status, completion, warning, error ---------- */

export function ErrorBox({ error, onRetry, title = "Could not load this." }: { error: unknown; onRetry?: () => void; title?: string }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="flex gap-3 rounded-inset border border-line-2 bg-surface-2 p-4 text-sm">
      <WarningCircle size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-ink-2">{msg}</p>
        {onRetry && (
          <button type="button" className="btn-ghost btn-sm mt-3" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function Done({ children }: { children: ReactNode }) {
  return (
    <motion.div role="status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="flex gap-3 rounded-inset border border-good/40 bg-good/[0.06] px-4 py-3 text-sm text-ink">
      <CheckCircle size={20} className="mt-px shrink-0 text-good" aria-hidden />
      <div className="min-w-0">{children}</div>
    </motion.div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-inset border border-dashed border-line-2 px-4 py-6 text-center text-[0.84375rem] text-mute">{children}</div>;
}

/** Note: info (who decides, what happens next) or warn (assumption, a person is needed). */
export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  const Icon = tone === "warn" ? Warning : Info;
  return (
    <div className={`guard flex gap-3 leading-relaxed ${tone === "warn" ? "warn" : ""}`}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${tone === "warn" ? "text-warn" : "text-accent"}`} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

/** Fade content in once it has loaded (opacity only, so reduced motion is the same). */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

/** Form field: label above, help text, inline error below. */
export function Field({ label, help, error, htmlFor, children, className = "" }: { label: string; help?: ReactNode; error?: string | null; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="field-label">
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${htmlFor}-err`} className="field-error" role="alert">
          {error}
        </span>
      ) : help ? (
        <span id={`${htmlFor}-help`} className="field-help">
          {help}
        </span>
      ) : null}
    </div>
  );
}

/** aria-describedby for a Field's control. */
export const describedBy = (id: string, error?: string | null, help?: unknown) => (error ? `${id}-err` : help ? `${id}-help` : undefined);

export function SampleBadge() {
  const { session } = useSession();
  if (!session?.sample_data) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border border-warn/40 bg-warn/10 px-3 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-warn"
      title="The numbers are sample data, not a real cohort calendar."
    >
      Sample data
    </span>
  );
}
