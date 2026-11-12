import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, Done, Empty, ErrorBox, Loading, Mono, Note, PageHeader, Tag } from "../components/ui";
import { extensionStatusTag, verdictTag } from "../lib/status";
import { fmtShort } from "../lib/weeks";
import { useData } from "../useData";
import type { Extension } from "../types";

const REASON: Record<string, string> = { medical: "Medical", family: "Family", workload: "Workload", other: "Other" };

export function ExtensionsPage() {
  const res = useData(() => api.extensions());
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<Record<number, string>>({});
  const [err, setErr] = useState<unknown>(null);

  const decide = async (e: Extension, decision: "approve" | "override") => {
    setBusy(e.id);
    setErr(null);
    try {
      const r = await api.decideExtension(e.id, decision);
      setMsg((m) => ({ ...m, [e.id]: r.message }));
      res.reload();
    } catch (x) {
      setErr(x);
    } finally {
      setBusy(null);
    }
  };

  const pending = (res.data ?? []).filter((e) => e.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Extension requests"
        sub={pending ? `${pending} request${pending > 1 ? "s" : ""} waiting for you.` : "Requests students sent through their link."}
        actions={
          <button type="button" className="btn-ghost btn-sm" onClick={res.reload} disabled={res.loading}>
            Refresh
          </button>
        }
      />
      <div className="mb-6">
        <Note tone="warn">
          CrunchRadar drafts a verdict from the policy and the cohort load. <b className="text-ink">You decide.</b> Approving sends the drafted answer to the student; overriding sends nothing and you reply yourself.
          Policy: medical up to 7 days, family up to 5, workload up to 3 only in a week over the limit, anything else goes to the lecturer.
        </Note>
      </div>
      {err != null && (
        <div className="mb-4">
          <ErrorBox error={err} title="That decision was not saved." />
        </div>
      )}
      {res.loading && !res.data ? (
        <Loading shape="cards" rows={2} label="Loading extension requests" />
      ) : res.error ? (
        <ErrorBox error={res.error} onRetry={res.reload} />
      ) : res.data && res.data.length ? (
        <ul className="space-y-4">
          {res.data.map((e) => (
            <li key={e.id}>
              <Card className="!p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">
                      {e.mod && <Mono className="mr-1.5 text-xs text-accent-2">{e.mod}</Mono>}
                      {e.title ?? e.assess_id ?? `Request ${e.id}`}
                      {(e.due ?? e.due_week) ? <Mono className="ml-2 text-xs text-mute">due W{e.due ?? e.due_week}</Mono> : null}
                    </div>
                    <div className="mt-1 text-sm text-ink-2">
                      {e.reason ? REASON[e.reason] ?? e.reason : "Reason not given"}
                      {e.days ? `, asks for ${e.days} day${e.days > 1 ? "s" : ""}` : ""}
                      {e.personal_hours ? `, ${e.personal_hours} h of other work that week` : ""}
                      {e.created ? <span className="text-mute"> · {fmtShort(e.created)}</span> : null}
                    </div>
                  </div>
                  <Tag spec={extensionStatusTag(e.status)} />
                </div>
                <div className="inset-box mt-4 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag spec={verdictTag(e.draft.verdict)} />
                    {e.draft.days > 0 && <Mono className="text-sm text-ink">{e.draft.days} days</Mono>}
                  </div>
                  <ul className="mt-2.5 list-disc space-y-1 pl-5 text-sm text-ink-2">
                    {e.draft.why.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
                {e.pattern?.note && (
                  <div className="mt-3">
                    <Note tone="warn">
                      <b className="text-ink">Pattern{e.pattern.students_asking ? `: ${e.pattern.students_asking} students` : ""}.</b> {e.pattern.note}{" "}
                      <Link to="/app/approvals" className="link">
                        See deadline moves
                      </Link>
                    </Note>
                  </div>
                )}
                {e.status === "pending" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" className="btn-primary btn-sm" disabled={busy === e.id} onClick={() => void decide(e, "approve")}>
                      Approve draft
                    </button>
                    <button type="button" className="btn-ghost btn-sm" disabled={busy === e.id} onClick={() => void decide(e, "override")}>
                      Override
                    </button>
                    <span className="text-xs text-mute">Approve emails the student. Override sends nothing.</span>
                  </div>
                ) : (
                  msg[e.id] && <div className="mt-3"><Done>{msg[e.id]}</Done></div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <Empty>No extension requests yet. Students send them from their digest link.</Empty>
        </Card>
      )}
    </>
  );
}
