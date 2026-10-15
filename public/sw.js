/* LYST service worker: shows the task alerts pushed by the server and opens the site when tapped. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "UN/FOLD", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "UN/FOLD 2026", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // one alert per task: the "1 min left" nudge replaces the first instead of stacking
      tag: data.tag || "lyst",
      renotify: true,
      // stay on screen until the guest reacts (desktop/Android; iOS ignores this)
      requireInteraction: data.requireInteraction === true,
      timestamp: data.timestamp || Date.now(),
      // strong, attention-grabbing buzz pattern
      vibrate: [250, 100, 250, 100, 400],
      data: { url: data.url || "/", task: data.task || null },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
