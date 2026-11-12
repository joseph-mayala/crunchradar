import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/** True while a media query matches. Updates only when the match changes, never per frame. */
export function useMedia(query: string, initial = false): boolean {
  const [match, setMatch] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : initial));
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/**
 * Pinned, scroll-linked sections run only on a wide screen with motion allowed.
 * Below 768 px or under reduced motion each beat shows its static end state instead.
 */
export function usePinned(): boolean {
  const reduce = useReducedMotion();
  const wide = useMedia("(min-width: 768px)", true);
  return wide && !reduce;
}

/** Critically damped spring (damping ratio about 1), used for every scroll-following value. */
export const SPRING = { stiffness: 170, damping: 26, mass: 1 } as const;

/** The small sample-data label shown wherever numbers appear. */
export function SampleLabel({ className = "" }: { className?: string }) {
  return <span className={`sample-label ${className}`}>Sample data</span>;
}
