/*
 * The landing page's section map and the pure rule for which one is "active".
 * No React, no DOM, so the choice can be unit tested.
 */

export interface SectionLink {
  /** id of the section wrapper (for pinned beats, the tall wrapper, so a jump lands at the start of the pin) */
  id: string;
  /** id of the heading that receives focus after the jump */
  heading: string;
  label: string;
}

export const SECTIONS: SectionLink[] = [
  { id: "the-fix", heading: "relief-h", label: "The fix" },
  { id: "monday-agent", heading: "log-h", label: "Monday agent" },
  { id: "safeguards", heading: "pan-h", label: "Safeguards" },
  { id: "real-vs-sample", heading: "honest-h", label: "Real vs sample" },
  { id: "plugs-in", heading: "belt-h", label: "Plugs in" },
  { id: "who-it-is-for", heading: "roles-h", label: "Who it is for" },
];

/**
 * Pick one active section from intersection ratios against a thin probe band.
 * The highest ratio wins; ties go to the section that comes first on the page.
 * Returns null when nothing touches the band (for example over the hero or the close).
 */
export function pickActive(order: string[], ratios: Record<string, number | undefined>): string | null {
  let best: string | null = null;
  let bestR = 0;
  for (const id of order) {
    const r = ratios[id] ?? 0;
    if (r > bestR) {
      best = id;
      bestR = r;
    }
  }
  return best;
}

/** Where the window should scroll so the section's top sits just under the sticky bar. */
export function jumpTarget(sectionTop: number, scrollY: number, marginTop: number, maxScroll: number): number {
  const y = Math.round(sectionTop + scrollY - marginTop);
  return Math.min(Math.max(0, y), Math.max(0, maxScroll));
}
