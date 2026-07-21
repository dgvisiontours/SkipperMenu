const CACHE = "paszowoz-v28";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./catalog.js", "./config.js", "./manifest.webmanifest", "./icon.svg", "./logo-bluebag.svg"];

self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))));
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});

self.addEventListener("push", (event) => {
  const fallback = {
    title: "Paszowóz: brakuje zamówienia",
    body: "Nie złożono jeszcze zamówienia na najbliższe wydanie.",
    url: "./",
  };
  let payload = fallback;
  try {
    payload = event.data ? event.data.json() : fallback;
  } catch {
    payload = fallback;
  }
  event.waitUntil(self.registration.showNotification(payload.title || fallback.title, {
    body: payload.body || fallback.body,
    icon: "./icon.svg",
    badge: "./icon.svg",
    data: { url: payload.url || fallback.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    const client = clientList.find((item) => item.url === targetUrl || item.url === `${targetUrl}/`);
    if (client) return client.focus();
    return clients.openWindow(targetUrl);
  }));
});
