/* Service worker: کش کردن فایل‌های برنامه تا آفلاین کار کند.
   هر بار فایل‌های برنامه را عوض کردید، عدد VERSION را بالا ببرید. */
const VERSION = 'v3';
const CACHE = 'building-accounting-' + VERSION;
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/jalali.js', './js/util.js', './js/store.js', './js/calc.js', './js/ui.js', './js/pages-main.js', './js/pages-money.js', './js/pages-reports.js', './js/boot.js',
  './fonts/Vazirmatn.woff2', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('building-accounting-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
