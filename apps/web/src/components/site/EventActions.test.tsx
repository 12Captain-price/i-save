import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SiteEvent } from "@/lib/content";
import { EventActions } from "./EventActions";

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const base: SiteEvent = {
  id: "e1",
  title: "Members day",
  event_date: day(5),
  location: "City Hall, Bulawayo",
  summary: "Come along.",
  details: null,
  published: true,
  published_at: null,
  images: [],
};

describe("EventActions", () => {
  it("offers calendar choices and directions for an upcoming event", () => {
    render(<EventActions event={base} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    expect(
      screen.getByRole("link", { name: "Google Calendar" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("calendar.google.com/calendar/render"),
    );
    expect(
      screen.getByRole("button", { name: /\.ics file/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /get directions/i }),
    ).toHaveAttribute("href", expect.stringContaining("query=City%20Hall"));
  });

  it("hides the calendar button for a past event but keeps directions", () => {
    render(<EventActions event={{ ...base, event_date: day(-10) }} />);
    expect(screen.queryByRole("button", { name: /add to calendar/i })).toBeNull();
    expect(
      screen.getByRole("link", { name: /get directions/i }),
    ).toBeInTheDocument();
  });

  it("shows nothing for a past event with no place", () => {
    const { container } = render(
      <EventActions event={{ ...base, event_date: day(-10), location: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
