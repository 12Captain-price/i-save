import { createClient } from "@supabase/supabase-js";

// The browser only ever gets the public (anon) key. Row-level security in the
// database decides what each person can see. The service_role key must never
// appear anywhere in this app.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Create apps/web/.env.local with both values (see .env.example), then restart pnpm dev.",
  );
}

export const supabase = createClient(url, anonKey);