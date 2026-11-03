import { supabase } from "@/lib/supabase";

// Empty means "same address as the website" (one Worker serves both). For local development,
// set VITE_API_URL=http://localhost:8787.
const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type AssistantAudience = "home" | "member" | "staff";
export type ChatMessage = { role: "user" | "assistant"; content: string };

export class AssistantError extends Error {}

/** Asks the assistant. Members and staff send their sign-in token so the Worker can check access. */
export async function askAssistant(
  audience: AssistantAudience,
  messages: ChatMessage[],
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (audience !== "home") {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new AssistantError("Please sign in again.");
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/assistant`, {
      method: "POST",
      headers,
      body: JSON.stringify({ audience, messages: messages.slice(-10) }),
    });
  } catch {
    throw new AssistantError(
      "Could not reach the assistant. Check your connection and try again.",
    );
  }
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    reply?: string;
    error?: string;
  } | null;
  if (!res.ok || !body?.ok || !body.reply) {
    throw new AssistantError(
      body?.error ?? "The assistant could not answer. Please try again.",
    );
  }
  return body.reply;
}
