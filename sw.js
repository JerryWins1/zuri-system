// Zuri System · offline shell · v3 · 2026-09-30
// App files: network first (always fresh when there's signal), cached copy when there isn't.
// Libraries from the CDN: cache first (they never change at a pinned version).
// Database calls are never cached here — the app keeps its own copy of the jobs it needs.
const CACHE = 'zuri-v23';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon.svg', 'js/config.js', 'js/app.js', 'js/home.js', 'js/tasks.js', 'js/jobs.js', 'js/customers.js', 'js/money.js', 'js/statements.js', 'js/imports.js', 'js/admin.js', 'js/practice.js', 'js/training.js', 'js/checklist_data.js', 'js/testing.js', 'js/lessons_fields.js', 'js/lessons_day.js', 'js/map.js', 'js/staffpay.js', 'guides/testers.html', 'guides/welcome.html',
  'guides/field.html', 'guides/callcenter.html', 'guides/finance.html', 'guides/partners.html', 'guides/trainer.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'];

self.addEventListener('install', (e) => {
  // One file failing on weak signal must not stop the rest from being saved.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;
  const cdn = /(^|\.)(jsdelivr\.net|cloudflare\.com)$/.test(url.hostname);
  if (cdn) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
