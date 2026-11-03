export interface Env {
  SUPABASE_URL: string;
  /** Secret. Only ever read inside the Worker; never returned or logged. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Comma-separated list of web app origins allowed to call this Worker. */
  ALLOWED_ORIGIN: string;
  /** Base URL of the web app, used for the set-password link. */
  APP_URL: string;
  /** Secret. Resend API key. Email sending stays off until this and EMAIL_FROM are set. */
  RESEND_API_KEY?: string;
  /** Sender shown to members, e.g. "iSave <notifications@yourdomain.com>". */
  EMAIL_FROM?: string;
  /** Cloudflare Workers AI binding (free tier). Powers the in-site assistant. Set in wrangler.toml. */
  AI?: { run(model: string, input: unknown): Promise<unknown> };
  /** Optional secret. Only used if there is no AI binding: answers come from Claude instead. */
  ANTHROPIC_API_KEY?: string;
  /** Optional model override for whichever service answers. */
  ASSISTANT_MODEL?: string;
}
