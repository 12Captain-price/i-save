// Pure helpers for registration agents. No database or browser code here, so they are easy to test.

export type AgentUrlResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

/**
 * Cleans up a registration link typed by an admin. A bare address like "forms.example.co.zw/join"
 * gets https:// added. Plain http:// is refused, because members enter personal details there.
 */
export function normalizeAgentUrl(input: string): AgentUrlResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, message: "Enter the registration link." };
  if (/\s/.test(trimmed)) {
    return { ok: false, message: "The link cannot contain spaces." };
  }
  if (/^http:\/\//i.test(trimmed)) {
    return { ok: false, message: "The link must start with https:// (http:// is not secure)." };
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, message: "That does not look like a valid link." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, message: "The link must start with https://." };
  }
  if (url.username || url.password) {
    return { ok: false, message: "The link cannot contain a user name or password." };
  }
  if (!url.hostname.includes(".")) {
    return { ok: false, message: "That does not look like a valid link." };
  }
  if (url.href.length > 2000) {
    return { ok: false, message: "That link is too long." };
  }
  return { ok: true, value: url.href };
}

/** True for the example.com style links used as stand-ins until the real links are added. */
export function isPlaceholderUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(^|\.)example\.(com|org|net)$/.test(host);
  } catch {
    return false;
  }
}

/** Public list order: smaller sort_order first, then by name. */
export function sortAgents<T extends { sort_order: number; name: string }>(
  agents: T[],
): T[] {
  return [...agents].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  );
}
