import type { Env } from "./env";

type FetchFn = typeof fetch;

/** After this many failed tries a notification is marked "failed" and left alone. */
export const MAX_ATTEMPTS = 5;
/** How many queued emails one run sends. Keeps a run well inside Worker limits. */
const BATCH_SIZE = 25;

interface QueuedEmail {
  id: string;
  subject: string | null;
  body: string;
  attempts: number;
  profiles: {
    email: string | null;
    full_name: string | null;
    email_opt_in: boolean;
  } | null;
}

export interface SendSummary {
  sent: number;
  failed: number;
  skipped: number;
}

function serviceHeaders(env: Env): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain, safe HTML: the text is escaped and line breaks are kept. */
export function renderEmailHtml(
  name: string | null,
  body: string,
  appUrl: string,
): string {
  const greeting = name ? `Hello ${escapeHtml(name)},` : "Hello,";
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const link = escapeHtml(appUrl.replace(/\/$/, ""));
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:560px">
<p style="margin:0 0 14px">${greeting}</p>${paragraphs}
<p style="margin:18px 0 0;color:#666;font-size:13px">iSave member portal: <a href="${link}">${link}</a></p>
</div>`;
}

async function markRow(
  env: Env,
  doFetch: FetchFn,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await doFetch(
    `${env.SUPABASE_URL}/rest/v1/notifications?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(env), Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) console.error("could not update notification", id, res.status);
}

/**
 * Sends queued email notifications through Resend.
 * Does nothing (and says so) until RESEND_API_KEY and EMAIL_FROM are set, so the cron trigger
 * is safe to deploy before the Resend account exists.
 */
export async function sendQueuedEmails(
  env: Env,
  doFetch: FetchFn = fetch,
): Promise<SendSummary> {
  const summary: SendSummary = { sent: 0, failed: 0, skipped: 0 };
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.log("email sending is not configured yet; nothing sent");
    return summary;
  }

  const listRes = await doFetch(
    `${env.SUPABASE_URL}/rest/v1/notifications` +
      `?select=id,subject,body,attempts,profiles(email,full_name,email_opt_in)` +
      `&channel=eq.email&status=eq.queued&attempts=lt.${MAX_ATTEMPTS}` +
      `&order=created_at.asc&limit=${BATCH_SIZE}`,
    { headers: serviceHeaders(env) },
  );
  if (!listRes.ok) {
    console.error("could not read the notification queue", listRes.status);
    return summary;
  }
  const rows = (await listRes.json()) as QueuedEmail[];

  for (const row of rows) {
    const to = row.profiles?.email;
    // Opted out since it was queued, or no address: stop retrying, do not send.
    if (!to || row.profiles?.email_opt_in === false) {
      await markRow(env, doFetch, row.id, {
        status: "failed",
        error: "No email address or member opted out",
        attempts: row.attempts + 1,
      });
      summary.skipped += 1;
      continue;
    }

    try {
      const res = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          // Same row = same key, so a retry after a timeout cannot double-send.
          "Idempotency-Key": `isave-notification-${row.id}`,
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [to],
          subject: row.subject ?? "iSave notification",
          text: row.body,
          html: renderEmailHtml(
            row.profiles?.full_name ?? null,
            row.body,
            env.APP_URL,
          ),
        }),
      });
      if (!res.ok) throw new Error(`Resend answered ${res.status}`);
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      await markRow(env, doFetch, row.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: data.id ?? null,
        attempts: row.attempts + 1,
        error: null,
      });
      summary.sent += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      await markRow(env, doFetch, row.id, {
        status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
        attempts,
        error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
      summary.failed += 1;
    }
  }
  return summary;
}
