/* Theatrium wine list — service worker.
   Network-first with cache fallback: content is always fresh when online,
   and the whole app keeps working if the restaurant Wi-Fi drops. */
"use strict";

const CACHE = "theatrium-v3";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  /* App code and data bypass the HTTP cache (revalidate with the server
     via ETag) so a new deploy is picked up on the next page load instead
     of after GitHub Pages' 10-minute max-age. Fonts/images stay cached. */
  const url = new URL(e.request.url);
  const revalidate = e.request.mode === "navigate" ||
    (url.origin === location.origin && /\.(js|css|json|webmanifest)$/.test(url.pathname));
  const req = revalidate ? new Request(e.request.url, { cache: "no-cache" }) : e.request;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || Response.error()))
  );
});
