import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { Card, describedBy, Done, Empty, ErrorBox, Field, Loading, Mono, Note, Tag } from "../components/ui";
import { fmtHours } from "../lib/chart";
import { verdictTag } from "../lib/status";
import { weekDate, weekRange } from "../lib/weeks";
import { useSession } from "../session";
import { useData } from "../useData";
import type { ExtensionCreated, ExtensionReason, PulseResult, StudentDigest } from "../types";

function useStudentLink() {
  const [params, setParams] = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const weekRaw = params.get("week");
  const week = weekRaw ? Number(weekRaw) : undefined;
  const setWeek = (w: number) => {
    const n = new URLSearchParams(params);
    n.set("week", String(w));
    setParams(n, { replace: true });
  };
  return { email, token, week, setWeek };
}

function BadLink({ error }: { error?: unknown }) {
  const invalid = !error || (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404));
  if (!invalid) return <ErrorBox error={error} />;
  return (
    <Card>
      <h1 className="text-2xl font-extrabold">This student link is not valid</h1>
      <p className="mt-2 text-sm text-ink-2">Open the link from your latest CrunchRadar email. Each link belongs to one student, so it cannot be shared or typed by hand.</p>
    </Card>
  );
}

/** /student?email=&token=: the student's weekly digest. */
export function StudentPage() {
  const { email, token, week, setWeek } = useStudentLink();
  const { session } = useSession();
  const res = useData(() => (email && token ? api.student(email, token, week) : Promise.reject(new ApiError(403, "missing link"))), [email, token, week]);

  if (!email || !token) return <BadLink />;
  if (res.loading && !res.data) return <Loading shape="cards" rows={2} label="Loading your weeks" />;
  if (res.error) return <BadLink error={res.error} />;
  const d = res.data;
  if (!d) return null;
  const weeks = session?.weeks ?? 14;
  const extLink = `/student/extension?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

  return (
    <div className="space-y-6">
      <section aria-labelledby="digest-h" className="card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label-caps">Your Monday digest</div>
            <h1 id="digest-h" className="mt-1 text-[1.875rem] font-extrabold leading-tight sm:text-[2.25rem]">
              Week {d.week}: about {Math.round(d.hours)} h
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              of assignment work for your cohort{session ? `, week starting ${weekDate(session.semester_start, d.week)}` : ""}.{" "}
              {d.heavy ? (
                <span className="font-semibold text-crit">Heavy: over the {fmtHours(d.limit)} h limit.</span>
              ) : (
                <span className="text-accent">Within the {fmtHours(d.limit)} h limit.</span>
              )}
            </p>
          </div>
          <label className="block">
            <span className="field-label">Show week</span>
            <select className="field w-36" value={d.week} onChange={(e) => setWeek(Number(e.target.value))}>
              {weekRange(weeks).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-base font-bold">Due this week</h2>
            {d.due.length ? (
              <ul className="mt-2 divide-y divide-line/70">
                {d.due.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm">
                    <Mono className="text-xs text-accent-2">{a.mod}</Mono>
                    <span className="text-ink">{a.title}</span>
                    {a.hidden && <Tag spec={{ label: "From the brief", tone: "hol" }} />}
                    <Mono className="ml-auto text-xs text-mute">~{fmtHours(a.hours)} h</Mono>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-mute">Nothing due this week.</p>
            )}
          </div>
          <div>
            <h2 className="text-base font-bold">Start now</h2>
            {d.start_now.length ? (
              <ul className="mt-2 divide-y divide-line/70">
                {d.start_now.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm">
                    <Mono className="text-xs text-accent-2">{a.mod}</Mono>
                    <span className="text-ink">{a.title}</span>
                    <Mono className="text-xs text-mute">due W{a.due}</Mono>
                    <Mono className="ml-auto text-xs text-mute">~{fmtHours(a.hours_this_week)} h this week</Mono>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-mute">Nothing needs starting early this week.</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <MarksPerHour d={d} />
        <Pulse d={d} email={email} token={token} onDone={res.reload} />
      </div>

      <Card title="Need more time?" sub="Ask for an extension. CrunchRadar drafts an answer from the policy and the cohort load; a member of staff decides.">
        <Link to={extLink} className="btn-ghost">
          Request an extension
        </Link>
      </Card>
    </div>
  );
}

function MarksPerHour({ d }: { d: StudentDigest }) {
  const max = Math.max(0.01, ...d.marks_per_hour.map((m) => m.mph));
  return (
    <Card title="Marks per hour" sub="Open tasks, best return first: marks you can earn for each hour of work. Estimates, not grades.">
      {d.marks_per_hour.length ? (
        <ol className="space-y-3">
          {d.marks_per_hour.map((m, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <Mono className="text-xs text-accent-2">{m.mod}</Mono>
                <span className="text-ink">{m.title}</span>
                <Mono className="text-xs text-mute">
                  {m.weight}%, ~{fmtHours(m.hours)} h, due W{m.due}
                </Mono>
                <Mono className="ml-auto text-sm text-ink">{m.mph.toFixed(2)}</Mono>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.05]" aria-hidden>
                <div className="h-full rounded-full bg-accent-2" style={{ width: `${(m.mph / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>No open weighted tasks.</Empty>
      )}
    </Card>
  );
}

function Pulse({ d, email, token, onDone }: { d: StudentDigest; email: string; token: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<PulseResult | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const p = d.pulse;
  const share = Math.min(1, p.count / Math.max(p.cohort, 1));
  const reached = share >= p.threshold;
  const tap = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.pulse(email, token, d.week);
      setRes(r);
      if (r.ok) onDone();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const pct = Math.round(share * 100);
  const th = Math.round(p.threshold * 100);
  return (
    <Card title={`"Week ${d.week} is too much"`} sub={`One tap, anonymous. If ${th}% of the cohort taps, the programme leader is asked to look, even when the estimates look fine.`}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-2">
          <Mono className="text-ink">{p.count}</Mono> of <Mono>{p.cohort}</Mono> students
        </span>
        <Mono className={reached ? "font-semibold text-crit" : "text-warn"}>
          {pct}% {reached ? "· threshold reached" : `· alert at ${th}%`}
        </Mono>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-white/[0.06]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${pct}% of the cohort said this week is too much; the alert is at ${th}%`}>
        <div className={`h-full rounded-full ${reached ? "bg-crit" : "bg-warn"}`} style={{ width: `${pct}%` }} />
        <span className="absolute -top-1 h-[1.125rem] w-0.5 rounded-full bg-ink" style={{ left: `${th}%` }} aria-hidden />
      </div>
      <div className="mt-4" aria-live="polite">
        {p.mine || res?.ok ? (
          <Done>Thanks. Your response for Week {d.week} is counted.{res?.alerted ? " That reached the threshold, so the programme leader has been asked to look." : ""}</Done>
        ) : (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void tap()}>
            {busy ? "Sending" : `Week ${d.week} is too much`}
          </button>
        )}
        {res && !res.ok && <p className="mt-2 text-sm text-warn">{res.message}</p>}
        {err != null && <div className="mt-2"><ErrorBox error={err} title="Your response was not counted." /></div>}
      </div>
      <div className="mt-4">
        <Note tone="warn">
          <b className="text-ink">Spam safeguard.</b> Only someone with a student link can tap, once per week, and the response is stored hashed. The alert only asks the programme leader to look; it never moves a deadline by itself.
        </Note>
      </div>
    </Card>
  );
}

const REASONS: { v: ExtensionReason; label: string; hint: string }[] = [
  { v: "medical", label: "Medical", hint: "up to 7 days" },
  { v: "family", label: "Family", hint: "up to 5 days" },
  { v: "workload", label: "Workload", hint: "up to 3 days, only in a week over the limit" },
  { v: "other", label: "Something else", hint: "your lecturer decides" },
];

/** /student/extension?email=&token=: extension request form. */
export function StudentExtensionPage() {
  const { email, token } = useStudentLink();
  const digest = useData(() => (email && token ? api.student(email, token) : Promise.reject(new ApiError(403, "missing link"))), [email, token]);
  const [assess, setAssess] = useState("");
  const [days, setDays] = useState(3);
  const [reason, setReason] = useState<ExtensionReason>("workload");
  const [personal, setPersonal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [res, setRes] = useState<ExtensionCreated | null>(null);

  if (!email || !token) return <BadLink />;
  if (digest.loading && !digest.data) return <div className="card"><Loading shape="form" rows={4} label="Loading the request form" /></div>;
  if (digest.error) return <BadLink error={digest.error} />;
  const d = digest.data;
  if (!d) return null;

  const options = [...d.due.map((a) => ({ id: a.id, label: `${a.mod} ${a.title} (due W${d.week})` })), ...d.marks_per_hour.map((a) => ({ id: a.id, label: `${a.mod} ${a.title} (due W${a.due})` }))].filter(
    (o, i, all): o is { id: string; label: string } => !!o.id && all.findIndex((x) => x.id === o.id) === i,
  );
  const chosen = assess || options[0]?.id || "";
  const daysErr = Number.isInteger(days) && days >= 1 && days <= 14 ? null : "Use a whole number from 1 to 14.";
  const personalErr = Number.isFinite(personal) && personal >= 0 && personal <= 80 ? null : "Use 0 to 80.";
  const back = `/student?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.requestExtension({ email, token, assess_id: chosen, days, reason, personal_hours: personal }));
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  if (res) {
    return (
      <article className="card space-y-4">
        <Tag spec={{ label: "Sent for a decision", tone: "warn" }} />
        <h1 className="text-[1.75rem] font-extrabold leading-tight">Your request is with staff</h1>
        <p className="text-sm text-ink-2">CrunchRadar drafted this answer. It is not final until a member of staff approves it, and you will get an email either way.</p>
        <div className="inset-box p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tag spec={verdictTag(res.draft.verdict)} />
            {res.draft.days > 0 && <Mono className="text-sm text-ink">{res.draft.days} days</Mono>}
          </div>
          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-sm text-ink-2">
            {res.draft.why.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
        <Link to={back} className="link text-sm">
          Back to your digest
        </Link>
      </article>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="card space-y-5">
      <div>
        <h1 className="text-[1.75rem] font-extrabold leading-tight">Request an extension</h1>
        <p className="mt-1.5 text-sm text-ink-2">A member of staff decides. CrunchRadar only drafts an answer from the policy and how heavy the week is for your cohort.</p>
      </div>
      {options.length === 0 ? (
        <Empty>There are no open assessments on your link to extend.</Empty>
      ) : (
        <>
          <Field label="Assessment" htmlFor="ext-assess" help="Only assessments that are still open.">
            <select id="ext-assess" className="field" value={chosen} aria-describedby="ext-assess-help" onChange={(e) => setAssess(e.target.value)}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <fieldset>
            <legend className="field-label mb-2">Reason</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {REASONS.map((r) => (
                <label key={r.v} className={`flex cursor-pointer items-start gap-2.5 rounded-inset border px-3 py-2.5 text-sm transition-colors ${reason === r.v ? "border-accent-2/60 bg-accent-2/[0.07]" : "border-line-2 hover:border-mute"}`}>
                  <input type="radio" name="reason" value={r.v} checked={reason === r.v} onChange={() => setReason(r.v)} className="mt-1 accent-[#b3a1ff]" />
                  <span>
                    <span className="block font-medium text-ink">{r.label}</span>
                    <span className="block text-xs text-mute">{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Days needed" htmlFor="ext-days" error={daysErr} help="1 to 14 days.">
              <input id="ext-days" className="field font-mono" type="number" inputMode="numeric" value={Number.isFinite(days) ? days : ""} aria-invalid={!!daysErr} aria-describedby={describedBy("ext-days", daysErr, true)} onChange={(e) => setDays(e.target.value === "" ? NaN : Number(e.target.value))} />
            </Field>
            <Field label="Other work (h)" htmlFor="ext-personal" error={personalErr} help="Job or care hours that week.">
              <input id="ext-personal" className="field font-mono" type="number" inputMode="numeric" value={Number.isFinite(personal) ? personal : ""} aria-invalid={!!personalErr} aria-describedby={describedBy("ext-personal", personalErr, true)} onChange={(e) => setPersonal(e.target.value === "" ? NaN : Number(e.target.value))} />
            </Field>
          </div>
          {err != null && <ErrorBox error={err} title="Your request was not sent." />}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={busy || !chosen || !!daysErr || !!personalErr}>
              {busy ? "Sending" : "Send request"}
            </button>
            <Link to={back} className="link text-sm">
              Back to your digest
            </Link>
          </div>
          <p className="text-xs text-mute">Your email is stored hashed. Only staff handling extensions see the request.</p>
        </>
      )}
    </form>
  );
}
