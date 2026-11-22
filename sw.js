// Service worker ERP Quatar: lưu sẵn giao diện để mở nhanh; dữ liệu luôn lấy mới từ máy chủ.
const CACHE = 'quatar-v0.3';
const SHELL = ['./', 'index.html', 'app.js', 'style.css', 'logo.png', 'icon-192.png', 'manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Supabase & CDN: đi thẳng mạng
  // Mạng trước (luôn có bản mới nhất), mất mạng thì dùng bản đã lưu
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
