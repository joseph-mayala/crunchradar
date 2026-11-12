import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarPlus, CheckCircle, EnvelopeSimple, Flask, MagnifyingGlass, SealCheck } from "@phosphor-icons/react";
import { api } from "../api";
import { LogoMark } from "../components/Logo";
import { heroTiles, type HeroTile } from "../lib/landing";
import { useCountUp } from "../useCountUp";
import { useData } from "../useData";

const STEPS = [
  { icon: MagnifyingGlass, title: "Detect", text: "Reads the calendar feed and the briefs, and adds up the hours per week." },
  { icon: CalendarPlus, title: "Propose", text: "Suggests a move the rules allow: never earlier, never a test, never a festive week." },
  { icon: SealCheck, title: "Approve", text: "A named person decides through a single-use link that expires." },
  { icon: EnvelopeSimple, title: "Notify", text: "The lecturer is emailed only after approval, and a follow-up checks the calendar." },
];

const REAL = [
  "The rules that estimate hours and decide which moves are allowed",
  "The Gemini agent, which plans through tool calls inside those rules",
  "The Monday schedule that runs the check",
  "Approval links that work once and expire",
  "The follow-up that checks the calendar after a move",
];
const SAMPLE = [
  "The cohort data: real module names, made-up assessments",
  "Email goes to an outbox until a mail server (SMTP) is added",
  "The calendar is a feed file, not a live Moodle connection",
];

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

function Stats() {
  // Never blocks the hero: the tiles load on their own and fall back to "not available".
  const res = useData(() => api.publicSummary());
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

export function LandingPage() {
  useEffect(() => {
    document.title = "CrunchRadar | Spot the crunch before students hit it";
  }, []);

  return (
    <div className="min-h-[100dvh] px-4 pb-14">
      <a href="#main" className="sr-only z-50 rounded-field bg-accent px-3 py-2 font-semibold text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <div className="chrome">
        <header className="navbar !flex-nowrap">
          <Link to="/" className="pressable flex flex-none items-center gap-2.5 rounded-full" aria-label="CrunchRadar home">
            <LogoMark size={38} title="" />
            <b className="brand-name font-display text-[1.0625rem] font-extrabold tracking-[-0.02em] text-ink">CrunchRadar</b>
          </Link>
          <Link to="/app" className="cta pressable !ml-auto">
            Open the app
            <ArrowRight size={15} aria-hidden />
          </Link>
        </header>
      </div>

      <main id="main" className="mx-auto max-w-[75rem]">
        <section className="hero" aria-labelledby="hero-h">
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
                <span className="pill">Demo data</span>
              </div>
            </div>
            <Stats />
          </div>
          <div className="watermark" aria-hidden="true">
            CRUNCH
          </div>
        </section>

        <section aria-labelledby="how-h" className="mt-14">
          <h2 id="how-h" className="text-[1.5rem] font-bold sm:text-[1.75rem]">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-2">One loop, run every Monday. A person decides at the third step.</p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-[1.375rem] place-items-center rounded-full border border-line-2 font-mono text-[0.71875rem] font-bold text-ink-2" aria-hidden>
                    {i + 1}
                  </span>
                  <s.icon size={20} className="text-accent-2" aria-hidden />
                </div>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="real-h" className="card mt-14 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
          <div>
            <h2 id="real-h" className="text-[1.5rem] font-bold sm:text-[1.75rem]">
              What is real and what is sample
            </h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">The system runs end to end. The data it runs on is a sample until a real cohort calendar is connected.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-base font-bold">Real</h3>
              <ul className="mt-3 space-y-2.5">
                {REAL.map((t) => (
                  <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                    <CheckCircle size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-base font-bold">Sample</h3>
              <ul className="mt-3 space-y-2.5">
                {SAMPLE.map((t) => (
                  <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                    <Flask size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-label="Open the app" className="sugg best mt-14 !flex flex-col items-start justify-between gap-4 !px-7 !py-7 sm:flex-row sm:items-center">
          <p className="font-display text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl">Nothing changes until a person decides.</p>
          <Link to="/app" className="btn-primary">
            Open the app
            <ArrowRight size={15} aria-hidden />
          </Link>
        </section>
      </main>
      <footer className="mx-auto mt-9 max-w-[75rem] border-t border-line pt-4 text-[0.78125rem] leading-relaxed text-mute">
        CrunchRadar, built for the APU Cloud Innovation Hackathon 2026. Module names are from the APD2F2606SE programme; assessments, dates and hours are sample data.
      </footer>
    </div>
  );
}
