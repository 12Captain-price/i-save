import type { Env } from "./env";
import {
  ADMIN_KNOWLEDGE,
  MEMBER_KNOWLEDGE,
  OFFICE_FACTS,
  PUBLIC_KNOWLEDGE,
  RULES,
  STAFF_KNOWLEDGE,
} from "./assistant-knowledge";

type FetchFn = typeof fetch;

/** The few things the assistant needs from the main handler, so this file stays separate. */
export type AssistantDeps = {
  fetch: FetchFn;
  respond: (status: number, body: unknown) => Response;
  getCaller: (token: string) => Promise<string | null>;
  rows: (path: string) => Promise<unknown[] | null>;
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type Body = {
  audience: "home" | "member" | "staff";
  messages: ChatMessage[];
};

/** Checks the request by hand (this package has no schema library). Returns null if invalid. */
function parseBody(raw: unknown): Body | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { audience?: unknown; messages?: unknown };
  if (
    o.audience !== "home" &&
    o.audience !== "member" &&
    o.audience !== "staff"
  )
    return null;
  if (!Array.isArray(o.messages)) return null;
  if (o.messages.length < 1 || o.messages.length > 30) return null;
  const messages: ChatMessage[] = [];
  for (const m of o.messages) {
    const r = m as { role?: unknown; content?: unknown };
    if (r.role !== "user" && r.role !== "assistant") return null;
    if (typeof r.content !== "string") return null;
    const content = r.content.trim();
    if (content.length < 1 || content.length > 1000) return null;
    messages.push({ role: r.role, content });
  }
  return { audience: o.audience, messages };
}

// Free by default: Cloudflare Workers AI (10,000 free neurons a day, no card). If an
// Anthropic key is set instead, Claude answers. Models are retired from time to time, so the
// name can be changed with the ASSISTANT_MODEL variable without touching the code.
const DEFAULT_WORKERS_AI_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const DEFAULT_CLAUDE_MODEL = "claude-haiku-5-5";
const MAX_TURNS = 6;
const MAX_OUTPUT_TOKENS = 500;
const STAFF_ROLES = new Set(["finance", "admin", "super_admin"]);

function failBody(error: string) {
  return { ok: false, error };
}

/** Live public facts: approved public settings (fees, withdrawal rules) and published FAQs. */
async function livePublicFacts(d: AssistantDeps): Promise<string> {
  const [settings, faqs] = await Promise.all([
    d.rows(
      "system_settings?select=key,value&is_public=eq.true&approved=eq.true&limit=40",
    ),
    d.rows(
      "faqs?select=question,answer&published=eq.true&order=sort_order&limit=40",
    ),
  ]);
  const parts: string[] = [];
  if (settings && settings.length > 0) {
    parts.push(
      "LIVE APPROVED SETTINGS (these are the only confirmed figures; anything not listed is not confirmed):\n" +
        settings
          .map((s) => {
            const r = s as { key?: string; value?: unknown };
            return `- ${r.key}: ${JSON.stringify(r.value)}`;
          })
          .join("\n"),
    );
  } else {
    parts.push(
      "LIVE APPROVED SETTINGS: none are published yet. Fees and rules are still to be confirmed, so say so and refer to the office.",
    );
  }
  if (faqs && faqs.length > 0) {
    parts.push(
      "PUBLISHED FAQS:\n" +
        faqs
          .map((f) => {
            const r = f as { question?: string; answer?: string };
            return `Q: ${r.question}\nA: ${r.answer}`;
          })
          .join("\n\n")
          .slice(0, 5000),
    );
  }
  return parts.join("\n\n");
}

/** Free path: Cloudflare Workers AI through the AI binding. Returns null on any failure. */
async function replyWithWorkersAi(
  env: Env,
  system: string,
  messages: ChatMessage[],
): Promise<string | null> {
  try {
    const out = (await env.AI!.run(
      env.ASSISTANT_MODEL || DEFAULT_WORKERS_AI_MODEL,
      {
        messages: [{ role: "system", content: system }, ...messages],
        max_tokens: MAX_OUTPUT_TOKENS,
      },
    )) as unknown;
    // Older models answer { response }, newer ones answer in the OpenAI style.
    const o = out as {
      response?: unknown;
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const text =
      typeof o?.response === "string"
        ? o.response
        : o?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch (error) {
    console.error(
      "assistant workers-ai failed",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

/** Optional paid path, used only when ANTHROPIC_API_KEY is set and no AI binding exists. */
async function replyWithClaude(
  env: Env,
  d: AssistantDeps,
  system: string,
  messages: ChatMessage[],
): Promise<string | null> {
  const res = await d.fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ASSISTANT_MODEL || DEFAULT_CLAUDE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    console.error("assistant upstream failed", res.status);
    return null;
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || null;
}

export async function assistantChat(
  request: Request,
  env: Env,
  d: AssistantDeps,
): Promise<Response> {
  if (!env.AI && !env.ANTHROPIC_API_KEY) {
    return d.respond(
      503,
      failBody("The assistant is not switched on yet. Please ask the office."),
    );
  }

  // Browsers always send Origin on a POST. Refuse anything not coming from our own site.
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN.split(",").map((o) => o.trim());
  if (!origin || !allowed.includes(origin)) {
    return d.respond(403, failBody("Not allowed."));
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return d.respond(400, failBody("That request could not be read."));
  }
  const parsed = parseBody(raw);
  if (!parsed) {
    return d.respond(400, failBody("That message is too long or empty."));
  }
  const { audience } = parsed;
  const messages = parsed.messages.slice(-MAX_TURNS);
  if (messages[messages.length - 1]?.role !== "user") {
    return d.respond(400, failBody("That request could not be read."));
  }
  // The model must see a conversation that starts with the user.
  while (messages.length > 0 && messages[0]?.role !== "user") messages.shift();

  // Who is asking, and are they allowed this audience? The database stays the real gate;
  // this only decides which guide the assistant reads from.
  let knowledge = PUBLIC_KNOWLEDGE;
  let context = "";

  if (audience !== "home") {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const userId = token ? await d.getCaller(token) : null;
    if (!userId) {
      return d.respond(401, failBody("Please sign in again."));
    }
    const enc = encodeURIComponent(userId);

    if (audience === "staff") {
      const roles = await d.rows(`user_roles?select=role&user_id=eq.${enc}`);
      const isStaff = (roles ?? []).some((r) =>
        STAFF_ROLES.has((r as { role?: string }).role ?? ""),
      );
      if (!isStaff) {
        return d.respond(
          403,
          failBody("The staff assistant is for office staff only."),
        );
      }
      knowledge = `${STAFF_KNOWLEDGE}\n\n${ADMIN_KNOWLEDGE}`;
    } else {
      knowledge = MEMBER_KNOWLEDGE;
      const prof = await d.rows(
        `profiles?select=full_name,member_number,status&id=eq.${enc}&limit=1`,
      );
      const p = prof?.[0] as
        | { full_name?: string; member_number?: string; status?: string }
        | undefined;
      if (p) {
        const first = (p.full_name ?? "").trim().split(/\s+/)[0] ?? "";
        context = `ABOUT THE PERSON ASKING: first name ${first || "unknown"}, account status "${p.status ?? "unknown"}". You cannot see their balance or payments.`;
      }
    }
  }

  if (audience === "home" || audience === "member") {
    context = [context, await livePublicFacts(d)].filter(Boolean).join("\n\n");
  }

  const system = [RULES, OFFICE_FACTS, knowledge, context]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const reply = env.AI
    ? await replyWithWorkersAi(env, system, messages)
    : await replyWithClaude(env, d, system, messages);
  if (!reply) {
    return d.respond(
      502,
      failBody("The assistant is busy right now. Please try again shortly."),
    );
  }
  return d.respond(200, { ok: true, reply });
}
