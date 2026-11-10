/* sw.js — Service worker: menyimpan berkas tampilan agar aplikasi tetap terbuka saat sinyal lemah.
   Data laporan dari server TIDAK disimpan di cache (privasi). */
const VERSI_CACHE = 'lapor-k3-v2.2.0';
const BERKAS = ['./', './index.html', './config.js', './css/app.css', './js/qr.js', './js/asisten.js', './js/api.js', './js/intel.js', './js/grafik.js', './js/app.js', './js/modul.js', './js/modul-kerja.js', './js/modul-dok.js', './js/modul-lanjut.js', './js/modul-izin.js',
  './manifest.webmanifest', './icons/ikon-192.png', './icons/ikon-512.png',
  './assets/logo.png', './assets/nama-hse.svg', './assets/nama-hse-putih.svg', './assets/bentenan-tenun.svg', './assets/bentenan-merah.svg', './assets/bentenan-terang.svg', './assets/pita-merah.svg',
  './assets/bentenan-medan-gading.svg', './assets/bentenan-medan-merah.svg', './assets/bentenan-pita-gading.svg', './assets/bentenan-pita-gading-v.svg', './assets/bentenan-pita-merah.svg',
  './fonts/inter-regular.woff', './fonts/inter-medium.woff', './fonts/inter-semibold.woff', './fonts/inter-bold.woff'];
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSI_CACHE).then(c => c.addAll(BERKAS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSI_CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // Jaringan dulu (agar pembaruan cepat terlihat), cadangan dari cache bila offline
    // cache: 'no-cache' = selalu cek versi terbaru ke server (melewati cache HTTP 10 menit GitHub Pages)
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => { if (res.ok) { const salin = res.clone(); caches.open(VERSI_CACHE).then(c => c.put(req, salin)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
  } else if (req.url === CDN) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const salin = res.clone(); caches.open(VERSI_CACHE).then(c => c.put(req, salin)); return res; })));
  }
  // Permintaan ke Supabase (data) tidak disentuh: selalu langsung ke server.
});

// Notifikasi push (Web Push). Isi hanya judul/ringkasan; data lengkap dibuka di aplikasi setelah login.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { judul: e.data ? e.data.text() : 'HSE' }; }
  e.waitUntil(self.registration.showNotification(d.judul || 'HSE', { body: d.isi || '', icon: './icons/ikon-192.png', badge: './icons/ikon-192.png', tag: d.tag || undefined, data: { tautan: d.tautan || '#/notifikasi' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tujuan = './' + ((e.notification.data && e.notification.data.tautan) || '#/notifikasi');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) { if ('focus' in w) { w.navigate(tujuan); return w.focus(); } } return self.clients.openWindow(tujuan); }));
});
