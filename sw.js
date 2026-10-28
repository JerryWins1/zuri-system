// Zuri System · old address · v6 · 2026-10-27
// Zuri now lives in preview/ (with its own offline shell). This replaces the old shell on phones that still have it:
// it takes nothing over and removes itself, so the old address always reaches the redirect page.
// It deletes no caches: they are shared with preview/, whose own shell clears the old ones.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(self.registration.unregister().then(() => self.clients.matchAll({ type: 'window' }))
    .then((cs) => cs.forEach((c) => c.navigate(c.url).catch(() => {}))));
});
