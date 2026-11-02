import { describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import { renderEmailHtml, sendQueuedEmails } from "./notify";

const env: Env = {
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
  ALLOWED_ORIGIN: "https://app",
  APP_URL: "https://app",
  RESEND_API_KEY: "re_key",
  EMAIL_FROM: "iSave <n@example.com>",
};

const row = (over: Record<string, unknown> = {}) => ({
  id: "n1",
  subject: "Payment confirmed",
  body: "Your payment was confirmed.",
  attempts: 0,
  profiles: { email: "a@b.com", full_name: "Ana", email_opt_in: true },
  ...over,
});

function mockFetch(rows: unknown[], resend: Response) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/rest/v1/notifications?select"))
      return new Response(JSON.stringify(rows), { status: 200 });
    if (u.startsWith("https://api.resend.com")) return resend.clone();
    if (init?.method === "PATCH") return new Response(null, { status: 204 });
    return new Response("nope", { status: 500 });
  });
}

const patches = (f: ReturnType<typeof mockFetch>) =>
  f.mock.calls
    .filter(([, init]) => init?.method === "PATCH")
    .map(([, init]) => JSON.parse(String(init?.body)));

describe("sendQueuedEmails", () => {
  it("does nothing when Resend is not configured", async () => {
    const f = mockFetch([row()], new Response("{}"));
    const s = await sendQueuedEmails(
      { ...env, RESEND_API_KEY: undefined },
      f,
      async () => {},
    );
    expect(s).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(f).not.toHaveBeenCalled();
  });

  it("sends and marks the row sent", async () => {
    const f = mockFetch(
      [row()],
      new Response(JSON.stringify({ id: "re_1" }), { status: 200 }),
    );
    const s = await sendQueuedEmails(env, f, async () => {});
    expect(s.sent).toBe(1);
    const [p] = patches(f);
    expect(p.status).toBe("sent");
    expect(p.provider_message_id).toBe("re_1");
  });

  it("stops without using up attempts when rate limited", async () => {
    const f = mockFetch(
      [row(), row({ id: "n2" })],
      new Response("{}", { status: 429 }),
    );
    const s = await sendQueuedEmails(env, f, async () => {});
    expect(s).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(patches(f)).toHaveLength(0);
    expect(
      f.mock.calls.filter(([u]) => String(u).includes("resend")),
    ).toHaveLength(1);
  });

  it("keeps the row queued after a first failure", async () => {
    const f = mockFetch([row()], new Response("{}", { status: 500 }));
    const s = await sendQueuedEmails(env, f, async () => {});
    expect(s.failed).toBe(1);
    expect(patches(f)[0]).toMatchObject({ status: "queued", attempts: 1 });
  });

  it("gives up after the last attempt", async () => {
    const f = mockFetch(
      [row({ attempts: 4 })],
      new Response("{}", { status: 500 }),
    );
    await sendQueuedEmails(env, f, async () => {});
    expect(patches(f)[0]).toMatchObject({ status: "failed", attempts: 5 });
  });

  it("skips members with no email or who opted out", async () => {
    const f = mockFetch(
      [
        row({
          profiles: { email: "a@b.com", full_name: "Ana", email_opt_in: false },
        }),
      ],
      new Response("{}"),
    );
    const s = await sendQueuedEmails(env, f, async () => {});
    expect(s.skipped).toBe(1);
    expect(f.mock.calls.some(([u]) => String(u).includes("resend"))).toBe(
      false,
    );
  });
});

describe("renderEmailHtml", () => {
  it("escapes markup in names and bodies", () => {
    const html = renderEmailHtml(
      "<b>X</b>",
      "<script>1</script>",
      "https://app/",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>X</b>");
  });
});
