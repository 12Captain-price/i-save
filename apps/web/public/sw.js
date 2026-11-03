// i-Save service worker: makes the site installable and keeps the app shell and images
// on the phone so repeat visits load fast on weak data.
//
// What it never does: it does not touch anything that is not a plain GET to this site, so
// sign-in, Supabase data and the Worker API always go straight to the network. Money data
// is never stored here. To retire it, delete this file's registration in src/main.tsx.
const VERSION = "isave-v1";
const SHELL = ["/", "/favicon.png", "/icons/icon-192.png"];
const NEVER_CACHE = [
  "/staff/register-member",
  "/staff/create-staff",
  "/assistant",
  "/health",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, fonts, anything external
  if (NEVER_CACHE.includes(url.pathname)) return;

  // Pages: always try the network first so a new deploy shows straight away. Offline, fall
  // back to the saved app shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((hit) => hit || Response.error())),
    );
    return;
  }

  // Built files and pictures never change under the same name: serve the saved copy.
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
