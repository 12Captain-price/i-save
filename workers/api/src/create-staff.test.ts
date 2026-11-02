import { describe, expect, it } from "vitest";
import { handleRequest } from "./handler";
import type { Env } from "./env";

const env: Env = {
  SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "SECRET",
  ALLOWED_ORIGIN: "https://isave.example",
  APP_URL: "https://isave.example/",
};

const body = {
  fullName: "Tendai Moyo",
  email: "tendai@example.com",
  phone: "0771234567",
  role: "finance",
};

type Call = { url: string; method: string; body: unknown };

function fake(
  o: {
    token?: boolean;
    allowed?: boolean;
    clash?: boolean;
    grantOk?: boolean;
    mailOk?: boolean;
  } = {},
) {
  const opt = {
    token: true,
    allowed: true,
    clash: false,
    grantOk: true,
    mailOk: true,
    ...o,
  };
  const calls: Call[] = [];
  const j = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const doFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (url.endsWith("/auth/v1/user"))
      return opt.token ? j({ id: "actor-1" }) : j({}, 401);
    if (url.includes("/rpc/staff_grant_allowed")) return j(opt.allowed);
    if (url.includes("/rest/v1/profiles?select=id"))
      return j(opt.clash ? [{ id: "x" }] : []);
    if (url.endsWith("/auth/v1/admin/users")) return j({ id: "new-1" });
    if (url.includes("/rpc/grant_staff_role"))
      return opt.grantOk ? j(null) : j({}, 403);
    if (url.includes("/auth/v1/admin/users/new-1")) return j({});
    if (url.includes("/auth/v1/recover"))
      return opt.mailOk ? j({}) : j({}, 429);
    return j({}, 404);
  }) as typeof fetch;
  return { doFetch, calls };
}

const post = (b: unknown, auth = "Bearer good") =>
  new Request("https://api.test/staff/create-staff", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });

const created = (calls: Call[]) =>
  calls.filter(
    (c) => c.url.endsWith("/auth/v1/admin/users") && c.method === "POST",
  );

describe("POST /staff/create-staff", () => {
  it("needs a sign-in", async () => {
    const { doFetch, calls } = fake({ token: false });
    expect((await handleRequest(post(body), env, doFetch)).status).toBe(401);
    expect(created(calls)).toHaveLength(0);
  });

  it("refuses when the database says the caller may not create this role", async () => {
    const { doFetch, calls } = fake({ allowed: false });
    const res = await handleRequest(
      post({ ...body, role: "admin" }),
      env,
      doFetch,
    );
    expect(res.status).toBe(403);
    expect(created(calls)).toHaveLength(0);
  });

  it("rejects bad details with field messages", async () => {
    const { doFetch, calls } = fake();
    const res = await handleRequest(
      post({ ...body, email: "nope" }),
      env,
      doFetch,
    );
    expect(res.status).toBe(400);
    expect(
      ((await res.json()) as { fieldErrors: Record<string, string> })
        .fieldErrors.email,
    ).toBeTruthy();
    expect(created(calls)).toHaveLength(0);
  });

  it("will not create a clashing account", async () => {
    const { doFetch, calls } = fake({ clash: true });
    expect((await handleRequest(post(body), env, doFetch)).status).toBe(409);
    expect(created(calls)).toHaveLength(0);
  });

  it("creates the account, grants the role and emails a set-password link", async () => {
    const { doFetch, calls } = fake();
    const res = await handleRequest(post(body), env, doFetch);
    expect(res.status).toBe(201);
    const out = (await res.json()) as {
      result: { userId: string; emailSent: boolean };
    };
    expect(out.result).toEqual({ userId: "new-1", emailSent: true });
    const grant = calls.find((c) => c.url.includes("/rpc/grant_staff_role"));
    expect(grant?.body).toEqual({
      p_user: "new-1",
      p_actor: "actor-1",
      p_role: "finance",
    });
  });

  it("removes the new sign-in account if the role cannot be granted", async () => {
    const { doFetch, calls } = fake({ grantOk: false });
    const res = await handleRequest(post(body), env, doFetch);
    expect(res.status).toBe(502);
    expect(
      calls.some(
        (c) => c.method === "DELETE" && c.url.endsWith("/admin/users/new-1"),
      ),
    ).toBe(true);
  });

  it("still succeeds, and says so, when only the email fails", async () => {
    const { doFetch } = fake({ mailOk: false });
    const res = await handleRequest(post(body), env, doFetch);
    expect(res.status).toBe(201);
    expect(
      ((await res.json()) as { result: { emailSent: boolean } }).result
        .emailSent,
    ).toBe(false);
  });
});
