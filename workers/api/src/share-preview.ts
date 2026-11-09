import type { Env } from "./env";

// When someone pastes a link to an event or announcement into WhatsApp, Facebook or similar,
// those apps read the page's <meta> tags to build the preview card. The website is a
// single-page app whose tags are the same for every address, so for these two kinds of page
// the Worker looks the item up and puts its own title, text and picture into the tags before
// sending the page. People see the normal page; the tags just make the card useful.

type FetchFn = typeof fetch;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEDIA_BUCKET = "site-media";
const LOOKUP_TIMEOUT_MS = 2500;

type MediaRow = {
  path: string;
  media_type?: string;
  sort_order?: number;
  id?: string;
};

type Preview = {
  title: string;
  description: string;
  imagePath: string | null;
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain, one-line text from staff-written text: no headings, link markup or line breaks. */
export function plainSnippet(text: string, max = 200): string {
  const flat = text
    .replace(/\{\{contact\}\}/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Friday 20 November 2026". Written out by hand so every runtime gives the same text. */
function longDate(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The picture to show: the one a shared link points at, else the first picture. */
function pickImage(files: MediaRow[], wanted: string | null): string | null {
  const pictures = files
    .filter((f) => (f.media_type ?? "image") === "image")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const chosen = wanted ? pictures.find((f) => f.id === wanted) : undefined;
  return (chosen ?? pictures[0])?.path ?? null;
}

async function rows(
  path: string,
  env: Env,
  doFetch: FetchFn,
): Promise<Array<Record<string, unknown>> | null> {
  try {
    const res = await doFetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    return Array.isArray(body)
      ? (body as Array<Record<string, unknown>>)
      : null;
  } catch {
    return null;
  }
}

async function eventPreview(
  id: string,
  wanted: string | null,
  env: Env,
  doFetch: FetchFn,
): Promise<Preview | null> {
  const found = await rows(
    `events?select=title,event_date,location,summary,event_images(id,path,media_type,sort_order)&id=eq.${id}&published=eq.true&limit=1`,
    env,
    doFetch,
  );
  const row = found?.[0];
  if (!row) return null;
  const when = [
    typeof row.event_date === "string" ? longDate(row.event_date) : "",
    typeof row.location === "string" ? row.location : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const summary =
    typeof row.summary === "string" ? plainSnippet(row.summary) : "";
  return {
    title: String(row.title),
    description: [when, summary].filter(Boolean).join(" – "),
    imagePath: pickImage((row.event_images as MediaRow[]) ?? [], wanted),
  };
}

async function announcementPreview(
  id: string,
  wanted: string | null,
  env: Env,
  doFetch: FetchFn,
): Promise<Preview | null> {
  // Attachments live in a table added by a later database change; ask without it if it is missing.
  const found =
    (await rows(
      `announcements?select=title,body,announcement_files(id,path,media_type,sort_order)&id=eq.${id}&published=eq.true&limit=1`,
      env,
      doFetch,
    )) ??
    (await rows(
      `announcements?select=title,body&id=eq.${id}&published=eq.true&limit=1`,
      env,
      doFetch,
    ));
  const row = found?.[0];
  if (!row) return null;
  return {
    title: String(row.title),
    description: plainSnippet(String(row.body ?? "")),
    imagePath: pickImage((row.announcement_files as MediaRow[]) ?? [], wanted),
  };
}

/** The page's tags, ready to put before </head>. */
export function previewTags(
  preview: Preview,
  pageUrl: string,
  env: Env,
  siteOrigin: string,
): { title: string; tags: string } {
  const title = `${preview.title} – i-Save`;
  const description =
    preview.description || "News and events from i-Save, the savings club.";
  const image = preview.imagePath
    ? `${env.SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${preview.imagePath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`
    : `${siteOrigin}/icons/icon-512.png`;
  const tags = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:site_name" content="i-Save" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:card" content="${preview.imagePath ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ].join("\n    ");
  return { title, tags };
}

/**
 * Handles GET /events/<id> and GET /announcements/<id>. Returns the website page with that
 * item's preview tags, or null when this is not such a page (or the Worker has no website to
 * serve), in which case the caller falls back to the plain website.
 */
export async function sharePreviewResponse(
  request: Request,
  env: Env,
  doFetch: FetchFn = fetch,
): Promise<Response | null> {
  if (request.method !== "GET" || !env.ASSETS) return null;
  const url = new URL(request.url);
  const match = /^\/(events|announcements)\/([^/]+)\/?$/.exec(url.pathname);
  if (!match || !ID.test(match[2])) return null;
  const [, kind, id] = match;
  const wanted = url.searchParams.get("m");

  const preview =
    kind === "events"
      ? await eventPreview(id, wanted, env, doFetch)
      : await announcementPreview(id, wanted, env, doFetch);
  if (!preview) return null;

  // The website's own page (index.html), to which the tags are added.
  const shell = await env.ASSETS.fetch(
    new Request(new URL("/", url), { method: "GET" }),
  );
  if (!shell.ok) return null;
  const html = await shell.text();
  const { title, tags } = previewTags(
    preview,
    `${url.origin}/${kind}/${id}`,
    env,
    url.origin,
  );
  const withTitle = /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(
        /<title>[\s\S]*?<\/title>/i,
        () => `<title>${escapeHtml(title)}</title>`,
      )
    : html;
  const out = withTitle.replace(/<\/head>/i, () => `    ${tags}\n  </head>`);

  return new Response(out, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Short cache: an edited title or a new picture shows up in new previews within minutes.
      "Cache-Control": "public, max-age=300",
    },
  });
}
