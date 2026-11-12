import { useLayoutEffect, useRef } from "react";
import { motion, motionValue, useMotionValue, useScroll, useTransform, type MotionValue } from "motion/react";
import { seg, settleAt } from "../lib/scrolly";
import { usePinned } from "./shared";
import { RULE_ART } from "./art/RuleArt";
import { WeekRuler, type Series } from "./art/Motif";

const RULES: { title: string; text: string; tag: string }[] = [
  { title: "Never earlier.", text: "A deadline can only move later, so no one loses time they planned on.", tag: "Direction" },
  { title: "Never a test.", text: "Exam and test dates are fixed. The agent cannot offer to move them.", tag: "Exams" },
  { title: "Never a festive week.", text: "No deadline lands in a holiday week, even if that week looks empty.", tag: "Holidays" },
  { title: "One link, used once.", text: "Each approval link works one time and is gone after 72 hours.", tag: "Links" },
  { title: "No email until a person approves.", text: "The lecturer hears about a move only after a yes from the programme leader.", tag: "People" },
];

const HEAD = "Rules the agent cannot talk its way past.";
const SUB = "They are code, not instructions to the model. A move that breaks one is never offered.";
const FULL = motionValue(1);

function Card({ r, s, i }: { r: (typeof RULES)[number]; s: MotionValue<number>; i: number }) {
  const opacity = useTransform(s, (v) => 0.5 + 0.5 * v);
  const y = useTransform(s, (v) => (1 - v) * 22);
  const Art = RULE_ART[i];
  return (
    <motion.li className="rule rule-rich" style={{ opacity, y }}>
      <div className="rule-top">
        <span className="rule-num">{String(i + 1).padStart(2, "0")}</span>
        <span className="rule-tag">{r.tag}</span>
      </div>
      <div className="rule-art-wrap">
        <Art s={s} />
      </div>
      <h3>{r.title}</h3>
      <p>{r.text}</p>
    </motion.li>
  );
}

function PannedCard({ r, p, i, n }: { r: (typeof RULES)[number]; p: MotionValue<number>; i: number; n: number }) {
  const s = useTransform(p, (v) => settleAt(v, i + 1, n + 1));
  return <Card r={r} s={s} i={i} />;
}

function RailTick({ p, i, n, label }: { p: MotionValue<number>; i: number; n: number; label: string }) {
  const o = useTransform(p, (v) => 0.4 + 0.6 * settleAt(v, i + 1, n + 1));
  return (
    <motion.li style={{ opacity: o }}>
      <i />
      <span>{label}</span>
    </motion.li>
  );
}

function Head() {
  return (
    <div className="pan-intro">
      <h2 id="pan-h" className="beat-h">
        {HEAD}
      </h2>
      <p className="beat-lede">{SUB}</p>
    </div>
  );
}

function PinnedPan({ data }: { data: Series | null }) {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const dist = useMotionValue(0);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // Measure the real overflow (track width minus viewport); re-measure on resize only.
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
      dist.set(Math.max(0, el.scrollWidth - window.innerWidth + pad));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [dist]);
  const x = useTransform(() => -seg(p.get(), 0.05, 0.9) * dist.get());
  const fill = useTransform(p, (v) => seg(v, 0.05, 0.9));
  return (
    <section ref={ref} className="pan" id="safeguards" data-section aria-labelledby="pan-h" style={{ height: "250vh" }}>
      <div className="pan-stage">
        <WeekRuler data={data} className="pan-ruler" />
        <div className="pan-frame">
          <Head />
        </div>
        <motion.ol ref={track} className="pan-track" style={{ x }}>
          {RULES.map((r, i) => (
            <PannedCard key={r.title} r={r} p={p} i={i} n={RULES.length} />
          ))}
        </motion.ol>
        <div className="pan-frame">
          <div className="pan-rail" aria-hidden="true">
            <div className="pan-rail-line">
              <motion.div className="pan-rail-fill" style={{ scaleX: fill }} />
            </div>
            <ol>
              {RULES.map((r, i) => (
                <RailTick key={r.tag} p={p} i={i} n={RULES.length} label={r.tag} />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Beat 3, trust: vertical scroll drives a sideways track of the five fixed rules. A plain grid on phones. */
export function RulesPan({ summary }: { summary?: { weekly_hours?: number[]; limit: number } | null }) {
  const pinned = usePinned();
  const data = summary?.weekly_hours?.length ? { hours: summary.weekly_hours, limit: summary.limit } : null;
  if (pinned) return <PinnedPan data={data} />;
  return (
    <section className="beat pan-static" id="safeguards" data-section aria-labelledby="pan-h">
      <Head />
      <ol className="pan-list">
        {RULES.map((r, i) => (
          <Card key={r.title} r={r} s={FULL} i={i} />
        ))}
      </ol>
    </section>
  );
}
