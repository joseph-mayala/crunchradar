/** docs/brand/logo.svg, inlined. Do not recolour the needle or the dot. */
export function LogoMark({ size = 32, title = "CrunchRadar" }: { size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={title} className="shrink-0">
      <g fill="none" strokeLinecap="round">
        <path d="M54.05 18.22 A26 26 0 1 0 54.05 45.78" stroke="#f5f5f6" strokeWidth="5" />
        <path d="M44.72 24.05 A15 15 0 1 0 44.72 39.95" stroke="#f5f5f6" strokeOpacity=".55" strokeWidth="3.5" />
        <path d="M32 32 L57.43 26.59" stroke="#b3a1ff" strokeWidth="4" />
      </g>
      <circle cx="32" cy="32" r="2.6" fill="#f5f5f6" />
      <circle cx="57.43" cy="26.59" r="4" fill="#c6f432" />
    </svg>
  );
}

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} title="" />
      <span className="font-display text-[1.1875rem] font-extrabold tracking-[-0.045em] text-ink">CrunchRadar</span>
    </span>
  );
}
