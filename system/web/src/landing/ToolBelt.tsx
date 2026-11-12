import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, CalendarBlank, FileText, Tray, type Icon } from "@phosphor-icons/react";
import { SPRING } from "./shared";
import { BrandMark, type BrandKey } from "../components/BrandMark";

const TOOLS = [
  { name: "weekly_summary", text: "Hours per week for the cohort, and the weeks over the limit." },
  { name: "list_allowed_moves", text: "Only the deadline moves the rules allow." },
  { name: "request_approval", text: "Sends one move to the programme leader, who decides." },
  { name: "check_draft_assignment", text: "Checks a new assignment against the cohort load before it goes out." },
];
const CONNECTORS: { from: string; icon: Icon; brand: BrandKey; to: string }[] = [
  { from: "Calendar feed", icon: CalendarBlank, brand: "google-calendar", to: "Google Calendar" },
  { from: "Briefs", icon: FileText, brand: "google-drive", to: "Google Drive" },
  { from: "Outbox", icon: Tray, brand: "outlook", to: "Microsoft Outlook" },
];
const ROW_Y = [16.7, 50, 83.3];

/** A small drawing of what each tool returns: weekly bars, allowed moves, one approval, a load check. */
function ToolGlyph({ i }: { i: number }) {
  const bars = [10, 16, 20, 28, 40, 22, 14];
  return (
    <svg viewBox="0 0 160 56" className="belt-glyph" aria-hidden="true" focusable="false">
      <line x1={0} x2={160} y1={18} y2={18} className="bg-limit" />
      {i === 0 &&
        bars.map((h, k) => <rect key={k} x={6 + k * 22} y={52 - h} width={14} height={h} rx={2} className={h > 34 ? "bg-bar is-hot" : "bg-bar"} />)}
      {i === 1 && (
        <g>
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <rect key={k} x={6 + k * 25} y={30} width={20} height={20} rx={4} className="bg-cell" />
          ))}
          <rect x={36} y={35} width={10} height={10} rx={2} className="bg-dot" />
          <path d="M50 24 Q 72 6 92 24 M86 18 l6 6 l-8 3" className="bg-arrow" />
          <path d="M50 24 Q 97 -6 142 24 M136 18 l6 6 l-8 3" className="bg-arrow is-faint" />
        </g>
      )}
      {i === 2 && (
        <g>
          <rect x={6} y={26} width={64} height={24} rx={6} className="bg-cell" />
          <text x={38} y={42} textAnchor="middle" className="bg-t">
            1 move
          </text>
          <path d="M76 38 H104 m-6 -5 l6 5 l-6 5" className="bg-arrow" />
          <circle cx={128} cy={38} r={13} className="bg-ok" />
          <path d="M122 38 l4 4.5 l8 -9" className="bg-ok-tick" />
        </g>
      )}
      {i === 3 && (
        <g>
          <rect x={6} y={22} width={34} height={30} rx={4} className="bg-cell" />
          <line x1={13} x2={33} y1={31} y2={31} className="bg-doc" />
          <line x1={13} x2={29} y1={38} y2={38} className="bg-doc" />
          <line x1={13} x2={31} y1={45} y2={45} className="bg-doc" />
          {[14, 20, 26, 12].map((h, k) => (
            <rect key={k} x={62 + k * 22} y={52 - h} width={14} height={h} rx={2} className="bg-bar" />
          ))}
          <rect x={84} y={52 - 26 - 9} width={14} height={9} rx={2} className="bg-dot" />
        </g>
      )}
    </svg>
  );
}

/** Three sample parts on the left, the agent and its tools in the middle, the real connectors on the right. */
function ConnectorMap() {
  const reduce = useReducedMotion();
  const draw = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true, amount: 0.5 },
          transition: { duration: 0.5, ease: "easeOut" as const, delay: 0.1 + i * 0.08 },
        };
  return (
    <figure className="belt-map" aria-label="Where each sample part plugs in">
      <svg className="belt-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {ROW_Y.map((y, i) => (
          <g key={i}>
            <motion.path d={`M16 ${y} C 32 ${y}, 34 50, 50 50`} vectorEffect="non-scaling-stroke" className="bm-line is-in" {...draw(i)} />
            <motion.path d={`M50 50 C 66 50, 68 ${y}, 84 ${y}`} vectorEffect="non-scaling-stroke" className="bm-line" {...draw(i + 2)} />
          </g>
        ))}
      </svg>
      <div className="bm-col">
        <span className="bm-head">Sample today</span>
        {CONNECTORS.map((c) => (
          <div key={c.from} className="bm-node is-sample">
            <c.icon size={22} weight="duotone" aria-hidden />
            <span>{c.from}</span>
          </div>
        ))}
      </div>
      <div className="bm-col is-hub">
        <span className="bm-head">Agent and tools</span>
        <div className="bm-hub">
          <div className="bm-hub-node">
            <BrandMark brand="gemini" size={48} />
            <span>Gemini</span>
          </div>
          <div className="bm-hub-node">
            <BrandMark brand="mcp" size={44} />
            <span>MCP tools</span>
          </div>
        </div>
      </div>
      <div className="bm-col">
        <span className="bm-head">Connector</span>
        {CONNECTORS.map((c) => (
          <div key={c.to} className="bm-node is-brand">
            <BrandMark brand={c.brand} size={56} />
            <span>{c.to}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/** Beat 5, confidence: the four MCP tools settle in as larger tiles, beside a map of the connectors. */
export function ToolBelt() {
  const reduce = useReducedMotion();
  return (
    <section className="beat belt" id="plugs-in" data-section aria-labelledby="belt-h">
      <h2 id="belt-h" className="beat-h belt-h">
        <BrandMark brand="gemini" size={40} className="belt-h-mark" />
        <span>Built to plug into Gemini Enterprise.</span>
      </h2>
      <p className="beat-lede">The rules run as an OpenAPI service and as MCP tools. No tool can change a deadline.</p>
      <div className="belt-grid">
        <ol className="belt-tiles">
          {TOOLS.map((t, i) => (
            <motion.li
              key={t.name}
              className="belt-tile"
              initial={reduce ? false : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={reduce ? { duration: 0 } : { type: "spring", ...SPRING, delay: i * 0.07 }}
            >
              <div className="belt-tile-top">
                <span className="belt-tile-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="belt-tile-kind">
                  <BrandMark brand="mcp" size={16} />
                  MCP tool
                </span>
              </div>
              <ToolGlyph i={i} />
              <code>{t.name}</code>
              <span className="belt-tile-text">{t.text}</span>
            </motion.li>
          ))}
        </ol>
        <ConnectorMap />
      </div>
      <ul className="belt-connect" aria-label="Where each sample part plugs in">
        {CONNECTORS.map((c) => (
          <li key={c.from}>
            <span className="pal-mute">{c.from}</span>
            <ArrowRight size={14} className="pal-mute" aria-label="becomes the" />
            <span className="belt-connect-to">
              <BrandMark brand={c.brand} size={28} />
              <b>{c.to}</b>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
