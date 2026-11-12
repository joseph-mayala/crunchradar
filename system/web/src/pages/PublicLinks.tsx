import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { Done, ErrorBox, Loading, Note, Tag } from "../components/ui";
import { fmtHours } from "../lib/chart";
import { proposalTag, type TagSpec } from "../lib/status";
import { fmtDateTime } from "../lib/weeks";
import { useData } from "../useData";
import type { OkMessage } from "../types";

function Shell({ tag, title, move, active = true, children }: { tag: TagSpec; title: string; move: string; active?: boolean; children: ReactNode }) {
  return (
    <article className="card !p-6 sm:!p-7">
      <Tag spec={tag} />
      <h1 className="mt-4 text-[1.875rem] font-extrabold leading-[1.08] sm:text-[2.375rem]">
        {title}
        <span className={`block ${active ? "text-accent" : "text-ink-2"}`}>{move}</span>
      </h1>
      <div className="mt-4 space-y-4">{children}</div>
    </article>
  );
}

function LinkProblem({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.status === 404) {
    return (
      <article className="card !p-6 sm:!p-7">
        <Tag spec={{ label: "Link not found", tone: "mute" }} />
        <h1 className="mt-4 text-3xl font-extrabold">This link does not work</h1>
        <p className="mt-3 text-ink-2">It may have been copied incompletely, or the move was replaced by a newer one. Nothing has changed. If you expected a decision here, check your latest CrunchRadar email.</p>
      </article>
    );
  }
  return <ErrorBox error={error} />;
}

function Result({ result }: { result: OkMessage }) {
  if (result.ok) return <Done>{result.message}</Done>;
  return <Note tone="warn">{result.message}</Note>;
}

/** /approve/:token: the programme leader's single-use decision page. */
export function ApprovePublicPage() {
  const { token = "" } = useParams();
  const res = useData(() => api.approval(token), [token]);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [result, setResult] = useState<OkMessage | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const decide = async (d: "approve" | "reject") => {
    setBusy(d);
    setErr(null);
    try {
      setResult(await api.decide(token, d));
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  };

  if (res.loading && !res.data) return <Loading shape="public" label="Loading the proposed move" />;
  if (res.error) return <LinkProblem error={res.error} />;
  const p = res.data;
  if (!p) return null;

  const expired = p.expired || p.status === "expired";
  const open = p.status === "pending" && !expired && !result;
  const tag: TagSpec = result ? (result.ok ? { label: "Decision recorded", tone: "good" } : { label: "Not recorded", tone: "mute" }) : open ? { label: "Needs your decision", tone: "warn" } : expired ? { label: "Expired", tone: "mute" } : proposalTag(p.status);

  return (
    <Shell tag={tag} title={`${p.mod} ${p.title}`} move={`Week ${p.from_w} → Week ${p.to_w}`} active={open || !!result?.ok}>
      <p className="text-[0.9375rem] leading-relaxed text-ink-2">{p.why}</p>
      {p.peak_before != null && p.peak_after != null && (
        <p className="font-mono text-xs text-mute">
          Peak week: {fmtHours(p.peak_before)} h <span aria-hidden>→</span>
          <span className="sr-only">would become</span> {fmtHours(p.peak_after)} h
        </p>
      )}
      {result ? (
        <Result result={result} />
      ) : open ? (
        <>
          <Note>Nothing changes until you choose. Approving emails the lecturer, who can still say the date is not possible. Rejecting sends nothing.</Note>
          {err != null && <ErrorBox error={err} title="Your decision was not recorded." />}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary min-h-11 px-7" disabled={!!busy} onClick={() => void decide("approve")}>
              {busy === "approve" ? "Approving" : "Approve"}
            </button>
            <button type="button" className="btn-ghost min-h-11 px-7" disabled={!!busy} onClick={() => void decide("reject")}>
              {busy === "reject" ? "Rejecting" : "Reject"}
            </button>
          </div>
          {p.expires && <p className="text-xs text-mute">This link works once and expires {fmtDateTime(p.expires)}.</p>}
        </>
      ) : expired ? (
        <Note tone="warn">This link has expired and nothing was changed. The next Monday check will propose the move again if it is still needed.</Note>
      ) : (
        <Note>
          This move was already {p.status === "declined" ? "declined by the lecturer" : p.status}. The link works once, so there is nothing more to do here.
        </Note>
      )}
    </Shell>
  );
}

/** /lecturer/:token/decline: the lecturer says the approved date is not possible. */
export function DeclinePublicPage() {
  const { token = "" } = useParams();
  const res = useData(() => api.lecturer(token), [token]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OkMessage | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const decline = async () => {
    setBusy(true);
    setErr(null);
    try {
      setResult(await api.decline(token));
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  if (res.loading && !res.data) return <Loading shape="public" label="Loading the approved move" />;
  if (res.error) return <LinkProblem error={res.error} />;
  const p = res.data;
  if (!p) return null;

  const open = p.status === "approved" && !p.expired && !result;
  const tag: TagSpec = result ? (result.ok ? { label: "Recorded", tone: "good" } : { label: "Not recorded", tone: "mute" }) : open ? { label: "Approved by programme leader", tone: "good" } : p.expired ? { label: "Expired", tone: "mute" } : proposalTag(p.status);

  return (
    <Shell tag={tag} title={`${p.mod} ${p.title}`} move={`Week ${p.from_w} → Week ${p.to_w}`} active={open || !!result?.ok}>
      {result ? (
        <Result result={result} />
      ) : open ? (
        <>
          <p className="text-[0.9375rem] leading-relaxed text-ink-2">
            The programme leader approved this move to ease a crunch week. If the new date works, update it in Moodle and you are done; there is no need to use this page.
          </p>
          <Note>Only use this if the date is not possible. Declining undoes the move, tells the programme leader, and CrunchRadar proposes the next option to them. It does not pick a date for you.</Note>
          {err != null && <ErrorBox error={err} title="Your decision was not recorded." />}
          <div>
            <button type="button" className="btn-ghost min-h-11 px-7" disabled={busy} onClick={() => void decline()}>
              {busy ? "Recording" : "This date is not possible"}
            </button>
          </div>
          <p className="text-xs text-mute">This link works once.</p>
        </>
      ) : p.expired ? (
        <Note tone="warn">This decline link has expired. Please reply to the programme leader directly.</Note>
      ) : (
        <Note>
          {p.status === "declined" ? "You already declined this move. The programme leader has been told and the next option has gone to them." : `This move is ${p.status}, so there is nothing to decline.`}
        </Note>
      )}
    </Shell>
  );
}
