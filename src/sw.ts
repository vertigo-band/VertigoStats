/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Web Share Target: Android "Share → Promo Tracker" POSTs the screenshots here.
// Stash them in a cache, then redirect into the app which picks them up.
self.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || !url.pathname.endsWith("/share-target")) return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const files = form.getAll("screenshots").filter((f): f is File => f instanceof File);
      const cache = await caches.open("shared-screenshots");
      await Promise.all(
        files.map((f, i) =>
          cache.put(new Request(`shared/${Date.now()}-${i}`), new Response(f, { headers: { "Content-Type": f.type, "X-Name": encodeURIComponent(f.name) } })),
        ),
      );
      return Response.redirect(new URL("./?shared=1", self.registration.scope).href, 303);
    })(),
  );
});
