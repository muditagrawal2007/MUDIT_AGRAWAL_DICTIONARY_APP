// Offline support: cache the whole app (it is tiny) on install.
// Network-first for the data file so corrected entries reach users; cache-first for the rest.
const CACHE = 'garuda-dict-v1';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'search.js',
  'data/dictionary.json', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('dictionary.json')) {
    e.respondWith(fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true })
    .then(hit => hit || fetch(e.request)));
});
