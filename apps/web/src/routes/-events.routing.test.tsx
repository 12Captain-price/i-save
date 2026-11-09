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
  PublicLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  title: "Marathon day",
  event_date: "2026-11-06",
  location: null,
  summary: "Run for your dreams",
  details: "All the details",
  published: true,
  images: [],
};
vi.mock("@/lib/content", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content")>()),
  useEvents: () => ({ data: [event], isPending: false, isError: false }),
  useEvent: () => ({ data: event, isPending: false, isError: false }),
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
    expect(await screen.findByText("Recent events.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /marathon day/i })).toBeInTheDocument();
  });

  it("shows the single event, not the list, at /events/<id>", async () => {
    renderAt("/events/e1");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Marathon day" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Recent events.")).not.toBeInTheDocument();
    expect(screen.getByText("All the details")).toBeInTheDocument();
  });
});
