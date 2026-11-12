/** Shown only in the static demo build (mock API). Says plainly that nothing here is real. */
export function DemoBanner() {
  return (
    <div role="note" className="border-b border-[rgba(255,198,92,.25)] bg-[rgba(255,198,92,.08)] px-4 py-2 text-center text-[0.8125rem] leading-snug text-[#ffc65c]">
      Static demo with a built-in sample API. Nothing here sends email or changes a real deadline. The real system (Python, Gemini agent, Monday schedule) runs locally from the repository.
    </div>
  );
}
