import { Brand } from "./BrandMark";

/** Shown only in the static demo build (mock API). Says plainly that nothing here is real. */
export function DemoBanner() {
  return (
    <div role="note" className="border-b border-warn/25 bg-surface px-4 py-2 text-center text-[0.8125rem] leading-snug text-warn">
      Static demo with a built-in sample API. Nothing here sends email or changes a real deadline. The real system (Python, <Brand brand="gemini" size={14} /> agent, Monday schedule) runs locally from the repository.
    </div>
  );
}
