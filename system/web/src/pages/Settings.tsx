import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { LoadChart } from "../components/charts";
import { Card, ErrorBox, Loading, Mono, Note, PageHeader, Tag } from "../components/ui";
import { fmtHours, plural } from "../lib/chart";
import { useSession } from "../session";
import { useData } from "../useData";
import type { Assumptions, AssumptionsUpdate, TaskType } from "../types";

const TYPE_LABEL: Record<TaskType, string> = { code: "Coding", report: "Report", presentation: "Presentation", test: "Test", quiz: "Quiz", logbook: "Lab logbook" };
const ASSUMPTION = { label: "Assumption", tone: "warn" } as const;

export function SettingsPage() {
  const { session, refresh } = useSession();
  const asm = useData(() => api.assumptions());
  const ov = useData(() => api.overview());
  const [form, setForm] = useState<Assumptions | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    if (asm.data && !form) setForm(asm.data);
  }, [asm.data, form]);

  // No debounce on the input path: each valid change is sent at once; older replies are ignored.
  const seq = useRef(0);
  const [undo, setUndo] = useState<Assumptions | null>(null);
  const send = async (call: () => Promise<Assumptions>, replace = false) => {
    const mine = ++seq.current;
    setSaving("saving");
    try {
      const next = await call();
      if (mine !== seq.current) return;
      setForm((f) => (replace || !f ? next : { ...f, limit: next.limit, slt_per_week: next.slt_per_week, limit_source: next.limit_source }));
      setErr(null);
      setSaving("saved");
      ov.reload();
      void refresh();
    } catch (e) {
      if (mine !== seq.current) return;
      setErr(e);
      setSaving("idle");
    }
  };
  const save = (body: AssumptionsUpdate) => {
    setUndo(null);
    void send(() => api.putAssumptions(body));
  };

  const setNum = (k: "classes_h" | "revision_h", v: number) => {
    if (!form) return;
    setForm({ ...form, [k]: v });
    if (Number.isFinite(v) && v >= 0 && v <= 40) save({ [k]: v });
  };
  const setBase = (k: TaskType, v: number) => {
    if (!form) return;
    setForm({ ...form, base: { ...form.base, [k]: v } });
    if (Number.isFinite(v) && v >= 0.5 && v <= 40) save({ base: { [k]: v } });
  };
  const reset = () => {
    if (form) setUndo(form);
    void send(() => api.resetAssumptions(), true);
  };
  const undoReset = () => {
    if (!undo) return;
    const prev = undo;
    setUndo(null);
    setForm(prev);
    void send(() => api.putAssumptions({ classes_h: prev.classes_h, revision_h: prev.revision_h, base: prev.base }), true);
  };

  const computed = form ? Math.round(form.slt_per_week - form.classes_h - form.revision_h) : 0;

  return (
    <>
      <PageHeader
        title="Limit and assumptions"
        sub="The 40 hours per credit is the rule. Everything else here is a team estimate and is shown as one. Changes apply to every calculation straight away."
        actions={
          <span className="font-mono text-xs text-mute" aria-live="polite">
            {saving === "saving" ? "Saving" : saving === "saved" ? "Saved" : ""}
          </span>
        }
      />
      {err != null && (
        <div className="mb-4">
          <ErrorBox error={err} title="That change was not saved." />
        </div>
      )}
      {asm.loading && !form ? (
        <div className="card"><Loading shape="form" rows={6} label="Loading assumptions" /></div>
      ) : asm.error ? (
        <ErrorBox error={asm.error} onRetry={asm.reload} />
      ) : form ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <Card id="limit" title="How the limit is set">
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2.5 text-sm">
                <dt className="text-ink-2">Credits this semester</dt>
                <dd className="text-right font-mono text-ink">{form.credits}</dd>
                <dt className="text-ink-2">Learning time (40 h per credit over {form.weeks} weeks)</dt>
                <dd className="text-right font-mono text-ink">{fmtHours(form.slt_per_week)} h/wk</dd>
                <dt className="text-ink-2">
                  <label htmlFor="classes">Minus classes</label> <Tag spec={ASSUMPTION} className="ml-1 align-middle" />
                </dt>
                <dd className="text-right">
                  <NumInput id="classes" value={form.classes_h} min={0} max={40} step={1} onChange={(v) => setNum("classes_h", v)} suffix="h/wk" />
                </dd>
                <dt className="text-ink-2">
                  <label htmlFor="revision">Minus revision and reading</label> <Tag spec={ASSUMPTION} className="ml-1 align-middle" />
                </dt>
                <dd className="text-right">
                  <NumInput id="revision" value={form.revision_h} min={0} max={40} step={1} onChange={(v) => setNum("revision_h", v)} suffix="h/wk" />
                </dd>
                <div className="col-span-2 border-t border-line" aria-hidden />
                <dt className="font-semibold text-ink">Assignment work limit</dt>
                <dd className="text-right font-mono text-lg font-semibold text-ink">{fmtHours(form.limit_source === "computed" ? computed : form.limit)} h/wk</dd>
              </dl>
              {form.limit_source === "env" && (
                <div className="mt-4">
                  <Note tone="warn">
                    The server sets the limit to <Mono>{fmtHours(form.limit)} h</Mono> from its configuration, so the computed {computed} h is shown for reference only.
                  </Note>
                </div>
              )}
              <p className="mt-4 text-xs text-mute">
                Source:{" "}
                <a href={form.source.url} target="_blank" rel="noopener noreferrer" className="link">
                  {form.source.title}
                </a>
              </p>
            </Card>
            <Card id="base" title="Base hours per task type" sub="Placeholders until a real cohort is surveyed. Words, weighting and group work add to these.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(Object.keys(TYPE_LABEL) as TaskType[]).map((k) => (
                  <div key={k}>
                    <label htmlFor={`base-${k}`} className="field-label">
                      {TYPE_LABEL[k]}
                    </label>
                    <NumInput id={`base-${k}`} value={form.base[k]} min={0.5} max={40} step={0.5} onChange={(v) => setBase(k, v)} suffix="h" wide />
                    <span className="field-help font-mono">{`Default ${form.base_default[k]} h`}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="button" className="btn-ghost btn-sm" onClick={reset}>
                  Reset to defaults
                </button>
                {undo && (
                  <span className="text-sm text-ink-2" role="status">
                    Reset done.{" "}
                    <button type="button" className="link pressable" onClick={undoReset}>
                      Undo
                    </button>
                  </span>
                )}
              </div>
            </Card>
          </div>
          <Card
            id="preview"
            title="What this does to the semester"
            sub={
              <>
                The same numbers the <Link to="/app" className="link">overview</Link> shows, recalculated after each change.
              </>
            }
            className="lg:sticky lg:top-32 lg:self-start"
          >
            {ov.error ? (
              <ErrorBox error={ov.error} onRetry={ov.reload} />
            ) : ov.data ? (
              <div className={ov.loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <p className="mb-3 text-sm text-ink-2">
                  Limit <Mono className="text-ink">{fmtHours(ov.data.limit)} h</Mono>,{" "}
                  <span className={ov.data.crunch_weeks ? "text-crit" : "text-good"}>{plural(ov.data.crunch_weeks, "crunch week")}</span>, peak{" "}
                  <Mono className="text-ink">{Math.round(ov.data.peak)} h</Mono>
                </p>
                <LoadChart weekly={ov.data.weekly_hours} limit={ov.data.limit} holidays={session?.holidays} compact title="Weekly load with these assumptions" />
              </div>
            ) : (
              <div className="skeleton h-48" role="status" aria-label="Loading the preview" />
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}

function NumInput({ id, value, min, max, step, onChange, suffix, wide = false }: { id?: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix: string; wide?: boolean }) {
  const invalid = !Number.isFinite(value) || value < min || value > max;
  const errId = id ? `${id}-err` : undefined;
  return (
    <span className={`inline-flex flex-col ${wide ? "w-full" : "items-end"}`}>
      <span className={`inline-flex items-center gap-1.5 ${wide ? "w-full" : ""}`}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className={`field py-1.5 text-right font-mono ${wide ? "w-full" : "w-20"}`}
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          aria-invalid={invalid}
          aria-describedby={invalid ? errId : undefined}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        />
        <span className="shrink-0 font-mono text-xs text-mute">{suffix}</span>
      </span>
      {invalid && (
        <span id={errId} className="field-error" role="alert">
          Use {min} to {max}. Not saved.
        </span>
      )}
    </span>
  );
}
