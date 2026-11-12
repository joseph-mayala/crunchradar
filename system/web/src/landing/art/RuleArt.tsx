/*
 * Five small illustrations, one per fixed rule. Each one shows the rule rather than naming it.
 * `s` is the card's settle progress (0..1): in the pinned pan it follows the scroll, elsewhere it is 1,
 * so every drawing has a finished, static end state. Transforms and opacity only.
 */
import { useId } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";

const VB = "0 0 280 150";
const CELL = 38;
const GAP = 4;
const cx = (i: number, x0 = 18) => x0 + i * (CELL + GAP);

function Cells({ n, y, labels, x0 = 18, from = 8 }: { n: number; y: number; labels?: boolean; x0?: number; from?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={cx(i, x0)} y={y} width={CELL} height={30} rx={5} className="ra-cell" />
          {labels && (
            <text x={cx(i, x0) + CELL / 2} y={y + 46} className="ra-label" textAnchor="middle">
              W{from + i}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

/** Never earlier: the deadline only slides right; the left arrow is blocked. */
function Earlier({ s }: { s: MotionValue<number> }) {
  const x = useTransform(s, (v) => v * (CELL + GAP));
  return (
    <svg viewBox={VB} className="rule-art" aria-hidden="true" focusable="false">
      <Cells n={6} y={72} labels from={8} />
      <rect x={cx(2) + 8} y={78} width={CELL - 16} height={18} rx={3} className="ra-ghost" />
      <motion.rect x={cx(2) + 8} y={78} width={CELL - 16} height={18} rx={3} className="ra-bar" style={{ x }} />
      {/* blocked: left */}
      <g className="ra-blocked">
        <path d={`M${cx(2) - 4} 44 H${cx(0) + 10} m8 -7 l-8 7 l8 7`} />
        <line x1={cx(1) - 2} y1={33} x2={cx(1) + 16} y2={55} />
      </g>
      {/* allowed: right */}
      <path d={`M${cx(3) + 6} 44 H${cx(5) + 22} m-8 -7 l8 7 l-8 7`} className="ra-allowed" />
      <text x={cx(4) + 14} y={26} className="ra-note" textAnchor="middle">
        later only
      </text>
    </svg>
  );
}

/** Never a test: the exam week is locked; a deadline cannot land on it. */
function Test({ s }: { s: MotionValue<number> }) {
  const shackle = useTransform(s, (v) => (1 - v) * -7);
  return (
    <svg viewBox={VB} className="rule-art" aria-hidden="true" focusable="false">
      <Cells n={6} y={72} labels from={10} />
      <rect x={cx(3)} y={72} width={CELL} height={30} rx={5} className="ra-exam" />
      <text x={cx(3) + CELL / 2} y={91} className="ra-exam-t" textAnchor="middle">
        EXAM
      </text>
      <g transform={`translate(${cx(3) + CELL / 2} 40)`}>
        <motion.path d="M-7 0 V-7 a7 7 0 0 1 14 0 V0" className="ra-shackle" style={{ y: shackle }} />
        <rect x={-11} y={-1} width={22} height={17} rx={3.5} className="ra-lock" />
        <circle cx={0} cy={7} r={2.4} className="ra-keyhole" />
      </g>
      <rect x={cx(1) + 8} y={78} width={CELL - 16} height={18} rx={3} className="ra-bar" />
      <path d={`M${cx(1) + CELL / 2} 70 C ${cx(2)} 44, ${cx(3) - 18} 44, ${cx(3) - 7} 62`} className="ra-try" />
      <line x1={cx(3) - 14} y1={55} x2={cx(3) - 2} y2={67} className="ra-stop" />
      <line x1={cx(3) - 2} y1={55} x2={cx(3) - 14} y2={67} className="ra-stop" />
    </svg>
  );
}

/** Never a festive week: the holiday week is hatched and the deadline hops over it. */
function Festive({ s }: { s: MotionValue<number> }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const x = useTransform(s, (v) => v * 2 * (CELL + GAP));
  const y = useTransform(s, (v) => -Math.sin(Math.PI * v) * 30);
  return (
    <svg viewBox={VB} className="rule-art" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`h${id}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" className="ra-hatch" />
        </pattern>
      </defs>
      <Cells n={6} y={72} labels from={6} />
      <rect x={cx(3)} y={72} width={CELL} height={30} rx={5} fill={`url(#h${id})`} className="ra-hol" />
      <text x={cx(3) + CELL / 2} y={62} className="ra-hol-t" textAnchor="middle">
        holiday
      </text>
      <path d={`M${cx(2) + CELL / 2} 70 Q ${cx(3) + CELL / 2} 18 ${cx(4) + CELL / 2} 70`} className="ra-arc" />
      <motion.rect x={cx(2) + 8} y={78} width={CELL - 16} height={18} rx={3} className="ra-bar" style={{ x, y }} />
    </svg>
  );
}

/** One link, used once: a single link and a 72 hour ring that runs down. */
function Link({ s }: { s: MotionValue<number> }) {
  const left = useTransform(s, (v) => 1 - 0.62 * v);
  return (
    <svg viewBox={VB} className="rule-art" aria-hidden="true" focusable="false">
      <g transform="translate(70 76) rotate(-35)" className="ra-link">
        <rect x={-34} y={-11} width={40} height={22} rx={11} />
        <rect x={-6} y={-11} width={40} height={22} rx={11} />
      </g>
      <text x={70} y={130} className="ra-label" textAnchor="middle">
        one use
      </text>
      <g transform="translate(196 76)">
        <circle r={40} className="ra-ring-bg" />
        <motion.circle r={40} className="ra-ring" style={{ pathLength: left, rotate: -90 }} />
        <text y={2} className="ra-ring-n" textAnchor="middle">
          72
        </text>
        <text y={20} className="ra-label" textAnchor="middle">
          hours
        </text>
      </g>
    </svg>
  );
}

/** No email until a person approves: the envelope waits behind a gate until the check appears. */
function Email({ s }: { s: MotionValue<number> }) {
  const gate = useTransform(s, [0.5, 1], [0, -26]);
  const check = useTransform(s, [0.35, 0.7], [0, 1]);
  const mail = useTransform(s, [0.6, 1], [0, 18]);
  return (
    <svg viewBox={VB} className="rule-art" aria-hidden="true" focusable="false">
      <motion.g style={{ x: mail }} className="ra-mail">
        <rect x={36} y={56} width={66} height={44} rx={6} />
        <path d="M38 59 L69 82 L100 59" />
      </motion.g>
      <line x1={124} x2={124} y1={36} y2={118} className="ra-post" />
      <motion.g style={{ y: gate }} className="ra-gate">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={132 + i * 9} x2={132 + i * 9} y1={48} y2={112} />
        ))}
        <line x1={128} x2={164} y1={56} y2={56} />
      </motion.g>
      <line x1={170} x2={170} y1={36} y2={118} className="ra-post" />
      <g transform="translate(222 76)">
        <motion.g style={{ opacity: check, scale: check }}>
          <circle r={26} className="ra-ok" />
          <path d="M-11 0 l7 8 l15 -16" className="ra-ok-tick" />
        </motion.g>
      </g>
      <text x={222} y={130} className="ra-label" textAnchor="middle">
        a person says yes
      </text>
    </svg>
  );
}

export const RULE_ART = [Earlier, Test, Festive, Link, Email] as const;
