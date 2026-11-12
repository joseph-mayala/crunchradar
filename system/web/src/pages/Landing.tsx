/*
 * The public landing page is a timeline. Each beat uses a different scroll device, so the
 * reader keeps going to see what the next one does.
 *
 * FEELING CURVE (the emotion, then what on screen causes it)
 *   Hero   calm authority  The preserved hero card. Three planes drift apart as you leave it:
 *                          the CRUNCH watermark behind, the stat tiles in the middle, the headline in front.
 *   (silence)              A short empty gap with no motion, so the peak has something to arrive from.
 *   1      tension, then   THE PEAK and the signature move. A pinned bar chart (the longest span on the
 *          relief          page, 420vh). Bars rise week by week until week 11 sits far over the dashed
 *                          limit in red; then each real move plays as you scroll, the bars settle on
 *                          springs into the after shape and the peak counts down. Scroll moves the deadline.
 *   2      curiosity       Pinned run history. The agent's real tool calls arrive line by line.
 *   3      trust           Horizontal pan. Vertical scroll slides five fixed rules sideways.
 *   4      candour         Wipe reveal (clip-path). What is real and what is sample, side by side.
 *   5      confidence      Staggered tool belt. The four MCP tools settle in on springs.
 *   (silence)              A second quiet gap before the close.
 *   6      resolve         Pointer-driven close. The watermark returns large and leans with the pointer;
 *                          one line, one button. It holds; nothing fades out.
 *
 * Devices: parallax, scrubbed chart, kinetic log, pan, reveal, stagger-in, pointer. Never the same twice in a row.
 * Fallbacks: under prefers-reduced-motion or below 768px nothing pins and nothing is scroll-linked;
 * every beat shows its end state (the chart becomes a static before and after pair).
 * Every number comes from GET /api/public-summary. The page never waits for it.
 */
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { api } from "../api";
import { LogoMark } from "../components/Logo";
import { heroTiles, type HeroTile } from "../lib/landing";
import { useCountUp } from "../useCountUp";
import { useData, type DataState } from "../useData";
import type { PublicSummary } from "../types";
import { Relief } from "../landing/Relief";
import { AgentLog } from "../landing/AgentLog";
import { RulesPan } from "../landing/RulesPan";
import { Honesty } from "../landing/Honesty";
import { ToolBelt } from "../landing/ToolBelt";
import { Close } from "../landing/Close";
import { Roles } from "../landing/Roles";
import { WeekRuler } from "../landing/art/Motif";
import { SectionNav } from "../landing/SectionNav";
import "../landing.css";
import "../landing-art.css";

function Tile({ t }: { t: HeroTile }) {
  const n = useCountUp(t.num);
  return (
    <div className={`stat ${t.state}`}>
      <div className="k">{t.label}</div>
      {t.num !== null ? (
        <div className="v" aria-label={`${t.value} ${t.small}`}>
          <span aria-hidden>
            {Math.round(n ?? t.num)}
            {t.unit}
          </span>{" "}
          <small aria-hidden>{t.small}</small>
        </div>
      ) : (
        <div className="v na">{t.small}</div>
      )}
    </div>
  );
}

function Stats({ res }: { res: DataState<PublicSummary> }) {
  // Never blocks the hero: the tiles load on their own and fall back to "not available".
  if (res.loading && !res.data) {
    return (
      <div className="summary" role="status" aria-label="Loading the current numbers">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat" aria-hidden>
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-3 h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="summary">
      {heroTiles(res.error ? null : res.data).map((t) => (
        <Tile key={t.key} t={t} />
      ))}
    </div>
  );
}

/** The approved hero, unchanged in look. Scrolling away separates it into three planes. */
function Hero({ res }: { res: DataState<PublicSummary> }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const markY = useTransform(p, [0, 1], [0, 120]); // back plane lags furthest
  const tilesY = useTransform(p, [0, 1], [0, 46]); // mid plane
  const markStyle = reduce ? undefined : { y: markY };
  const tilesStyle = reduce ? undefined : { y: tilesY };
  return (
    <section ref={ref} className="hero" aria-labelledby="hero-h">
      <div className="hero-top">
        <div>
          <span className="eyebrow">
            <i aria-hidden />
            Monday 08:00 check · APD2F2606SE
          </span>
          <h1 id="hero-h">
            Spot the crunch <em>before</em> students hit it.
          </h1>
          <p className="lede">CrunchRadar reads every deadline and brief, estimates the real hours, and proposes deadline moves that a programme leader approves.</p>
          <div className="chips">
            <span className="pill">
              Cohort <b>APD2F2606SE</b>
            </span>
            <span className="pill">
              Semester <b>Jan-Apr 2027</b>
            </span>
            <span className="pill">Sample data</span>
          </div>
        </div>
        <motion.div style={tilesStyle}>
          <Stats res={res} />
        </motion.div>
      </div>
      <motion.div className="watermark" aria-hidden="true" style={markStyle}>
        CRUNCH
      </motion.div>
    </section>
  );
}

export function LandingPage() {
  useEffect(() => {
    document.title = "CrunchRadar | Spot the crunch before students hit it";
  }, []);
  const res = useData(() => api.publicSummary());
  const summary = res.error ? null : res.data;
  const series = summary?.weekly_hours?.length ? { hours: summary.weekly_hours, limit: summary.limit } : null;

  return (
    <div className="landing min-h-[100dvh] px-4">
      <a href="#main" className="sr-only z-50 rounded-field bg-accent px-3 py-2 font-semibold text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <div className="chrome">
        <header className="navbar !flex-nowrap">
          <Link to="/" className="pressable flex flex-none items-center gap-2.5 rounded-full" aria-label="CrunchRadar home">
            <LogoMark size={38} title="" />
            <b className="brand-name font-display text-[1.0625rem] font-extrabold tracking-[-0.02em] text-ink">CrunchRadar</b>
          </Link>
          <SectionNav />
          <Link to="/app" className="cta pressable !ml-auto">
            Open the app
            <ArrowRight size={15} aria-hidden />
          </Link>
        </header>
      </div>

      <main id="main" className="landing-main mx-auto">
        <Hero res={res} />
        <div className="silence" aria-hidden="true">
          <WeekRuler data={series} />
        </div>
        <Relief summary={summary} loading={res.loading && !res.data} />
        <AgentLog summary={summary} />
        <RulesPan summary={summary} />
        <Honesty data={series} />
        <ToolBelt />
        <Roles />
        <Close data={series} />
      </main>
    </div>
  );
}
