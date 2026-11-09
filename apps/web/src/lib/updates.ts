// "What is new" helpers: event timing (today, in 5 days), upcoming vs past, the "New" tag on
// recent items, and the header badges that count what a visitor has not looked at yet.
// Everything here is plain logic, so it is easy to test.

export type Section = "announcements" | "events";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's calendar day on the visitor's own clock, as "YYYY-MM-DD". */
export function localDay(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Whole days from today to a calendar day: 0 is today, 1 is tomorrow, -1 is yesterday. */
export function daysUntil(day: string, now: Date = new Date()): number {
  return Math.round(dayNumber(day) - dayNumber(localDay(now)));
}

export function isUpcoming(day: string, now: Date = new Date()): boolean {
  return daysUntil(day, now) >= 0;
}

/** "Today", "Tomorrow", "In 5 days", "In 3 weeks" for upcoming events; null for past ones. */
export function timingLabel(
  day: string,
  now: Date = new Date(),
): string | null {
  const n = daysUntil(day, now);
  if (n < 0) return null;
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n <= 14) return `In ${n} days`;
  if (n <= 60) return `In ${Math.floor(n / 7)} weeks`;
  return null;
}

/** Upcoming events (soonest first), then past events (latest first). */
export function splitEvents<T extends { event_date: string }>(
  events: T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const upcoming = events
    .filter((e) => isUpcoming(e.event_date, now))
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const past = events
    .filter((e) => !isUpcoming(e.event_date, now))
    .sort((a, b) => b.event_date.localeCompare(a.event_date));
  return { upcoming, past };
}

/** The small label under an event card: "Video", "PDF", "3 files", or null when empty. */
export function filesLabel(
  media: Array<{ media_type: string }>,
): string | null {
  if (media.length === 0) return null;
  if (media.length === 1) {
    const kind = media[0].media_type;
    return kind === "video" ? "Video" : kind === "pdf" ? "PDF" : "1 picture";
  }
  const kinds = new Set(media.map((m) => m.media_type));
  if (kinds.size === 1) {
    const kind = [...kinds][0];
    if (kind === "image") return `${media.length} pictures`;
    if (kind === "video") return `${media.length} videos`;
    if (kind === "pdf") return `${media.length} PDFs`;
  }
  return `${media.length} files`;
}

/** True when something was published within the last `days` days (default 7). */
export function isRecent(
  publishedAt: string | null | undefined,
  now: Date = new Date(),
  days = 7,
): boolean {
  if (!publishedAt) return false;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return false;
  const age = now.getTime() - t;
  return age >= -DAY_MS && age <= days * DAY_MS;
}

/**
 * How many items were published after the visitor last opened the section. A visitor who has
 * never opened it only sees items from the last 14 days, so the badge never starts huge.
 */
export function countUnseen(
  items: Array<{ published_at: string | null }>,
  seenAt: string | null,
  now: Date = new Date(),
  firstVisitDays = 14,
): number {
  const seen = seenAt ? Date.parse(seenAt) : NaN;
  const floor = Number.isNaN(seen)
    ? now.getTime() - firstVisitDays * DAY_MS
    : seen;
  return items.filter((i) => {
    if (!i.published_at) return false;
    const t = Date.parse(i.published_at);
    return !Number.isNaN(t) && t > floor;
  }).length;
}

/** "9+" for big counts so the badge stays small. */
export function badgeText(count: number): string {
  return count > 9 ? "9+" : String(count);
}

/* ------------------------------------------------------------------ */
/* Remembering what was seen (this browser only)                       */
/* ------------------------------------------------------------------ */

const KEY = (s: Section) => `isave:seen:${s}`;
export const SEEN_EVENT = "isave-seen";

export function readSeen(section: Section): string | null {
  try {
    return window.localStorage.getItem(KEY(section));
  } catch {
    return null; // storage blocked: every recent item shows as new, which is harmless
  }
}

/** Call when the visitor opens a section; the header badge for it clears. */
export function markSeen(section: Section, now: Date = new Date()): void {
  try {
    window.localStorage.setItem(KEY(section), now.toISOString());
  } catch {
    // ignore: nothing to remember it with
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

/** Cuts long text at a word boundary for a "Read more" preview. */
export function shorten(
  text: string,
  max = 320,
): { text: string; cut: boolean } {
  if (text.length <= max) return { text, cut: false };
  const head = text.slice(0, max);
  const lastSpace = head.search(/\s\S*$/);
  const base = (
    lastSpace > max * 0.6 ? head.slice(0, lastSpace) : head
  ).trimEnd();
  return { text: `${base}…`, cut: true };
}
