import { beforeEach, describe, expect, it } from "vitest";
import {
  badgeText,
  countUnseen,
  daysUntil,
  filesLabel,
  isRecent,
  isUpcoming,
  markSeen,
  readSeen,
  shorten,
  splitEvents,
  timingLabel,
} from "./updates";

// 10 November 2026, midday on the visitor's clock.
const now = new Date(2026, 10, 10, 12, 0, 0);

describe("event timing", () => {
  it("counts whole days from today", () => {
    expect(daysUntil("2026-11-10", now)).toBe(0);
    expect(daysUntil("2026-11-11", now)).toBe(1);
    expect(daysUntil("2026-11-15", now)).toBe(5);
    expect(daysUntil("2026-11-09", now)).toBe(-1);
    expect(daysUntil("2027-01-01", now)).toBe(52);
  });

  it("treats today as upcoming and yesterday as past", () => {
    expect(isUpcoming("2026-11-10", now)).toBe(true);
    expect(isUpcoming("2026-11-09", now)).toBe(false);
  });

  it("words the countdown", () => {
    expect(timingLabel("2026-11-10", now)).toBe("Today");
    expect(timingLabel("2026-11-11", now)).toBe("Tomorrow");
    expect(timingLabel("2026-11-15", now)).toBe("In 5 days");
    expect(timingLabel("2026-11-24", now)).toBe("In 14 days");
    expect(timingLabel("2026-12-01", now)).toBe("In 3 weeks");
    expect(timingLabel("2027-06-01", now)).toBeNull();
    expect(timingLabel("2026-11-01", now)).toBeNull();
  });

  it("puts upcoming events first (soonest first) and past ones after (latest first)", () => {
    const { upcoming, past } = splitEvents(
      [
        { id: "a", event_date: "2026-10-01" },
        { id: "b", event_date: "2026-12-01" },
        { id: "c", event_date: "2026-11-10" },
        { id: "d", event_date: "2026-11-05" },
      ],
      now,
    );
    expect(upcoming.map((e) => e.id)).toEqual(["c", "b"]);
    expect(past.map((e) => e.id)).toEqual(["d", "a"]);
  });
});

describe("files label", () => {
  it("says what is inside", () => {
    expect(filesLabel([])).toBeNull();
    expect(filesLabel([{ media_type: "video" }])).toBe("Video");
    expect(filesLabel([{ media_type: "pdf" }])).toBe("PDF");
    expect(filesLabel([{ media_type: "image" }])).toBe("1 picture");
    expect(filesLabel([{ media_type: "image" }, { media_type: "image" }])).toBe(
      "2 pictures",
    );
    expect(filesLabel([{ media_type: "image" }, { media_type: "pdf" }])).toBe(
      "2 files",
    );
  });
});

describe("new items", () => {
  it("tags what was published in the last week", () => {
    expect(isRecent("2026-11-08T08:00:00Z", now)).toBe(true);
    expect(isRecent("2026-10-20T08:00:00Z", now)).toBe(false);
    expect(isRecent(null, now)).toBe(false);
    expect(isRecent("not a date", now)).toBe(false);
  });

  it("counts what was published after the last visit", () => {
    const items = [
      { published_at: "2026-11-09T10:00:00Z" },
      { published_at: "2026-11-03T10:00:00Z" },
      { published_at: null },
    ];
    expect(countUnseen(items, "2026-11-05T00:00:00Z", now)).toBe(1);
    expect(countUnseen(items, "2026-10-01T00:00:00Z", now)).toBe(2);
    expect(countUnseen(items, "2026-11-10T00:00:00Z", now)).toBe(0);
  });

  it("limits a first-time visitor to the last 14 days", () => {
    const items = [
      { published_at: "2026-11-09T10:00:00Z" },
      { published_at: "2026-09-01T10:00:00Z" },
    ];
    expect(countUnseen(items, null, now)).toBe(1);
  });

  it("keeps the badge small", () => {
    expect(badgeText(3)).toBe("3");
    expect(badgeText(10)).toBe("9+");
  });
});

describe("remembering what was seen", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores the time a section was opened", () => {
    expect(readSeen("events")).toBeNull();
    markSeen("events", now);
    expect(readSeen("events")).toBe(now.toISOString());
    expect(readSeen("announcements")).toBeNull();
  });
});

describe("read more", () => {
  it("leaves short text alone", () => {
    expect(shorten("Short notice", 50)).toEqual({
      text: "Short notice",
      cut: false,
    });
  });

  it("cuts long text at a word and adds an ellipsis", () => {
    const r = shorten(
      "The office will be closed on Friday for the public holiday",
      40,
    );
    expect(r.cut).toBe(true);
    expect(r.text).toBe("The office will be closed on Friday for…");
  });
});
