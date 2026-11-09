import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Announcement } from "@/lib/content";
import { AnnouncementCard } from "./AnnouncementCard";

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
// The card links to the announcement's own page; a plain link is enough here.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => (
    <a href="/announcements/a1" {...(rest as object)}>
      {children}
    </a>
  ),
}));

const base: Announcement = {
  id: "a1",
  title: "Annual meeting",
  body: "Short text.",
  published: true,
  published_at: new Date().toISOString(),
  send_email: false,
  send_whatsapp: false,
  sent_at: null,
  recipients_in_app: null,
  recipients_email: null,
  recipients_whatsapp: null,
  created_at: new Date().toISOString(),
  files: [],
};

describe("AnnouncementCard", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("tags a fresh notice as New and an old one not", () => {
    const { rerender } = render(<AnnouncementCard announcement={base} />);
    expect(screen.getByText("New")).toBeInTheDocument();
    rerender(
      <AnnouncementCard
        announcement={{ ...base, published_at: "2020-01-01T00:00:00Z" }}
      />,
    );
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("cuts a long notice and expands it with Read more", () => {
    const long = `${"The office will be closed for the holiday. ".repeat(12)}FINAL-SENTENCE`;
    render(<AnnouncementCard announcement={{ ...base, body: long }} />);
    expect(screen.queryByText(/FINAL-SENTENCE/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    expect(screen.getByText(/FINAL-SENTENCE/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText(/FINAL-SENTENCE/)).not.toBeInTheDocument();
  });

  it("has no Read more for a short notice", () => {
    render(<AnnouncementCard announcement={base} />);
    expect(screen.queryByRole("button", { name: "Read more" })).toBeNull();
  });

  it("opens an attached flier in the viewer", () => {
    render(
      <AnnouncementCard
        announcement={{
          ...base,
          files: [
            {
              id: "f1",
              path: "announcements/a1/flier.pdf",
              caption: "The flier",
              sort_order: 10,
              media_type: "pdf",
              file_name: "flier.pdf",
            },
          ],
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /open pdf: the flier/i }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toBeInTheDocument();
  });

  it("has a Share button", () => {
    render(<AnnouncementCard announcement={base} />);
    expect(
      screen.getByRole("button", { name: "Share: Annual meeting" }),
    ).toBeInTheDocument();
  });
});
