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
}
