import { describe, expect, it } from "vitest";
import { handleRequest } from "./handler";
import type { Env } from "./env";

const env: Env = {
  SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "SECRET-SERVICE-KEY",
  ALLOWED_ORIGIN: "https://isave.example",
  APP_URL: "https://isave.example/",
  AI: {
    run: async () => ({ response: "Hello from the assistant." }),
  },
};

function fake(opts: { roles?: string[]; tokenValid?: boolean } = {}) {
  const o = { roles: [] as string[], tokenValid: true, ...opts };
  const prompts: string[] = [];
  const ai = {
    run: async (_model: string, input: unknown) => {
      const m = (input as { messages: Array<{ content: string }> }).messages;
      prompts.push(m[0]?.content ?? "");
      return { response: "Hello from the assistant." };
    },
  };
  const doFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const ok = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status });
    if (url.includes("/auth/v1/user"))
      return o.tokenValid ? ok({ id: "user-1" }) : ok({}, 401);
    if (url.includes("user_roles"))
      return ok(o.roles.map((role) => ({ role })));
    if (url.includes("profiles"))
      return ok([
        { full_name: "Rudo Moyo", member_number: "M1", status: "pending" },
      ]);
    return ok([]);
  }) as typeof fetch;
  return { doFetch, ai, prompts };
}

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://isave.example/assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://isave.example",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
const ask = (audience: string) => ({
  audience,
  messages: [{ role: "user", content: "How do I join?" }],
});

describe("POST /assistant", () => {
  it("is off until an AI service is set up", async () => {
    const f = fake();
    const res = await handleRequest(
      req(ask("home")),
      { ...env, AI: undefined },
      f.doFetch,
    );
    expect(res.status).toBe(503);
  });

  it("refuses other origins", async () => {
    const f = fake();
    const res = await handleRequest(
      req(ask("home"), { Origin: "https://evil.example" }),
      { ...env, AI: f.ai },
      f.doFetch,
    );
    expect(res.status).toBe(403);
  });

  it("answers visitors without sign-in and never leaks the keys", async () => {
    const f = fake();
    const res = await handleRequest(
      req(ask("home")),
      { ...env, AI: f.ai },
      f.doFetch,
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { reply: string }).toMatchObject({
      ok: true,
      reply: "Hello from the assistant.",
    });
    expect(f.prompts[0]).toContain("AUDIENCE: a visitor");
    expect(f.prompts[0]).not.toContain("SECRET-SERVICE-KEY");
  });

  it("needs sign-in for members and gives the member guide", async () => {
    const f = fake();
    expect(
      (await handleRequest(req(ask("member")), { ...env, AI: f.ai }, f.doFetch))
        .status,
    ).toBe(401);
    const res = await handleRequest(
      req(ask("member"), { Authorization: "Bearer t" }),
      { ...env, AI: f.ai },
      f.doFetch,
    );
    expect(res.status).toBe(200);
    expect(f.prompts[0]).toContain("signed-in member");
    expect(f.prompts[0]).toContain('status "pending"');
  });

  it("keeps the staff guide for staff only", async () => {
    const member = fake({ roles: ["member"] });
    const denied = await handleRequest(
      req(ask("staff"), { Authorization: "Bearer t" }),
      { ...env, AI: member.ai },
      member.doFetch,
    );
    expect(denied.status).toBe(403);

    const staff = fake({ roles: ["finance"] });
    const ok = await handleRequest(
      req(ask("staff"), { Authorization: "Bearer t" }),
      { ...env, AI: staff.ai },
      staff.doFetch,
    );
    expect(ok.status).toBe(200);
    expect(staff.prompts[0]).toContain("office staff using the staff area");
  });

  it("rejects empty or oversized messages", async () => {
    const f = fake();
    const res = await handleRequest(
      req({
        audience: "home",
        messages: [{ role: "user", content: "x".repeat(1001) }],
      }),
      { ...env, AI: f.ai },
      f.doFetch,
    );
    expect(res.status).toBe(400);
  });
});
