import { useState } from "react";
import { api } from "../api";
import { Card, Empty, ErrorBox, Loading, Mono, PageHeader, Tag } from "../components/ui";
import { modeBadge, runTag } from "../lib/status";
import { fmtShort } from "../lib/weeks";
import { useData } from "../useData";

export function RunsPage() {
  const res = useData(() => api.runs(50));
  const [busy, setBusy] = useState<"follow" | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const trigger = async (which: "follow") => {
    setBusy(which);
    setErr(null);
    try {
      await api.followUp();
      res.reload();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Run history"
        sub="Every automated run, what started it, and which planner ran. GEMINI means the model planned the moves; RULES means the fixed rules did, because the model was off or failed."
        actions={
          <>
            <button type="button" className="btn-ghost btn-sm" onClick={() => void trigger("follow")} disabled={!!busy}>
              {busy === "follow" ? "Checking" : "Run follow-up"}
            </button>
          </>
        }
      />
      {err != null && (
        <div className="mb-4">
          <ErrorBox error={err} title="That run did not start." />
        </div>
      )}
      <Card>
        {res.loading && !res.data ? (
          <Loading shape="list" rows={5} label="Loading runs" />
        ) : res.error ? (
          <ErrorBox error={res.error} onRetry={res.reload} />
        ) : res.data && res.data.length ? (
          <ul className="divide-y divide-line/70">
            {res.data.map((r) => {
              const badge = modeBadge(r.mode);
              return (
                <li key={r.id} className="grid gap-2 py-3.5 first:pt-0 md:grid-cols-[13rem_9rem_minmax(0,1fr)] md:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{r.workflow}</span>
                      {badge && <Tag spec={badge} />}
                    </div>
                    {r.model && <Mono className="mt-0.5 block text-[0.6875rem] text-mute">{r.model}</Mono>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:block">
                    <Tag spec={runTag(r.status)} />
                    <div className="font-mono text-xs text-mute md:mt-1.5">{fmtShort(r.started)}</div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-ink-2">{r.note}</p>
                    <p className="mt-1 text-xs text-mute">Started by: {r.trigger}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No runs yet. Press "Run Monday check" in the sidebar to make the first one.</Empty>
        )}
      </Card>
      <Card className="mt-[1.125rem]" title="The five workflows" sub="What each run does, step by step. Amber steps wait for a person.">
        <ul>
          {WORKFLOWS.map((w) => (
            <li key={w.name} className="grid gap-2 border-t border-line py-3.5 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <b className="text-[0.875rem] text-ink">{w.name}</b>
                <span className="font-mono text-xs text-mute">{w.trig}</span>
              </div>
              <div className="flow">
                {w.steps.map((st, i) => (
                  <span key={st} className="contents">
                    <span className={`step ${st.startsWith("Approval") ? "wait" : ""}`}>{st}</span>
                    {i < w.steps.length - 1 && (
                      <span className="ar" aria-hidden>
                        →
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

const WORKFLOWS = [
  { name: "Monday crunch check", trig: "Schedule, Mondays 08:00 MYT", steps: ["Read the calendar feed", "Read the briefs", "Gemini or rules: estimate hours, find hidden tasks", "Any week over the limit?", "Approval: programme leader", "Email the lecturer", "Monday digest to students"] },
  { name: "Pre-publish check", trig: "Manual, from this app", steps: ["Read the draft", "Estimate and compare with the cohort load", "Reply with the lightest weeks"] },
  { name: "Extension triage", trig: "Event, student request", steps: ["Read the request", "Check the cohort load", "Check the policy", "Draft a decision", "Approval: staff", "Email the student"] },
  { name: '"Too much" pulse', trig: "Event, student tap", steps: ["Count taps per week", "30% of the cohort reached?", "Alert the programme leader"] },
  { name: "Follow-up", trig: "Schedule, Mondays 08:30 MYT", steps: ["Check approved moves in the calendar feed", "Not updated yet?", "Remind the lecturer"] },
];
