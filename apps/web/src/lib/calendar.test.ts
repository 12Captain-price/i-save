import { describe, expect, it } from "vitest";
import {
  buildIcs,
  compactDay,
  dateParts,
  directionsUrl,
  googleCalendarUrl,
  nextDay,
} from "./calendar";

describe("calendar helpers", () => {
  it("compacts and advances days, including month and year ends", () => {
    expect(compactDay("2026-11-09")).toBe("20261109");
    expect(compactDay("2026-11-09T00:00:00Z")).toBe("20261109");
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });

  it("gives the parts for the date badge", () => {
    expect(dateParts("2026-11-09")).toEqual({
      month: "NOV",
      day: "9",
      weekday: "Mon",
    });
  });

  it("builds a Google Calendar link as an all-day event", () => {
    const url = new URL(
      googleCalendarUrl({
        title: "AGM 2026",
        day: "2026-12-05",
        location: "Bulawayo Club",
      }),
    );
    expect(url.searchParams.get("text")).toBe("AGM 2026");
    expect(url.searchParams.get("dates")).toBe("20261205/20261206");
    expect(url.searchParams.get("location")).toBe("Bulawayo Club");
    expect(url.searchParams.has("details")).toBe(false);
  });

  it("builds an .ics file with escaped text and CRLF line ends", () => {
    const ics = buildIcs(
      { title: "Meet, greet; eat", day: "2026-12-05", location: null },
      { now: new Date("2026-11-09T10:00:00Z"), uid: "x@i-save" },
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTAMP:20261109T100000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261205");
    expect(ics).toContain("DTEND;VALUE=DATE:20261206");
    expect(ics).toContain("SUMMARY:Meet\\, greet\\; eat");
    expect(ics).not.toContain("LOCATION");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("builds a directions link", () => {
    expect(directionsUrl(" City Hall, Bulawayo ")).toBe(
      "https://www.google.com/maps/search/?api=1&query=City%20Hall%2C%20Bulawayo",
    );
  });
});
