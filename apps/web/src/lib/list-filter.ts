// Small helpers for the search boxes on the Events, Announcements and FAQ pages.

/** True when every word typed appears somewhere in the given text (ignoring case). */
export function matchesQuery(
  fields: Array<string | null | undefined>,
  query: string,
): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = fields.filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => text.includes(w));
}

/** The year of "2026-11-09" or an ISO timestamp, as text. */
export function yearOf(day: string): string {
  return day.slice(0, 4);
}

/** The years present in a list, newest first, without repeats. */
export function yearsOf(days: string[]): string[] {
  return [...new Set(days.map(yearOf))].sort((a, b) => b.localeCompare(a));
}
