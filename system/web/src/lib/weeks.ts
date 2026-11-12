/** Week and date helpers. Weeks are 1-based; week 1 starts on semester_start (a Monday). */

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/** UTC timestamp of the Monday that starts week w. */
export function weekStart(semesterStart: string, w: number): number {
  return parseDay(semesterStart) + (w - 1) * 7 * DAY;
}

/** "4 Jan" style label for the Monday of week w. */
export function weekDate(semesterStart: string, w: number): string {
  const d = new Date(weekStart(semesterStart, w));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Which teaching week a moment falls in, clamped to 1..weeks. */
export function weekOf(semesterStart: string, at: Date | number, weeks: number): number {
  const t = typeof at === "number" ? at : at.getTime();
  const w = Math.floor((t - parseDay(semesterStart)) / (7 * DAY)) + 1;
  return Math.min(Math.max(w, 1), weeks);
}

export function weekRange(weeks: number): number[] {
  return Array.from({ length: Math.max(0, weeks) }, (_, i) => i + 1);
}

/** "2026-11-12 07:10 UTC" from an ISO timestamp; returns the input when unparseable. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(t)) return iso;
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

/** Short "12 Nov 07:10" for tables. */
export function fmtShort(iso: string | null | undefined): string {
  const full = fmtDateTime(iso);
  const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)/.exec(full);
  if (!m) return full;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[4]}`;
}

/** Plain-words time left until an ISO timestamp: "expires in 2 days", "expired". */
export function expiryText(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "no expiry";
  const t = Date.parse(iso.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(t)) return "";
  const diff = t - now;
  if (diff <= 0) return "expired";
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return "expires in under an hour";
  if (h < 48) return `expires in ${h} h`;
  return `expires in ${Math.round(h / 24)} days`;
}
