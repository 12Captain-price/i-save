// Pure helpers for traffic tracking. No database or browser code here, so they are easy to test.

/** Screens that are never counted: admin and sign-in. The database ignores them too. */
const UNTRACKED = ["/staff", "/login", "/forgot-password", "/reset-password"];

/** Strips the query and #section, drops a trailing slash and caps the length. */
export function cleanPath(input: string): string {
  const bare = input.split("#")[0]!.split("?")[0]!.trim();
  if (!bare.startsWith("/")) return "/";
  const noSlash = bare.length > 1 ? bare.replace(/\/+$/, "") : bare;
  return (noSlash || "/").slice(0, 200);
}

export function shouldTrack(path: string): boolean {
  return !UNTRACKED.some((p) => path === p || path.startsWith(p + "/"));
}

/** True for a link that goes to the Apply page ("/apply", "/apply?x=1"), not "/applying". */
export function isApplyHref(href: string | null): boolean {
  if (!href || !href.startsWith("/")) return false;
  return cleanPath(href) === "/apply";
}

/** Today in Zimbabwe as YYYY-MM-DD. The database counts days the same way. */
export function todayInHarare(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds (or subtracts) whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type RangePreset = "7d" | "30d" | "90d" | "month";

export const PRESET_LABEL: Record<RangePreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month: "This month",
};

export function rangeForPreset(
  preset: RangePreset,
  today: string,
): { from: string; to: string } {
  switch (preset) {
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns a message for a bad range, or null when it is fine (up to one year, like the database). */
export function validateRange(from: string, to: string): string | null {
  if (!DATE.test(from) || !DATE.test(to)) return "Choose both dates.";
  if (to < from) return "The end date cannot be before the start date.";
  if (addDays(from, 366) < to) return "Choose a range of up to one year.";
  return null;
}

/** "12.5%", or a dash when there is nothing to divide by. */
export function percent(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

/** Bar width (0 to 100) for a value next to the biggest value in the same list. */
export function barWidth(value: number, max: number): number {
  if (!max || value <= 0) return 0;
  return Math.max(2, Math.round((value / max) * 100));
}
