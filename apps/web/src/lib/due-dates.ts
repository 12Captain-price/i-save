// Pure date helpers for the due list (the office works in Zimbabwe time). No Supabase in this
// file, so tests need no environment variables.

/** Today's date in Zimbabwe as YYYY-MM-DD. Pass a Date to test. */
export function todayInZimbabwe(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days from one calendar day to another. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export type DueBucket = "overdue" | "week" | "month" | "later";

/** Where a due date sits compared with today. "week" includes today and the next 7 days. */
export function dueBucket(dueDate: string, today: string): DueBucket {
  const d = daysBetween(today, dueDate);
  if (d < 0) return "overdue";
  if (d <= 7) return "week";
  if (d <= 30) return "month";
  return "later";
}

/** "3 days overdue", "due today", "due tomorrow", "due in 5 days". */
export function dueWording(dueDate: string, today: string): string {
  const d = daysBetween(today, dueDate);
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`;
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  return `due in ${d} days`;
}

