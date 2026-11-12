import { useState, type FormEvent } from "react";
import { api } from "../api";
import { Card, describedBy, Empty, ErrorBox, Field, Mono, Note, PageHeader, Tag } from "../components/ui";
import { fmtHours } from "../lib/chart";
import { modeBadge } from "../lib/status";
import { weekDate, weekRange } from "../lib/weeks";
import { useSession } from "../session";
import { useData } from "../useData";
import type { BriefReaderResult, Draft, PrePublishResult, TaskType } from "../types";

const TYPES: { v: TaskType; label: string }[] = [
  { v: "code", label: "Coding" },
  { v: "report", label: "Report" },
  { v: "presentation", label: "Presentation" },
  { v: "test", label: "Test" },
  { v: "quiz", label: "Quiz" },
  { v: "logbook", label: "Lab logbook" },
];

const SAMPLE_BRIEF =
  "Students work in groups of four to build a booking system worth 40% of the module, due in Week 9. Each group demos their system to the lecturer in Week 10. A 2,000-word individual reflective report is due in Week 10.";

export function CheckPage() {
  const { session } = useSession();
  const ov = useData(() => api.overview().catch(() => null));
  const weeks = session?.weeks ?? 14;
  const [draft, setDraft] = useState<Draft>({ mod: "CCP", title: "Lab project", type: "code", weight: 30, words: 0, group: false, due: 9 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [res, setRes] = useState<PrePublishResult | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.prePublish(draft));
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const errors = {
    title: draft.title.trim() ? null : "Add a title.",
    weight: Number.isFinite(draft.weight) && draft.weight >= 0 && draft.weight <= 100 ? null : "Use 0 to 100.",
    words: Number.isFinite(draft.words) && draft.words >= 0 && draft.words <= 50000 ? null : "Use 0 to 50,000.",
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const modules = ov.data?.modules ?? [];
  const tag = (w: number) => [session?.holidays?.[String(w)] && "holiday", session?.protected_weeks?.includes(w) && "revision"].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader title="Check a deadline" sub="For lecturers, before a deadline goes live. Fill in what the brief says and see the cohort's load in that week. The lecturer still sets the date." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="draft" title="The new assignment">
          <form onSubmit={submit} noValidate className="grid grid-cols-2 gap-x-3.5 gap-y-4">
            <Field label="Module" htmlFor="pp-mod" className="col-span-2 sm:col-span-1">
              {modules.length ? (
                <select id="pp-mod" className="field" value={draft.mod} onChange={(e) => set("mod", e.target.value)}>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}: {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input id="pp-mod" className="field" value={draft.mod} onChange={(e) => set("mod", e.target.value.toUpperCase())} />
              )}
            </Field>
            <Field label="Title" htmlFor="pp-title" error={errors.title} help="As students will see it." className="col-span-2 sm:col-span-1">
              <input id="pp-title" className="field" value={draft.title} aria-invalid={!!errors.title} aria-describedby={describedBy("pp-title", errors.title, true)} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Type" htmlFor="pp-type" className="col-span-2 sm:col-span-1">
              <select id="pp-type" className="field" value={draft.type} onChange={(e) => set("type", e.target.value as TaskType)}>
                {TYPES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due week" htmlFor="pp-due" help={tag(draft.due) ? `Week ${draft.due} is a ${tag(draft.due)} week.` : "Monday date in brackets."} className="col-span-2 sm:col-span-1">
              <select id="pp-due" className="field" value={draft.due} aria-describedby="pp-due-help" onChange={(e) => set("due", Number(e.target.value))}>
                {weekRange(weeks).map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                    {session ? ` (${weekDate(session.semester_start, w)})` : ""}
                    {tag(w) ? `, ${tag(w)}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Weighting %" htmlFor="pp-weight" error={errors.weight} help="Share of the module mark.">
              <input id="pp-weight" className="field font-mono" type="number" inputMode="numeric" value={Number.isFinite(draft.weight) ? draft.weight : ""} aria-invalid={!!errors.weight} aria-describedby={describedBy("pp-weight", errors.weight, true)} onChange={(e) => set("weight", e.target.value === "" ? NaN : Number(e.target.value))} />
            </Field>
            <Field label="Word count" htmlFor="pp-words" error={errors.words} help="0 if not a written task.">
              <input id="pp-words" className="field font-mono" type="number" inputMode="numeric" step={100} value={Number.isFinite(draft.words) ? draft.words : ""} aria-invalid={!!errors.words} aria-describedby={describedBy("pp-words", errors.words, true)} onChange={(e) => set("words", e.target.value === "" ? NaN : Number(e.target.value))} />
            </Field>
            <label className="col-span-2 flex items-center gap-2.5 text-sm text-ink">
              <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={draft.group} onChange={(e) => set("group", e.target.checked)} />
              Group work
            </label>
            <div className="col-span-2">
              <button type="submit" className="btn-primary" disabled={busy || hasErrors} aria-busy={busy}>
                {busy ? "Checking" : "Check this week"}
              </button>
            </div>
          </form>
        </Card>
        <Card id="result" title="Result">
          <div aria-live="polite">
            {err != null ? <ErrorBox error={err} title="The check did not run." /> : res ? <PreResult r={res} /> : <Empty>Fill in the draft and press "Check this week". The answer comes back before students see the deadline.</Empty>}
          </div>
        </Card>
      </div>
      <div className="mt-6">
        <BriefReader />
      </div>
    </>
  );
}

function PreResult({ r }: { r: PrePublishResult }) {
  return (
    <div className="space-y-4">
      <div className={`result ${r.over_limit ? "bad" : "ok"}`}>
        <Tag spec={r.over_limit ? { label: "Over the limit", tone: "crit" } : { label: "Fits", tone: "good" }} />
        <h3 className="mt-2 text-lg font-bold">
          {r.over_limit ? `Week ${r.worst_week} would hit ${fmtHours(r.worst_hours)} h` : `Week ${r.worst_week} stays at ${fmtHours(r.worst_hours)} h`}
        </h3>
        <p className="mt-0.5 text-sm text-ink-2">
          From {fmtHours(r.before_hours)} h today, against a {fmtHours(r.limit)} h limit.
        </p>
      </div>
      <div>
        <h3 className="mb-1.5 text-sm font-semibold">This task: about {fmtHours(r.hours)} h</h3>
        <ul className="space-y-0.5 font-mono text-xs text-ink-2">
          {r.why.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>
      {r.lightest_weeks.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">Lightest weeks nearby</h3>
          <ul className="flex flex-wrap gap-2">
            {r.lightest_weeks.map((w) => (
              <li key={w.week} className={`rounded-full border px-3 py-1 font-mono text-xs ${w.peak > r.limit ? "border-line-2 text-ink-2" : "border-accent-2/50 text-ink"}`}>
                Week {w.week} <span className="text-mute">→</span> {fmtHours(w.peak)} h
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.brief_problems.length > 0 && (
        <Note tone="warn">
          <b className="text-ink">Brief gaps:</b> {r.brief_problems.join(" ")}
        </Note>
      )}
      <p className="text-xs text-mute">This check changes nothing. The lecturer picks the date.</p>
    </div>
  );
}

function BriefReader() {
  const [text, setText] = useState(SAMPLE_BRIEF);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [res, setRes] = useState<BriefReaderResult | null>(null);

  const read = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.briefReader(text));
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };
  const badge = res ? modeBadge(res.mode) : null;

  return (
    <Card
      id="brief"
      title="Read a brief"
      sub="Paste an assignment brief. The reader lists every task, including ones not in the calendar, and compares the formula estimate with the model's estimate."
      actions={badge ? <Tag spec={badge} /> : undefined}
    >
      <form onSubmit={read} className="space-y-3">
        <Field label="Brief text" htmlFor="brief-text" help="Paste the whole brief. Nothing is saved or sent to students.">
          <textarea id="brief-text" className="field min-h-32 resize-y text-sm leading-relaxed" value={text} aria-describedby="brief-text-help" onChange={(e) => setText(e.target.value)} />
        </Field>
        <button type="submit" className="btn-ghost" disabled={busy || !text.trim()}>
          {busy ? "Reading" : "Read brief"}
        </button>
      </form>
      <div className="mt-5" aria-live="polite">
        {err != null && <ErrorBox error={err} title="The brief was not read." />}
        {res && (
          <>
            <p className="mb-3 text-xs text-mute">{res.note}</p>
            {res.tasks.length ? (
              <>
              <ul className="space-y-3 sm:hidden">
                {res.tasks.map((t, i) => (
                  <li key={i} className="inset-box p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-ink">{t.title}</span>
                      {t.week == null ? <Tag spec={{ label: "No week", tone: "warn" }} /> : <Tag spec={t.over_limit ? { label: "Over", tone: "crit" } : { label: "Fits", tone: "good" }} />}
                    </div>
                    <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
                      <div><dt className="text-mute">Formula</dt><dd className="text-ink-2">{fmtHours(t.formula_hours)} h</dd></div>
                      <div><dt className="text-mute">Model</dt><dd className="text-ink">{fmtHours(t.hours)} h</dd></div>
                      <div><dt className="text-mute">Cohort {t.week ? `W${t.week}` : ""}</dt><dd className="text-ink-2">{t.cohort_hours_that_week == null ? "n/a" : `${fmtHours(t.cohort_hours_that_week)} h`}</dd></div>
                    </dl>
                    <p className="mt-2 text-xs text-mute">{Array.isArray(t.why) ? t.why.join(" ") : t.why}</p>
                  </li>
                ))}
              </ul>
              <div className="-mx-1 hidden overflow-x-auto px-1 sm:block">
                <table className="data-table min-w-[620px]">
                  <thead>
                    <tr>
                      <th scope="col">Task</th>
                      <th scope="col">Week</th>
                      <th scope="col" className="text-right">Formula</th>
                      <th scope="col" className="text-right">Model</th>
                      <th scope="col" className="text-right">Cohort that week</th>
                      <th scope="col">Load</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.tasks.map((t, i) => (
                      <tr key={i}>
                        <td>
                          <div className="font-medium text-ink">{t.title}</div>
                          <div className="mt-0.5 text-xs text-mute">{Array.isArray(t.why) ? t.why.join(" ") : t.why}</div>
                        </td>
                        <td>
                          <Mono>{t.week ? `W${t.week}` : "?"}</Mono>
                        </td>
                        <td className="whitespace-nowrap text-right">
                          <Mono>{fmtHours(t.formula_hours)} h</Mono>
                        </td>
                        <td className="whitespace-nowrap text-right">
                          <Mono className="text-ink">{fmtHours(t.hours)} h</Mono>
                        </td>
                        <td className="whitespace-nowrap text-right">
                          <Mono>{t.cohort_hours_that_week == null ? "n/a" : `${fmtHours(t.cohort_hours_that_week)} h`}</Mono>
                        </td>
                        <td>{t.week == null ? <Tag spec={{ label: "No week", tone: "warn" }} /> : <Tag spec={t.over_limit ? { label: "Over", tone: "crit" } : { label: "Fits", tone: "good" }} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : (
              <Empty>No tasks found in this text.</Empty>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
