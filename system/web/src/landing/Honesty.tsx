import { useId, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowsClockwise, CheckCircle, Clock, Database, FileDashed, Flask, LinkSimple, Scales, Tray, type Icon } from "@phosphor-icons/react";
import { seg } from "../lib/scrolly";
import { usePinned } from "./shared";
import { Brand, BrandMark } from "../components/BrandMark";
import { Skyline, type Series } from "./art/Motif";

type Item = { icon: Icon | "gemini"; text: React.ReactNode; key: string; label: string };

const REAL: Item[] = [
  { key: "rules", label: "Rules", icon: Scales, text: "The rules that estimate hours and decide which moves are allowed" },
  {
    key: "agent", label: "Gemini agent",
    icon: "gemini",
    text: (
      <>
        The <Brand brand="gemini" size={16} /> agent, which plans through tool calls inside those rules
      </>
    ),
  },
  { key: "schedule", label: "Monday schedule", icon: Clock, text: "The Monday schedule that runs the check" },
  { key: "links", label: "Expiring links", icon: LinkSimple, text: "Approval links that work once and expire" },
  { key: "follow", label: "Follow-up check", icon: ArrowsClockwise, text: "The follow-up that checks the calendar after a move" },
];
const SAMPLE: Item[] = [
  { key: "data", label: "Cohort data", icon: Database, text: "The cohort data: real module names, made-up assessments" },
  { key: "mail", label: "Email outbox", icon: Tray, text: "Email goes to an outbox until a mail server (SMTP) is added" },
  { key: "cal", label: "Calendar file", icon: FileDashed, text: "The calendar is a feed file, not a live Moodle connection" },
];

function IconRow({ items, tone }: { items: Item[]; tone: "good" | "warn" }) {
  return (
    <ol className={`honest-icons is-${tone}`} aria-hidden="true">
      {items.map((it) => (
        <li key={it.key}>
          <span className="hi-dot">{it.icon === "gemini" ? <BrandMark brand="gemini" size={22} className="hi-img" /> : <it.icon size={22} weight="duotone" />}</span>
          <span className="hi-label">{it.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** One Monday, start to finish: what runs for real, in order. */
function RunStrip() {
  const steps = ["08:00 check", "Move proposed", "Person approves", "Calendar checked"];
  return (
    <svg viewBox="0 0 620 80" className="honest-art is-strip" aria-hidden="true" focusable="false">
      <line x1={70} x2={550} y1={30} y2={30} className="ha-line" />
      {steps.map((t, i) => {
        const x = 70 + i * 160;
        return (
          <g key={t}>
            <circle cx={x} cy={30} r={i === 2 ? 9 : 7} className={i === 2 ? "ha-node is-person" : "ha-node"} />
            {i === 2 && <path d={`M${x - 4} 30 l3 3.5 l5.5 -6.5`} className="ha-tick" />}
            <text x={x} y={62} textAnchor="middle" className="ha-label is-sans">
              {t}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** A calendar grid where the filled cells are hatched: the shape is real, the entries are sample. */
function SampleGrid() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const filled = new Set([3, 9, 10, 16, 17, 18, 24]);
  return (
    <svg viewBox="0 0 320 120" className="honest-art is-grid" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`s${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="ha-hatch" />
        </pattern>
      </defs>
      {Array.from({ length: 28 }, (_, i) => {
        const x = 4 + (i % 7) * 33;
        const y = 4 + Math.floor(i / 7) * 28;
        return <rect key={i} x={x} y={y} width={29} height={24} rx={4} className={filled.has(i) ? "ha-cell is-filled" : "ha-cell"} style={filled.has(i) ? { fill: `url(#s${id})` } : undefined} />;
      })}
      <g transform="translate(246 30) rotate(-8)">
        <rect x={0} y={0} width={70} height={30} rx={6} className="ha-stamp" />
        <text x={35} y={20} textAnchor="middle" className="ha-stamp-t">
          SAMPLE
        </text>
      </g>
      <text x={248} y={92} className="ha-label">
        feed file
      </text>
    </svg>
  );
}

function Panels({ wipe }: { wipe: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start 0.92", "start 0.35"] });
  const realClip = useTransform(p, (v) => `inset(0 ${(1 - seg(v, 0, 0.75)) * 100}% 0 0 round 24px)`);
  const sampleClip = useTransform(p, (v) => `inset(0 0 0 ${(1 - seg(v, 0.25, 1)) * 100}% round 24px)`);
  return (
    <div ref={ref} className="honest-panels">
      <motion.div className="honest-panel is-real" style={wipe ? { clipPath: realClip } : undefined}>
        <div className="honest-top">
          <h3>Real</h3>
          <span className="honest-count">Runs end to end</span>
        </div>
        <IconRow items={REAL} tone="good" />
        <ul>
          {REAL.map((t) => (
            <li key={t.key}>
              <CheckCircle size={18} className="mt-0.5 shrink-0 pal-good" aria-hidden />
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
        <RunStrip />
      </motion.div>
      <motion.div className="honest-panel is-sample" style={wipe ? { clipPath: sampleClip } : undefined}>
        <div className="honest-top">
          <h3>Sample</h3>
          <span className="honest-count">Until a real cohort is connected</span>
        </div>
        <IconRow items={SAMPLE} tone="warn" />
        <ul>
          {SAMPLE.map((t) => (
            <li key={t.key}>
              <Flask size={18} className="mt-0.5 shrink-0 pal-warn" aria-hidden />
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
        <SampleGrid />
      </motion.div>
    </div>
  );
}

/** Beat 4, candour: what is real and what is sample, revealed by a wipe as the panels enter. */
export function Honesty({ data = null }: { data?: Series | null }) {
  const wipe = usePinned();
  return (
    <section className="beat honest has-skyline" id="real-vs-sample" data-section aria-labelledby="honest-h">
      <h2 id="honest-h" className="beat-h">
        What is real, and what is sample.
      </h2>
      <p className="beat-lede">The system runs end to end. The data it runs on is a sample until a real cohort calendar is connected.</p>
      <Panels wipe={wipe} />
      <Skyline data={data} />
    </section>
  );
}
