/*
 * Title links for the landing page bar, the phone menu and the footer row.
 * Jumps use window.scrollTo from onClick (never the browser's hash navigation), because the static
 * demo runs a HashRouter where "#/app" is a route. The active link follows the scroll through an
 * IntersectionObserver on the section wrappers (no window scroll listener).
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { List, X } from "@phosphor-icons/react";
import { SECTIONS, jumpTarget, pickActive, type SectionLink } from "./sections";
import { useMedia, usePinned } from "./shared";

const HASH_ROUTER = import.meta.env.VITE_HASH === "1";
const ORDER = SECTIONS.map((s) => s.id);
let running: AnimationPlaybackControls | null = null;

function focusHeading(s: SectionLink) {
  const h = document.getElementById(s.heading);
  if (!h) return;
  if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
  h.focus({ preventScroll: true });
}

/** Scroll to the start of a section on a spring (instantly under reduced motion), then focus its heading. */
export function jumpTo(s: SectionLink, reduce: boolean) {
  const el = document.getElementById(s.id);
  if (!el) return;
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const to = jumpTarget(el.getBoundingClientRect().top, window.scrollY, margin, max);
  const done = () => {
    focusHeading(s);
    if (!HASH_ROUTER) history.replaceState(history.state, "", `#${s.id}`);
  };
  running?.stop();
  if (reduce || Math.abs(to - window.scrollY) < 2) {
    window.scrollTo({ top: to, behavior: "instant" });
    done();
    return;
  }
  // Interruptible: any wheel, touch or key press hands control straight back to the reader.
  const stop = () => {
    running?.stop();
    off();
  };
  const off = () => {
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
  };
  window.addEventListener("wheel", stop, { passive: true, once: true });
  window.addEventListener("touchstart", stop, { passive: true, once: true });
  window.addEventListener("keydown", stop, { once: true });
  running = animate(window.scrollY, to, {
    type: "spring",
    stiffness: 70,
    damping: 20,
    mass: 1,
    restDelta: 0.5,
    onUpdate: (v) => window.scrollTo({ top: v, behavior: "instant" }),
    onComplete: () => {
      off();
      done();
    },
  });
}

/** Which section the reader is in: the one crossing a thin band 40% down the viewport. */
export function useActiveSection(): string | null {
  const pinned = usePinned(); // the wrappers swap between pinned and static versions; re-observe when they do
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const heights: Record<string, number> = {};
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) heights[e.target.id] = e.isIntersecting ? Math.max(1, e.intersectionRect.height) : 0;
        setActive(pickActive(ORDER, heights));
      },
      { rootMargin: "-40% 0px -59% 0px", threshold: [0, 1] },
    );
    // Sections swap elements (loading frame to chart, pinned to static), so re-observe whenever main's children change.
    const watched = new Set<Element>();
    const attach = () => {
      for (const id of ORDER) {
        const el = document.getElementById(id);
        if (el && !watched.has(el)) {
          watched.add(el);
          io.observe(el);
        }
      }
    };
    const raf = requestAnimationFrame(attach);
    const main = document.getElementById("main");
    const mo = main ? new MutationObserver(attach) : null;
    if (main && mo) mo.observe(main, { childList: true });
    return () => {
      cancelAnimationFrame(raf);
      mo?.disconnect();
      io.disconnect();
    };
  }, [pinned]);
  return active;
}

function Links({ active, onJump, className, itemClass = "" }: { active: string | null; onJump: (s: SectionLink) => void; className: string; itemClass?: string }) {
  return (
    <ul className={className}>
      {SECTIONS.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className={itemClass}
            aria-current={active === s.id ? "true" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onJump(s);
            }}
          >
            {s.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The links inside the top bar: inline on wide screens, a menu button and sheet on narrow ones. */
export function SectionNav() {
  const reduce = !!useReducedMotion();
  const wide = useMedia("(min-width: 1100px)", true);
  const active = useActiveSection();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (wide) setOpen(false);
  }, [wide]);

  useEffect(() => {
    if (!open) return;
    const first = sheet.current?.querySelector<HTMLElement>("a,button");
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !sheet.current) return;
      const items = Array.from(sheet.current.querySelectorAll<HTMLElement>("a,button"));
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        items[items.length - 1].focus({ preventScroll: true });
      } else if (!e.shiftKey && i === items.length - 1) {
        e.preventDefault();
        items[0].focus({ preventScroll: true });
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (sheet.current?.contains(t) || btn.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (wide) {
    return (
      <nav aria-label="Page sections" className="sec-nav">
        <Links active={active} onJump={(s) => jumpTo(s, reduce)} className="sec-links" />
      </nav>
    );
  }
  return (
    <nav aria-label="Page sections" className="sec-nav is-menu">
      <button ref={btn} type="button" className="sec-menu-btn pressable" aria-expanded={open} aria-controls="sec-sheet" onClick={() => setOpen((o) => !o)}>
        {open ? <X size={18} aria-hidden /> : <List size={18} aria-hidden />}
        <span>Sections</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={sheet}
            id="sec-sheet"
            className="sec-sheet"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
            transition={reduce ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 34 }}
          >
            <Links
              active={active}
              className="sec-sheet-links"
              onJump={(s) => {
                setOpen(false);
                jumpTo(s, reduce);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/** The same links as a quiet row in the footer. */
export function FooterSectionLinks() {
  const reduce = !!useReducedMotion();
  return (
    <nav aria-label="Page sections, footer" className="sec-foot">
      <Links active={null} onJump={(s) => jumpTo(s, reduce)} className="sec-foot-links" />
    </nav>
  );
}
