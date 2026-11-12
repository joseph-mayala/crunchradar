import { useRef } from "react";
import { motion, motionValue, useScroll, useTransform, type MotionValue } from "motion/react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { PublicSummary } from "../types";
import { Tag } from "../components/ui";
import { hoursText, lineAt } from "../lib/scrolly";
import { SampleLabel, usePinned } from "./shared";
import { LogDiagram } from "./art/LogDiagram";
import { Radar } from "./art/Motif";

interface Line {
  tool?: string;
  found?: boolean;
  text: string;
}

/** The lines of one Monday run, in the order the agent made its tool calls. Numbers come from the summary. */
function linesFor(s: PublicSummary | null): Line[] {
  const mv = s?.illustrated_moves?.[0];
  return [
    {
      tool: "get_overview",
      text: s ? `Read ${s.weeks} weeks of hours. ${s.crunch_weeks} ${s.crunch_weeks === 1 ? "is" : "are"} over the ${hoursText(s.limit)} h limit.` : "Read the hours for every week.",
    },
    { found: true, text: "Found a task nobody listed: a group demo in Week 12, inside a brief." },
    { tool: "get_options", text: "Asked for the moves the rules allow. It cannot propose any other." },
    {
      tool: "request_approval",
      text: mv ? `${mv.mod} ${mv.title}, Week ${mv.from} to Week ${mv.to}. Sent to the programme leader.` : "Sent one allowed move to the programme leader.",
    },
    { tool: "finish", text: "Nothing has changed yet. A person decides." },
  ];
}

function Row({ line, p, i, n }: { line: Line; p: MotionValue<number> | null; i: number; n: number }) {
  const o = useTransform(p ?? FULL, (v) => (p ? lineAt(lead(v), i, n) : 1));
  const y = useTransform(o, (v) => (1 - v) * 12);
  return (
    <motion.li className={`log-row ${line.found ? "is-found" : ""}`} style={{ opacity: o, y }}>
      {line.found ? (
        <span className="log-tool is-found">
          <MagnifyingGlass size={14} weight="bold" aria-hidden />
          found
        </span>
      ) : (
        <code className="log-tool">{line.tool}</code>
      )}
      <span className="log-text">{line.text}</span>
    </motion.li>
  );
}

// Start the log one line in, so a reader who lands at the top of the pin already sees the first tool call.
const lead = (v: number) => Math.min(1, v + 0.14);

// A constant motion value for the static (unpinned) case, so the hooks run the same way.
const FULL = motionValue(1);

function Status({ p, n }: { p: MotionValue<number> | null; n: number }) {
  const o = useTransform(p ?? FULL, (v) => (p ? lineAt(lead(v), n - 1, n) : 1));
  return (
    <motion.span style={{ opacity: o }}>
      <Tag spec={{ label: "Needs review", tone: "warn" }} />
    </motion.span>
  );
}

function Log({ s, p }: { s: PublicSummary | null; p: MotionValue<number> | null }) {
  const lines = linesFor(s);
  return (
    <div className="log" aria-label="One Monday run, as the run history records it">
      <div className="log-head">
        <div className="flex flex-wrap items-center gap-2">
          <b className="pal-ink">Monday crunch check</b>
          <Tag spec={{ label: "GEMINI", tone: "info", brand: "gemini" }} />
          <Status p={p} n={lines.length} />
        </div>
        <span className="font-mono text-xs pal-mute">Schedule, Mondays 08:00 MYT</span>
      </div>
      <ol className="log-rows">
        {lines.map((l, i) => (
          <Row key={i} line={l} p={p} i={i} n={lines.length} />
        ))}
      </ol>
      <div className="log-foot">
        <SampleLabel />
      </div>
    </div>
  );
}

function Diagram({ s, p }: { s: PublicSummary | null; p: MotionValue<number> | null }) {
  const found = useTransform(p ?? FULL, (v) => (p ? lineAt(lead(v), 1, 5) : 1));
  if (!s?.weekly_hours?.length) return null;
  return <LogDiagram hours={s.weekly_hours} limit={s.limit} found={found} />;
}

function Copy() {
  return (
    <div className="log-copy">
      <h2 id="log-h" className="beat-h">
        Every Monday at 08:00, the agent reads the week.
      </h2>
      <p className="beat-lede">It works only through tool calls, so every step it takes is on the record. You see what it read, what it found and what it asked for.</p>
    </div>
  );
}

/** Beat 2, curiosity: the run history of one Monday, line by line as you scroll. */
export function AgentLog({ summary }: { summary: PublicSummary | null }) {
  const pinned = usePinned();
  if (!pinned) {
    return (
      <section className="beat log-static" id="monday-agent" data-section aria-labelledby="log-h">
        <Copy />
        <Log s={summary} p={null} />
        <Diagram s={summary} p={null} />
      </section>
    );
  }
  return <PinnedLog summary={summary} />;
}

function PinnedLog({ summary }: { summary: PublicSummary | null }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return (
    <section ref={ref} className="log-pin" id="monday-agent" data-section aria-labelledby="log-h" style={{ height: "220vh" }}>
      <div className="log-stage">
        <Radar className="log-radar" sweep={false} dots={false} />
        <div className="log-side">
          <Copy />
          <Diagram s={summary} p={scrollYProgress} />
        </div>
        <Log s={summary} p={scrollYProgress} />
      </div>
    </section>
  );
}
