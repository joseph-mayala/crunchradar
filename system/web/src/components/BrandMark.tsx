import calendarUrl from "../assets/brands/google-calendar.svg";
import driveUrl from "../assets/brands/google-drive.svg";
import geminiUrl from "../assets/brands/gemini.svg";
import outlookUrl from "../assets/brands/outlook.svg";
import gmailUrl from "../assets/brands/gmail.svg";
import mcpUrl from "../assets/brands/mcp.svg";
import githubUrl from "../assets/brands/github.svg";

/**
 * Real product logos, shown in their own brand colours. Do not recolour, crop or restyle them (brand guidelines).
 * They only identify products this project connects to. Pair with a text label so the meaning never depends on the image.
 */
export const BRANDS = {
  gemini: { name: "Gemini", src: geminiUrl },
  "google-calendar": { name: "Google Calendar", src: calendarUrl },
  "google-drive": { name: "Google Drive", src: driveUrl },
  outlook: { name: "Microsoft Outlook", src: outlookUrl },
  gmail: { name: "Gmail", src: gmailUrl },
  mcp: { name: "Model Context Protocol", src: mcpUrl },
  github: { name: "GitHub", src: githubUrl },
} as const;

export type BrandKey = keyof typeof BRANDS;

export function BrandMark({ brand, size = 20, className = "" }: { brand: BrandKey; size?: number; className?: string }) {
  const b = BRANDS[brand];
  // Decorative: the product name is always written next to it, so screen readers get the text, not the picture.
  return <img src={b.src} width={size} height={size} alt="" aria-hidden="true" draggable={false} className={`inline-block shrink-0 align-[-0.2em] ${className}`} style={{ width: size, height: size, objectFit: "contain" }} />;
}

/** A product name with its logo, for inline use: <Brand brand="gemini" /> */
export function Brand({ brand, size = 18, label }: { brand: BrandKey; size?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-[0.4em] whitespace-nowrap align-middle">
      <BrandMark brand={brand} size={size} />
      <span>{label ?? BRANDS[brand].name}</span>
    </span>
  );
}

export function TrademarkNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-mute ${className}`}>
      Google, Gemini, Google Calendar, Google Drive and Gmail are trademarks of Google LLC. Microsoft and Outlook are trademarks of the Microsoft group of companies. GitHub is a trademark of GitHub, Inc.
      Logos are used only to identify the products CrunchRadar connects to. No endorsement is implied.
    </p>
  );
}
