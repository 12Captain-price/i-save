// "Add to calendar" and "Get directions" links for an event. Events only have a calendar day
// (no start time), so they are added as all-day events. Plain logic, easy to test.

export type CalendarEvent = {
  title: string;
  /** "YYYY-MM-DD" (a longer ISO string is cut to its first ten characters). */
  day: string;
  location?: string | null;
  details?: string | null;
};

const dayOnly = (day: string) => day.slice(0, 10);

/** "2026-11-09" becomes "20261109", the form calendars expect. */
export function compactDay(day: string): string {
  return dayOnly(day).replaceAll("-", "");
}

/** The calendar day after this one, as "YYYY-MM-DD". All-day events end on the next day. */
export function nextDay(day: string): string {
  const [y, m, d] = dayOnly(day).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Month, day number and weekday for the date badge, e.g. { month: "NOV", day: "9", weekday: "Mon" }. */
export function dateParts(day: string): {
  month: string;
  day: string;
  weekday: string;
} {
  const [y, m, d] = dayOnly(day).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(date);
  return {
    month: fmt({ month: "short" }).toUpperCase(),
    day: String(d),
    weekday: fmt({ weekday: "short" }),
  };
}

const clip = (text: string | null | undefined, max: number) =>
  (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${compactDay(event.day)}/${compactDay(nextDay(event.day))}`,
  });
  const location = clip(event.location, 200);
  const details = clip(event.details, 800);
  if (location) params.set("location", location);
  if (details) params.set("details", details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** An .ics file that Apple Calendar, Outlook and most phones open directly. */
export function buildIcs(
  event: CalendarEvent,
  options: { uid?: string; now?: Date } = {},
): string {
  const now = options.now ?? new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const uid =
    options.uid ?? `${compactDay(event.day)}-${clip(event.title, 30)}@i-save`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//i-Save//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDay(event.day)}`,
    `DTEND;VALUE=DATE:${compactDay(nextDay(event.day))}`,
    `SUMMARY:${icsEscape(event.title)}`,
  ];
  const location = clip(event.location, 200);
  const details = clip(event.details, 800);
  if (location) lines.push(`LOCATION:${icsEscape(location)}`);
  if (details) lines.push(`DESCRIPTION:${icsEscape(details)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** Opens the place in the visitor's maps app (or Google Maps in the browser). */
export function directionsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
}
