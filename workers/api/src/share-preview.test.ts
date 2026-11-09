import { describe, expect, it } from "vitest";
import { handleRequest } from "./handler";
import { escapeHtml, plainSnippet } from "./share-preview";
import type { Env } from "./env";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const NOTICE_ID = "22222222-2222-4222-8222-222222222222";

const SHELL = `<!doctype html><html><head><title>i-Save</title></head><body><div id="root"></div></body></html>`;

function makeEnv(): { env: Env; assetCalls: string[] } {
  const assetCalls: string[] = [];
  const env: Env = {
    SUPABASE_URL: "https://proj.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "SECRET-SERVICE-KEY",
    ALLOWED_ORIGIN: "https://isave.example",
    APP_URL: "https://isave.example",
    ASSETS: {
      fetch: async (req: Request) => {
        assetCalls.push(new URL(req.url).pathname);
        return new Response(SHELL, {
          headers: { "Content-Type": "text/html" },
        });
      },
    },
  };
  return { env, assetCalls };
}

function supabase(answers: Record<string, unknown[] | null>) {
  const urls: string[] = [];
  const doFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const key = Object.keys(answers).find((k) => url.includes(k));
    const answer = key ? answers[key] : null;
    if (answer === null) return new Response("{}", { status: 400 });
    return new Response(JSON.stringify(answer), { status: 200 });
  }) as typeof fetch;
  return { doFetch, urls };
}

const get = (path: string) => new Request(`https://isave.example${path}`);

describe("share previews", () => {
  it("puts the event's title, date, place and cover picture into the page", async () => {
    const { env } = makeEnv();
    const { doFetch, urls } = supabase({
      "rest/v1/events": [
        {
          title: "AGM & Open Day",
          event_date: "2026-11-20",
          location: "Bulawayo",
          summary: "Meet the team.",
          event_images: [
            {
              id: "v1",
              path: "events/e/video.mp4",
              media_type: "video",
              sort_order: 10,
            },
            {
              id: "p2",
              path: "events/e/second.jpg",
              media_type: "image",
              sort_order: 30,
            },
            {
              id: "p1",
              path: "events/e/first.jpg",
              media_type: "image",
              sort_order: 20,
            },
          ],
        },
      ],
    });
    const res = await handleRequest(get(`/events/${EVENT_ID}`), env, doFetch);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>AGM &amp; Open Day – i-Save</title>");
    expect(html).toContain(
      'property="og:title" content="AGM &amp; Open Day – i-Save"',
    );
    expect(html).toContain(
      "Friday 20 November 2026 · Bulawayo – Meet the team.",
    );
    expect(html).toContain(
      'content="https://proj.supabase.co/storage/v1/object/public/site-media/events/e/first.jpg"',
    );
    expect(html).toContain("summary_large_image");
    expect(html).toContain('<div id="root">');
    expect(urls[0]).toContain("published=eq.true");
  });

  it("shows the picture a link points at", async () => {
    const { env } = makeEnv();
    const { doFetch } = supabase({
      "rest/v1/events": [
        {
          title: "Day",
          event_date: "2026-11-20",
          event_images: [
            { id: "p1", path: "a.jpg", media_type: "image", sort_order: 10 },
            { id: "p2", path: "b.jpg", media_type: "image", sort_order: 20 },
          ],
        },
      ],
    });
    const res = await handleRequest(
      get(`/events/${EVENT_ID}?m=p2`),
      env,
      doFetch,
    );
    expect(await res.text()).toContain("site-media/b.jpg");
  });

  it("uses the i-Save icon when there is no picture (PDF or video only)", async () => {
    const { env } = makeEnv();
    const { doFetch } = supabase({
      "rest/v1/announcements": [
        {
          title: "Notice",
          body: "## Heading\n\nOffice closed [see why](/faqs).",
          announcement_files: [
            { id: "f", path: "n.pdf", media_type: "pdf", sort_order: 10 },
          ],
        },
      ],
    });
    const res = await handleRequest(
      get(`/announcements/${NOTICE_ID}`),
      env,
      doFetch,
    );
    const html = await res.text();
    expect(html).toContain("https://isave.example/icons/icon-512.png");
    expect(html).toContain('content="summary"');
    expect(html).toContain("Heading Office closed see why.");
  });

  it("still works before the attachments table exists", async () => {
    const { env } = makeEnv();
    const { doFetch } = supabase({
      announcement_files: null,
      "select=title,body&": [{ title: "Old style", body: "Text only." }],
    });
    const res = await handleRequest(
      get(`/announcements/${NOTICE_ID}`),
      env,
      doFetch,
    );
    expect(await res.text()).toContain("Old style – i-Save");
  });

  it("falls back to the plain website for an unknown or unpublished item", async () => {
    const { env, assetCalls } = makeEnv();
    const { doFetch } = supabase({ "rest/v1/events": [] });
    const res = await handleRequest(get(`/events/${EVENT_ID}`), env, doFetch);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SHELL);
    expect(assetCalls).toContain(`/events/${EVENT_ID}`);
  });

  it("falls back to the plain website when the database cannot be reached", async () => {
    const { env } = makeEnv();
    const doFetch = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    const res = await handleRequest(get(`/events/${EVENT_ID}`), env, doFetch);
    expect(await res.text()).toBe(SHELL);
  });

  it("does not look anything up for an address that is not an id", async () => {
    const { env } = makeEnv();
    const { doFetch, urls } = supabase({});
    const res = await handleRequest(get("/events/not-an-id"), env, doFetch);
    expect(await res.text()).toBe(SHELL);
    expect(urls).toHaveLength(0);
  });

  it("escapes anything staff type", () => {
    expect(escapeHtml(`"><script>x</script>`)).toBe(
      "&quot;&gt;&lt;script&gt;x&lt;/script&gt;",
    );
  });

  it("makes a short plain description", () => {
    expect(plainSnippet("## Hi\n\n**Note** [link](/x) here", 100)).toBe(
      "Hi **Note** link here",
    );
    expect(plainSnippet("word ".repeat(100), 50).endsWith("…")).toBe(true);
  });
});
