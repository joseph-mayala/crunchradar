import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, Empty, ErrorBox, Loading, Mono, Note, PageHeader, Tag } from "../components/ui";
import { proposalTag, type Tone } from "../lib/status";
import { expiryText, fmtShort } from "../lib/weeks";
import { useData } from "../useData";
import type { ProposalStatus } from "../types";

const FILTERS: { key: "all" | ProposalStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "declined", label: "Declined" },
  { key: "expired", label: "Expired" },
];

export function ApprovalsPage() {
  const res = useData(() => api.proposals());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const list = (res.data ?? []).filter((p) => filter === "all" || p.status === filter);
  const pending = (res.data ?? []).filter((p) => p.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Approvals"
        sub={pending ? `${pending} deadline move${pending > 1 ? "s" : ""} waiting for the programme leader.` : "Every deadline move CrunchRadar has proposed, and who decided."}
        actions={
          <button type="button" className="btn-ghost btn-sm" onClick={res.reload} disabled={res.loading}>
            Refresh
          </button>
        }
      />
      <div className="mb-6">
        <Note tone="warn">
          <b className="text-ink">The programme leader decides, not this page.</b> Each move is emailed to them with a single-use link that expires. Approving emails the lecturer, who can still decline with their own link. Rejecting sends nothing.
          The emails are in the <Link to="/app/email" className="link">outbox</Link>.
        </Note>
      </div>

      <Card>
        <div role="group" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`pressable rounded-full border px-3 py-1 text-xs font-medium ${filter === f.key ? "border-accent-2/60 bg-accent-2/10 text-ink" : "border-line-2 text-mute hover:text-ink"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {res.loading && !res.data ? (
          <Loading shape="list" label="Loading proposals" />
        ) : res.error ? (
          <ErrorBox error={res.error} onRetry={res.reload} />
        ) : list.length ? (
          <ul className="divide-y divide-line/70">
            {list.map((p) => {
              const tag = proposalTag(p.status);
              return (
                <li key={p.id} className="grid gap-3 py-4 first:pt-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_13rem]">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">
                      <Mono className="mr-1.5 text-xs text-accent-2">{p.mod}</Mono>
                      {p.title}
                    </div>
                    <div className="mt-1 font-mono text-sm text-ink-2">
                      Week {p.from_w} <span className="text-mute">→</span> Week {p.to_w}
                    </div>
                  </div>
                  <p className="min-w-0 text-sm text-ink-2">{p.why}</p>
                  <div className="flex flex-row flex-wrap items-center gap-2 md:flex-col md:items-end">
                    <Tag spec={tag} />
                    <Meta tone={tag.tone} p={p} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>{filter === "all" ? "No moves proposed yet. Moves appear here after the Monday check finds a crunch week it can ease." : "No moves with this status. Choose All to see every move."}</Empty>
        )}
      </Card>
    </>
  );
}

function Meta({ p }: { tone: Tone; p: { status: ProposalStatus; expires: string | null; decided: string | null; decided_by: string | null; followup: string | null; created: string } }) {
  const lines: string[] = [];
  if (p.status === "pending") lines.push(`Programme leader · ${expiryText(p.expires)}`);
  if (p.decided) lines.push(`${p.decided_by ?? "Decided"} · ${fmtShort(p.decided)}`);
  if (p.status === "expired") lines.push("No one decided in time");
  if (p.followup) lines.push(p.followup);
  lines.push(`Proposed ${fmtShort(p.created)}`);
  return (
    <div className="text-xs text-mute md:text-right">
      {lines.map((l, i) => (
        <div key={i} className={i === 0 && p.status === "pending" ? "text-warn" : undefined}>
          {l}
        </div>
      ))}
    </div>
  );
}
