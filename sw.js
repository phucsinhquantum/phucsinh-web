/* Phúc Sinh QuanTum: service worker để cài web như ứng dụng (PWA).
   Luôn lấy bản mới nhất từ mạng; chỉ khi mất mạng mới dùng bản đã lưu, nên sửa web xong là khách thấy ngay. */
const CACHE = 'psq-v11';
const CORE = ['./', './index.html', './san-pham.html', './dat-hang.html', './thanh-vien.html', './lien-he.html', './khuyen-mai.html', './img/logo-psq.png', './img/icon-192.png', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;   // dữ liệu máy chủ, video, phông chữ, bên ngoài: để trình duyệt tự xử lý
  e.respondWith(fetch(r).then(res => {
    if (res.ok && res.type === 'basic' && !/\.(mp3|mp4|webm)$/i.test(url.pathname)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: r.mode === 'navigate' }).then(m => m || (r.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
