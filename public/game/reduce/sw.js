const GAME = "reduce";
const CACHE_NAME = `${GAME}-v1`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          // Only this game's own older caches. Every game on the origin shares
          // one cache storage, so a bare "not mine" sweep takes theirs too.
          keys
            .filter((key) => key !== CACHE_NAME && key.startsWith(`${GAME}-`))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(e.request).then((cached) => {
        const fetched = fetch(e.request).then((response) => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        });
        return cached || fetched;
      }),
    ),
  );
});
