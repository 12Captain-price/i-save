import type { Env } from "./env";
import { registerApplicantSchema } from "@/lib/register-schema";
import type { RegisterApplicantResult } from "@/lib/register-schema";
import { createStaffSchema } from "@/lib/staff-account-schema";
import type { CreateStaffResult } from "@/lib/staff-account-schema";

type FetchFn = typeof fetch;

const STAFF_ROLES = "finance,admin,super_admin";

/* ------------------------------------------------------------------ */
/* Responses and CORS                                                  */
/* ------------------------------------------------------------------ */

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN.split(",").map((o) => o.trim());
  if (!origin || !allowed.includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function json(
  request: Request,
  env: Env,
  status: number,
  body: unknown,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
    },
  });
}

function fail(
  request: Request,
  env: Env,
  status: number,
  error: string,
  fieldErrors?: Record<string, string>,
): Response {
  return json(request, env, status, { ok: false, error, fieldErrors });
}

/* ------------------------------------------------------------------ */
/* Talking to Supabase (service role, server side only)                */
/* ------------------------------------------------------------------ */

function serviceHeaders(env: Env): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Who is calling? Supabase checks the token's signature and expiry for us. */
async function getCaller(
  token: string,
  env: Env,
  doFetch: FetchFn,
): Promise<string | null> {
  const res = await doFetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return typeof user.id === "string" ? user.id : null;
}

async function restRows(
  path: string,
  env: Env,
  doFetch: FetchFn,
): Promise<unknown[] | null> {
  const res = await doFetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: serviceHeaders(env),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as unknown;
  return Array.isArray(rows) ? rows : null;
}

/* ------------------------------------------------------------------ */
/* POST /staff/register-member                                         */
/* ------------------------------------------------------------------ */

async function registerMember(
  request: Request,
  env: Env,
  doFetch: FetchFn,
): Promise<Response> {
  // 1. Who is asking, and are they office staff?
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return fail(request, env, 401, "Please sign in again.");

  const callerId = await getCaller(token, env, doFetch);
  if (!callerId) return fail(request, env, 401, "Please sign in again.");

  const roles = await restRows(
    `user_roles?select=role&user_id=eq.${encodeURIComponent(callerId)}&role=in.(${STAFF_ROLES})&limit=1`,
    env,
    doFetch,
  );
  if (roles === null) {
    return fail(
      request,
      env,
      502,
      "Could not check your access. Please try again.",
    );
  }
  if (roles.length === 0) {
    return fail(
      request,
      env,
      403,
      "Only office staff can register an applicant.",
    );
  }

  // 2. Same rules as the screen.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(request, env, 400, "That request could not be read.");
  }
  const parsed = registerApplicantSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return fail(
      request,
      env,
      400,
      "Please correct the highlighted details.",
      fieldErrors,
    );
  }
  const a = parsed.data;

  // 3. One person, one account. The database enforces this too; checking first lets us say
  //    exactly which detail clashes, without ever repeating the ID number back.
  const [phoneHit, idHit, emailHit] = await Promise.all([
    restRows(
      `profiles?select=id&phone=eq.${encodeURIComponent(a.phone)}&limit=1`,
      env,
      doFetch,
    ),
    restRows(
      `member_identity?select=member_id&national_id=eq.${encodeURIComponent(a.nationalId)}&limit=1`,
      env,
      doFetch,
    ),
    restRows(
      `profiles?select=id&email=eq.${encodeURIComponent(a.email)}&limit=1`,
      env,
      doFetch,
    ),
  ]);
  if (phoneHit === null || idHit === null || emailHit === null) {
    return fail(
      request,
      env,
      502,
      "Could not check for an existing member. Please try again.",
    );
  }
  const clashes: Record<string, string> = {};
  if (phoneHit.length > 0)
    clashes.phone = "A member with this phone number already exists.";
  if (idHit.length > 0)
    clashes.nationalId = "A member with this ID number already exists.";
  if (emailHit.length > 0)
    clashes.email = "A member with this email address already exists.";
  if (Object.keys(clashes).length > 0) {
    return fail(
      request,
      env,
      409,
      "This person may already be a member. Search for them in the member list.",
      clashes,
    );
  }

  // 4. Create the account. No password: the member sets their own from the emailed link.
  //    registered_via can only be set here, with the service role, so the browser cannot fake it.
  const createRes = await doFetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(env),
    body: JSON.stringify({
      email: a.email,
      email_confirm: true,
      user_metadata: {
        full_name: a.fullName,
        phone: a.phone,
        national_id: a.nationalId,
        category_interest: a.categoryInterest,
        age_confirmed: "true",
        terms_accepted: "true",
      },
      app_metadata: { registered_via: "staff" },
    }),
  });
  if (!createRes.ok) {
    const body = (await createRes.json().catch(() => ({}))) as {
      error_code?: string;
    };
    if (body.error_code === "email_exists") {
      return fail(request, env, 409, "This person may already be a member.", {
        email: "A member with this email address already exists.",
      });
    }
    // Do not pass the provider's message on: it can include details we should not show.
    console.error("create user failed", createRes.status, body.error_code);
    return fail(
      request,
      env,
      502,
      "The account could not be created. Nothing was saved.",
    );
  }
  const created = (await createRes.json()) as { id: string };

  // 5. Audit row with the real staff member as the actor.
  const auditRes = await doFetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/log_office_registration`,
    {
      method: "POST",
      headers: serviceHeaders(env),
      body: JSON.stringify({ p_member_id: created.id, p_actor_id: callerId }),
    },
  );
  if (!auditRes.ok) console.error("audit write failed", auditRes.status);

  // 6. Email the set-password link. A failure here does not undo the account.
  const redirectTo = `${env.APP_URL.replace(/\/$/, "")}/reset-password`;
  const mailRes = await doFetch(
    `${env.SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: "POST",
      headers: serviceHeaders(env),
      body: JSON.stringify({ email: a.email }),
    },
  );
  if (!mailRes.ok) console.error("set-password email failed", mailRes.status);

  const numberRows = await restRows(
    `profiles?select=member_number&id=eq.${encodeURIComponent(created.id)}&limit=1`,
    env,
    doFetch,
  );
  const memberNumber =
    (numberRows?.[0] as { member_number?: string } | undefined)
      ?.member_number ?? null;

  const result: RegisterApplicantResult = {
    memberId: created.id,
    memberNumber,
    emailSent: mailRes.ok,
    auditLogged: auditRes.ok,
  };
  return json(request, env, 201, { ok: true, result });
}

/* ------------------------------------------------------------------ */
/* POST /staff/create-staff                                            */
/* ------------------------------------------------------------------ */

async function createStaff(
  request: Request,
  env: Env,
  doFetch: FetchFn,
): Promise<Response> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return fail(request, env, 401, "Please sign in again.");
  const callerId = await getCaller(token, env, doFetch);
  if (!callerId) return fail(request, env, 401, "Please sign in again.");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(request, env, 400, "That request could not be read.");
  }
  const parsed = createStaffSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return fail(
      request,
      env,
      400,
      "Please correct the highlighted details.",
      fieldErrors,
    );
  }
  const a = parsed.data;

  // The database decides who may create which kind of account (admins: staff or admin;
  // staff in admin mode: staff only). Ask it before creating anything.
  const allowedRes = await doFetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/staff_grant_allowed`,
    {
      method: "POST",
      headers: serviceHeaders(env),
      body: JSON.stringify({ p_actor: callerId, p_role: a.role }),
    },
  );
  if (!allowedRes.ok) {
    return fail(
      request,
      env,
      502,
      "Could not check your access. Please try again.",
    );
  }
  if ((await allowedRes.json()) !== true) {
    return fail(
      request,
      env,
      403,
      a.role === "admin"
        ? "Only administrators can create another administrator."
        : "Switch to admin mode (or ask an administrator) to create staff accounts.",
    );
  }

  const [phoneHit, emailHit] = await Promise.all([
    restRows(
      `profiles?select=id&phone=eq.${encodeURIComponent(a.phone)}&limit=1`,
      env,
      doFetch,
    ),
    restRows(
      `profiles?select=id&email=eq.${encodeURIComponent(a.email)}&limit=1`,
      env,
      doFetch,
    ),
  ]);
  if (phoneHit === null || emailHit === null) {
    return fail(
      request,
      env,
      502,
      "Could not check for an existing account. Please try again.",
    );
  }
  const clashes: Record<string, string> = {};
  if (phoneHit.length > 0)
    clashes.phone = "This phone number is already in use.";
  if (emailHit.length > 0)
    clashes.email = "This email address is already in use.";
  if (Object.keys(clashes).length > 0) {
    return fail(
      request,
      env,
      409,
      "An account with these details already exists.",
      clashes,
    );
  }

  const createRes = await doFetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(env),
    body: JSON.stringify({
      email: a.email,
      email_confirm: true,
      user_metadata: {
        full_name: a.fullName,
        phone: a.phone,
        age_confirmed: "true",
        terms_accepted: "true",
      },
    }),
  });
  if (!createRes.ok) {
    const body = (await createRes.json().catch(() => ({}))) as {
      error_code?: string;
    };
    if (body.error_code === "email_exists") {
      return fail(
        request,
        env,
        409,
        "An account with these details already exists.",
        {
          email: "This email address is already in use.",
        },
      );
    }
    console.error("create staff failed", createRes.status, body.error_code);
    return fail(
      request,
      env,
      502,
      "The account could not be created. Nothing was saved.",
    );
  }
  const created = (await createRes.json()) as { id: string };

  // Grant the role (the database re-checks the actor and writes the audit row). If that
  // fails, remove the new sign-in account so no half-made account is left behind.
  const grantRes = await doFetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/grant_staff_role`,
    {
      method: "POST",
      headers: serviceHeaders(env),
      body: JSON.stringify({
        p_user: created.id,
        p_actor: callerId,
        p_role: a.role,
      }),
    },
  );
  if (!grantRes.ok) {
    console.error("grant staff role failed", grantRes.status);
    await doFetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${created.id}`, {
      method: "DELETE",
      headers: serviceHeaders(env),
    });
    return fail(
      request,
      env,
      502,
      "The account could not be created. Nothing was saved.",
    );
  }

  const redirectTo = `${env.APP_URL.replace(/\/$/, "")}/reset-password`;
  const mailRes = await doFetch(
    `${env.SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: "POST",
      headers: serviceHeaders(env),
      body: JSON.stringify({ email: a.email }),
    },
  );
  if (!mailRes.ok)
    console.error("staff set-password email failed", mailRes.status);

  const result: CreateStaffResult = {
    userId: created.id,
    emailSent: mailRes.ok,
  };
  return json(request, env, 201, { ok: true, result });
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export async function handleRequest(
  request: Request,
  env: Env,
  doFetch: FetchFn = fetch,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, env),
    });
  }
  if (url.pathname === "/health" && request.method === "GET") {
    return json(request, env, 200, { ok: true });
  }
  if (url.pathname === "/staff/register-member" && request.method === "POST") {
    try {
      return await registerMember(request, env, doFetch);
    } catch (error) {
      console.error(
        "register-member crashed",
        error instanceof Error ? error.message : "unknown",
      );
      return fail(request, env, 500, "Something went wrong. Please try again.");
    }
  }
  if (url.pathname === "/staff/create-staff" && request.method === "POST") {
    try {
      return await createStaff(request, env, doFetch);
    } catch (error) {
      console.error(
        "create-staff crashed",
        error instanceof Error ? error.message : "unknown",
      );
      return fail(request, env, 500, "Something went wrong. Please try again.");
    }
  }
  return fail(request, env, 404, "Not found.");
}
