import { describe, expect, it } from "vitest";
import { handleRequest } from "./handler";
import type { Env } from "./env";

const env: Env = {
  SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "SECRET-SERVICE-KEY",
  ALLOWED_ORIGIN: "http://localhost:5173, https://isave.example",
  APP_URL: "https://isave.example/",
};

const goodBody = {
  fullName: "Rudo Moyo",
  email: "rudo@example.com",
  phone: "0771234567",
  nationalId: "63-123456-A-12",
  categoryInterest: "education",
  ageConfirmed: true,
  termsAccepted: true,
};

type Call = {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
};

/** A pretend Supabase. Each switch changes one answer so a test can break one thing at a time. */
function fakeSupabase(
  opts: {
    callerRoles?: string[];
    tokenValid?: boolean;
    phoneTaken?: boolean;
    idTaken?: boolean;
    emailTaken?: boolean;
    createStatus?: number;
    createErrorCode?: string;
    auditOk?: boolean;
    mailOk?: boolean;
  } = {},
) {
  const calls: Call[] = [];
  const o = {
    callerRoles: ["finance"],
    tokenValid: true,
    createStatus: 200,
    auditOk: true,
    mailOk: true,
    ...opts,
  };
  const doFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method: init?.method ?? "GET", body, headers });
    const ok = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });

    if (url.endsWith("/auth/v1/user"))
      return o.tokenValid ? ok({ id: "staff-1" }) : ok({}, 401);
    if (url.includes("/rest/v1/user_roles"))
      return ok(o.callerRoles.map((role) => ({ role })));
    if (url.includes("/rest/v1/profiles?select=id&phone="))
      return ok(o.phoneTaken ? [{ id: "x" }] : []);
    if (url.includes("/rest/v1/member_identity"))
      return ok(o.idTaken ? [{ member_id: "x" }] : []);
    if (url.includes("/rest/v1/profiles?select=id&email="))
      return ok(o.emailTaken ? [{ id: "x" }] : []);
    if (url.endsWith("/auth/v1/admin/users")) {
      return o.createStatus === 200
        ? ok({ id: "new-member-1" })
        : ok(
            {
              error_code: o.createErrorCode ?? "unexpected_failure",
              msg: "internal detail",
            },
            o.createStatus,
          );
    }
    if (url.includes("/rpc/log_office_registration"))
      return o.auditOk ? ok(null, 200) : ok({}, 500);
    if (url.includes("/auth/v1/recover"))
      return o.mailOk ? ok({}) : ok({}, 429);
    if (url.includes("/rest/v1/profiles?select=member_number"))
      return ok([{ member_number: "ISV-000042" }]);
    return ok({}, 404);
  }) as typeof fetch;
  return { doFetch, calls };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://api.test/staff/register-member", {
    method: "POST",
    headers: {
      Authorization: "Bearer good-token",
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

type Json = {
  ok: boolean;
  fieldErrors: Record<string, string>;
  result: Record<string, unknown>;
};
const jsonOf = async (res: Response): Promise<Json> =>
  (await res.json()) as Json;

const createCalls = (calls: Call[]) =>
  calls.filter((c) => c.url.endsWith("/auth/v1/admin/users"));

describe("who may register an applicant", () => {
  it("refuses a request with no sign-in", async () => {
    const { doFetch, calls } = fakeSupabase();
    const res = await handleRequest(
      post(goodBody, { Authorization: "" }),
      env,
      doFetch,
    );
    expect(res.status).toBe(401);
    expect(createCalls(calls)).toHaveLength(0);
  });
  it("refuses an invalid or expired token", async () => {
    const { doFetch, calls } = fakeSupabase({ tokenValid: false });
    const res = await handleRequest(post(goodBody), env, doFetch);
    expect(res.status).toBe(401);
    expect(createCalls(calls)).toHaveLength(0);
  });
  it("refuses a signed-in member who is not staff", async () => {
    const { doFetch, calls } = fakeSupabase({ callerRoles: [] });
    const res = await handleRequest(post(goodBody), env, doFetch);
    expect(res.status).toBe(403);
    expect(createCalls(calls)).toHaveLength(0);
  });
});

describe("checking the details", () => {
  it("returns field messages for bad details and creates nothing", async () => {
    const { doFetch, calls } = fakeSupabase();
    const res = await handleRequest(
      post({ ...goodBody, phone: "12", ageConfirmed: false }),
      env,
      doFetch,
    );
    const data = await jsonOf(res);
    expect(res.status).toBe(400);
    expect(data.fieldErrors.phone).toBeTruthy();
    expect(data.fieldErrors.ageConfirmed).toBeTruthy();
    expect(createCalls(calls)).toHaveLength(0);
  });
  it("rejects a body that is not JSON", async () => {
    const { doFetch } = fakeSupabase();
    const res = await handleRequest(post("not json"), env, doFetch);
    expect(res.status).toBe(400);
  });
  it("says which detail clashes, and never repeats the ID number", async () => {
    const { doFetch, calls } = fakeSupabase({
      idTaken: true,
      phoneTaken: true,
    });
    const res = await handleRequest(post(goodBody), env, doFetch);
    const text = await res.text();
    expect(res.status).toBe(409);
    expect(text).toContain("phone number");
    expect(text).toContain("ID number");
    expect(text).not.toContain("63123456A12");
    expect(createCalls(calls)).toHaveLength(0);
  });
  it("turns a provider 'email exists' into a plain message", async () => {
    const { doFetch } = fakeSupabase({
      createStatus: 422,
      createErrorCode: "email_exists",
    });
    const res = await handleRequest(post(goodBody), env, doFetch);
    expect(res.status).toBe(409);
    expect((await jsonOf(res)).fieldErrors.email).toBeTruthy();
  });
  it("hides provider error text when creation fails", async () => {
    const { doFetch } = fakeSupabase({ createStatus: 500 });
    const res = await handleRequest(post(goodBody), env, doFetch);
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).not.toContain("internal detail");
  });
});

describe("a good registration", () => {
  it("creates an office-registered account with no password", async () => {
    const { doFetch, calls } = fakeSupabase();
    const res = await handleRequest(post(goodBody), env, doFetch);
    const data = await jsonOf(res);
    expect(res.status).toBe(201);
    expect(data.result).toEqual({
      memberId: "new-member-1",
      memberNumber: "ISV-000042",
      emailSent: true,
      auditLogged: true,
    });

    const [create] = createCalls(calls);
    const sent = create!.body as Record<string, unknown>;
    expect(sent.app_metadata).toEqual({ registered_via: "staff" });
    expect(sent).not.toHaveProperty("password");
    expect(sent.email).toBe("rudo@example.com");
    expect((sent.user_metadata as Record<string, string>).phone).toBe(
      "+263771234567",
    );
    expect((sent.user_metadata as Record<string, string>).national_id).toBe(
      "63123456A12",
    );
  });
  it("writes the audit row with the staff member as actor", async () => {
    const { doFetch, calls } = fakeSupabase();
    await handleRequest(post(goodBody), env, doFetch);
    const audit = calls.find((c) =>
      c.url.includes("/rpc/log_office_registration"),
    );
    expect(audit?.body).toEqual({
      p_member_id: "new-member-1",
      p_actor_id: "staff-1",
    });
  });
  it("emails the set-password link to the reset page", async () => {
    const { doFetch, calls } = fakeSupabase();
    await handleRequest(post(goodBody), env, doFetch);
    const mail = calls.find((c) => c.url.includes("/auth/v1/recover"));
    expect(mail?.url).toContain(
      encodeURIComponent("https://isave.example/reset-password"),
    );
    expect(mail?.body).toEqual({ email: "rudo@example.com" });
  });
  it("keeps the account and says so when the email does not send", async () => {
    const { doFetch } = fakeSupabase({ mailOk: false });
    const res = await handleRequest(post(goodBody), env, doFetch);
    expect(res.status).toBe(201);
    expect((await jsonOf(res)).result.emailSent).toBe(false);
  });
  it("keeps the account and says so when the audit row does not save", async () => {
    const { doFetch } = fakeSupabase({ auditOk: false });
    const res = await handleRequest(post(goodBody), env, doFetch);
    expect(res.status).toBe(201);
    expect((await jsonOf(res)).result.auditLogged).toBe(false);
  });
  it("never leaks the service key in a response", async () => {
    const { doFetch } = fakeSupabase();
    const res = await handleRequest(post(goodBody), env, doFetch);
    expect(await res.text()).not.toContain("SECRET-SERVICE-KEY");
  });
  it("sends the caller's own token only to the user check, never to data calls", async () => {
    const { doFetch, calls } = fakeSupabase();
    await handleRequest(post(goodBody), env, doFetch);
    const withToken = calls.filter(
      (c) => c.headers.Authorization === "Bearer good-token",
    );
    expect(withToken).toHaveLength(1);
    expect(withToken[0]!.url.endsWith("/auth/v1/user")).toBe(true);
  });
});

describe("browser access", () => {
  it("allows the configured web app origins", async () => {
    const { doFetch } = fakeSupabase();
    const res = await handleRequest(
      post(goodBody, { Origin: "https://isave.example" }),
      env,
      doFetch,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://isave.example",
    );
  });
  it("does not send access headers to other sites", async () => {
    const { doFetch } = fakeSupabase();
    const res = await handleRequest(
      post(goodBody, { Origin: "https://evil.example" }),
      env,
      doFetch,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
  it("answers the browser's preflight", async () => {
    const { doFetch } = fakeSupabase();
    const req = new Request("https://api.test/staff/register-member", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173" },
    });
    const res = await handleRequest(req, env, doFetch);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "Authorization",
    );
  });
  it("returns 404 for anything else", async () => {
    const { doFetch } = fakeSupabase();
    const res = await handleRequest(
      new Request("https://api.test/nope"),
      env,
      doFetch,
    );
    expect(res.status).toBe(404);
  });
});
