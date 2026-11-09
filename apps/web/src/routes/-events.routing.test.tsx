import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { routeTree } from "../routeTree.gen";

// Pieces that need a signed-in session or a database are replaced with simple stand-ins;
// this test is only about which page the address shows.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://files.test/${path}` },
        }),
      }),
    },
  },
}));
vi.mock("@/components/site/PublicLayout", () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/assistant/AssistantWidget", () => ({
  AssistantWidget: () => null,
}));
vi.mock("@/components/site/SessionGuard", () => ({ SessionGuard: () => null }));
vi.mock("@/components/site/TrafficTracker", () => ({
  TrafficTracker: () => null,
}));
vi.mock("@/components/site/WelcomeCelebration", () => ({
  WelcomeCelebration: () => null,
}));
vi.mock("@/components/site/GoodbyeToast", () => ({ GoodbyeToast: () => null }));

const event = {
  id: "e1",
  published_at: null,
  title: "Marathon day",
  event_date: "2020-01-01",
  location: null,
  summary: "Run for your dreams",
  details: "All the details",
  published: true,
  images: [],
};
const futureEvent = {
  ...event,
  id: "e2",
  title: "Open day",
  event_date: "2999-01-01",
};
const notice = {
  id: "a1",
  title: "Office closed Friday",
  body: "The office is closed on Friday.",
  published: true,
  published_at: "2020-01-01T08:00:00Z",
  send_email: false,
  send_whatsapp: false,
  sent_at: null,
  recipients_in_app: null,
  recipients_email: null,
  recipients_whatsapp: null,
  created_at: "2020-01-01T08:00:00Z",
  files: [],
};
vi.mock("@/lib/content", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content")>()),
  useEvents: () => ({
    data: [event, futureEvent],
    isPending: false,
    isError: false,
  }),
  useEvent: () => ({ data: event, isPending: false, isError: false }),
  useAnnouncements: () => ({
    data: [notice],
    isPending: false,
    isError: false,
  }),
  useAnnouncement: () => ({ data: notice, isPending: false, isError: false }),
}));

window.scrollTo = vi.fn();

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("events routing", () => {
  it("shows the list at /events", async () => {
    renderAt("/events");
    expect(await screen.findByText("Events.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /marathon day/i }),
    ).toBeInTheDocument();
  });

  it("puts upcoming events above past events", async () => {
    renderAt("/events");
    const upcoming = await screen.findByRole("heading", { name: "Upcoming" });
    const past = screen.getByRole("heading", { name: "Past events" });
    expect(
      upcoming.compareDocumentPosition(past) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /open day/i })).toBeInTheDocument();
  });

  it("shows the single event, not the list, at /events/<id>", async () => {
    renderAt("/events/e1");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Marathon day" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Events.")).not.toBeInTheDocument();
    expect(screen.getByText("All the details")).toBeInTheDocument();
  });

  it("shows the announcements list at /announcements", async () => {
    renderAt("/announcements");
    expect(
      await screen.findByText("News from the office."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Office closed Friday" }),
    ).toBeInTheDocument();
  });

  it("shows the single announcement, not the list, at /announcements/<id>", async () => {
    renderAt("/announcements/a1");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Office closed Friday",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("News from the office.")).not.toBeInTheDocument();
    expect(
      screen.getByText("The office is closed on Friday."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /share: office closed friday/i }),
    ).toBeInTheDocument();
  });
});
