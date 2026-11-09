import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./SiteHeader";

const counts = { announcements: 2, events: 0, total: 2 };
vi.mock("@/lib/update-counts", () => ({
  useUpdateCounts: () => counts,
  SECTION_OF: { "/announcements": "announcements", "/events": "events" },
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ session: null, profile: null }),
}));
vi.mock("@/components/site/GoodbyeToast", () => ({
  useSignOutWithGoodbye: () => vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("./InstallButton", () => ({ InstallButton: () => null }));
vi.mock("./Logo", () => ({ Logo: () => null }));

describe("header badges", () => {
  it("shows how many new announcements there are, and none for events", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const announcements = within(nav).getByRole("link", {
      name: /announcements/i,
    });
    expect(within(announcements).getByText("2 new")).toBeInTheDocument();
    const events = within(nav).getByRole("link", { name: "Events" });
    expect(within(events).queryByText(/new/)).toBeNull();
  });

  it("shows the total on the menu button for small screens", () => {
    render(<SiteHeader />);
    const menu = screen.getByRole("button", { name: "Open menu" });
    expect(within(menu).getByText("2 new updates")).toBeInTheDocument();
  });
});
