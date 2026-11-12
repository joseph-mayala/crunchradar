import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "@phosphor-icons/react";
import { api } from "../api";
import { Heatmap, LoadChart, SensitivityStrip, type OpenWeek } from "../components/charts";
import { WeekOverlay, type WeekTarget } from "../components/WeekOverlay";
import { Card, Empty, ErrorBox, Loading, Mono, Note, PageHeader, Tag } from "../components/ui";
import { fmtHours, plural, worstWeek } from "../lib/chart";
import { processSteps } from "../lib/process";
import { issueTag, modeBadge } from "../lib/status";
import { expiryText } from "../lib/weeks";
import { useSession } from "../session";
import { useCountUp } from "../useCountUp";
import { useData } from "../useData";

function CountTile({ label, num, unit = "", small, state = "" }: { label: string; num: number; unit?: string; small?: string; state?: "bad" | "ok" | "warn" | "" }) {
  const n = useCountUp(num);
  return (
    <div className={`stat ${state === "warn" ? "" : state}`}>
      <div className="k">{label}</div>
      <div className={`v ${state === "warn" ? "!text-warn" : ""}`} aria-label={`${num}${unit} ${small ?? ""}`}>
        <span aria-hidden>
          {Math.round(n ?? num)}
          {unit}
        </span>{" "}
        {small && <small aria-hidden>{small}</small>}
      </div>
    </div>
  );
}

export function OverviewPage() {
  const { session } = useSession();
  const ov = useData(() => api.overview());
  const asm = useData(() => api.assessments().catch(() => null));
  const props = useData(() => api.proposals().catch(() => null));
  const mail = useData(() => api.outbox(50).catch(() => null));

  const d = ov.data;
  const worst = d ? worstWeek(d.weekly_hours) : 0;
  const steps = d ? processSteps({ crunchWeeks: d.crunch_weeks, proposals: props.data ?? [], outbox: mail.data ?? [] }) : null;
  const pending = (props.data ?? []).filter((p) => p.status === "pending");

  // The week overlay remembers what opened it, so it can grow out of it and hand focus back on close.
  const [target, setTarget] = useState<WeekTarget | null>(null);
  const trigger = useRef<HTMLElement | SVGElement | null>(null);
  const openWeek: OpenWeek = useCallback((week, el, mod) => {
    const r = el.getBoundingClientRect();
    trigger.current = el;
    setTarget({ week, mod, ox: r.left + r.width / 2, oy: r.top + r.height / 2 });
  }, []);
  const closeWeek = useCallback(() => {
    setTarget(null);
    const el = trigger.current;
    if (el?.isConnected) el.focus({ preventScroll: true });
  }, []);
  const moveWeek = useCallback((week: number) => setTarget((t) => (t ? { ...t, week } : t)), []);

  return (
    <>
      <PageHeader
        title="Crunch weeks"
        sub={
          d
            ? `${d.crunch_weeks ? `${plural(d.crunch_weeks, "crunch week")} this semester. Week ${worst} is the worst at ${fmtHours(d.peak)} h against a ${fmtHours(d.limit)} h limit.` : "No week is over the limit."} Nothing changes until a person decides.`
            : "Cohort workload, week by week."
        }
      />

      {ov.loading && !d ? (
        <Loading shape="overview" label="Loading the crunch weeks" />
      ) : ov.error ? (
        <ErrorBox error={ov.error} onRetry={ov.reload} />
      ) : d && steps ? (
        <div className="space-y-[1.125rem]">
          <ol className="story" aria-label="Where the process is: detect, propose, approve, notify">
            {steps.map((s, i) => (
              <li key={s.key} className="contents">
                <span className={`s ${s.state === "done" ? "done" : s.state === "now" ? "now" : ""}`} aria-current={s.state === "now" ? "step" : undefined}>
                  <i aria-hidden>{s.state === "done" ? <Check size={12} /> : i + 1}</i>
                  {s.label}
                  <span className="hidden text-[0.78125rem] font-medium text-mute 2xl:inline">{s.hint}</span>
                  <span className="sr-only">{s.state === "done" ? "(done)" : s.state === "now" ? "(current step)" : "(not yet)"}</span>
                </span>
                {i < steps.length - 1 && (
                  <span className="ar max-sm:hidden" aria-hidden>
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>

          <div className="summary !grid-cols-2 lg:!grid-cols-4">
            <CountTile label="Crunch weeks" num={d.crunch_weeks} small={`of ${d.weekly_hours.length}`} state={d.crunch_weeks ? "bad" : "ok"} />
            <CountTile label="Peak week" num={Math.round(d.peak)} unit=" h" small={`/ ${fmtHours(d.limit)} h`} state={d.peak > d.limit ? "bad" : "ok"} />
            <CountTile label="Hidden tasks" num={d.hidden_tasks} small="in briefs" />
            <CountTile label="Waiting for a person" num={d.waiting_for_person} small="decisions" state={d.waiting_for_person ? "warn" : ""} />
          </div>

          <Card
            id="load"
            title="Weekly assignment load"
            sub={
              <>
                Estimated hours per week for the whole cohort. Above the line is a crunch week. Limit {fmtHours(d.limit)} h = MQA 40 h per credit, minus two team assumptions.{" "}
                <Link to="/app/settings" className="link">
                  Change the assumptions
                </Link>
              </>
            }
          >
            <LoadChart weekly={d.weekly_hours} limit={d.limit} holidays={session?.holidays} semesterStart={session?.semester_start} onOpenWeek={openWeek} />
            <SensitivityStrip sensitivity={d.sensitivity} limit={d.limit} />
          </Card>

          <Card id="heat" title="Where the hours come from" sub="Each cell is estimated work for one module in one week. Work starts before the deadline, so a big task heats up two or three weeks. Press a week or a cell to see everything in that week.">
            <Heatmap modules={d.modules} grid={d.grid} weekly={d.weekly_hours} limit={d.limit} holidays={session?.holidays} semesterStart={session?.semester_start} assessments={asm.data} onOpenWeek={openWeek} />
          </Card>

          <div className="grid gap-[1.125rem] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="grid gap-[1.125rem]">
              <Card id="moves" title="Suggested fixes" sub="Moves the check has sent to the programme leader. The programme leader decides through the emailed link, not here.">
                {props.loading && !props.data ? (
                  <Loading shape="list" rows={1} label="Loading moves" />
                ) : pending.length ? (
                  <ul className="grid gap-2.5">
                    {pending.map((p, i) => (
                      <li key={p.id} className={`sugg ${i === 0 ? "best" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Tag spec={i === 0 ? { label: "Best fix", tone: "good" } : { label: `Option ${i + 1}`, tone: "warn" }} />
                          <Tag spec={{ label: "Waiting for decision", tone: "warn" }} />
                        </div>
                        <div className="text-[0.9375rem] font-semibold text-ink">
                          Move {p.mod} {p.title}: Week {p.from_w} → Week {p.to_w}
                        </div>
                        <p className="text-[0.8125rem] text-mute">{p.why}</p>
                        <p className="text-xs text-warn">Programme leader, link {expiryText(p.expires)}.</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>
                    No move is waiting. Press "Run Monday check" in the sidebar to look for one, or see past decisions in{" "}
                    <Link to="/app/approvals" className="link">
                      Approvals
                    </Link>
                    .
                  </Empty>
                )}
              </Card>
              <Card id="issues" title="What the check noticed" sub={`${plural(d.issues.length, "item")} from the current plan.`}>
                {d.issues.length ? (
                  <ul>
                    {d.issues.map((x, i) => (
                      <li key={i} className="grid grid-cols-[7.5rem_1fr] items-start gap-x-3 border-t border-line py-2.5 first:border-t-0 first:pt-0 max-sm:grid-cols-1 max-sm:gap-y-1.5">
                        <div>
                          <Tag spec={issueTag(x.kind)} className="mt-0.5" />
                        </div>
                        <span className="min-w-0 text-[0.84375rem] text-ink-2">{x.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>All clear. No crunch weeks, holiday clashes or hidden tasks.</Empty>
                )}
              </Card>
            </div>
            <Card id="briefs" title="Brief reader" sub="Briefs read at the last check, and which reader ran. The rules fallback is never hidden.">
              {d.briefs.length ? (
                <ul className="space-y-2.5">
                  {d.briefs.map((b, i) => (
                    <li key={i} className="sugg !gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{b.brief}</span>
                        {modeBadge(b.mode) && <Tag spec={modeBadge(b.mode)!} />}
                      </div>
                      <p className="text-xs text-mute">
                        <Mono>{plural(b.tasks, "task")}</Mono> found, {b.note}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No briefs were read in the last check. They are read on the next Monday check.</Empty>
              )}
              <div className="mt-4">
                <Note>
                  Paste a new brief into <Link to="/app/check" className="link">Check a deadline</Link> to see its tasks before students do.
                </Note>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
      <WeekOverlay target={target} weeks={d?.weekly_hours.length ?? session?.weeks ?? 14} onClose={closeWeek} onWeek={moveWeek} />
    </>
  );
}
