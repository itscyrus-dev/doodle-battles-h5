// 离线缓存。__VERSION__ 和 __FILES__ 由 release/build_web.py 在打包时替换；
// 本地开发不会注册这个文件（见 src/app.mjs），所以这里的占位符只在正式包里生效。
const VERSION = '__VERSION__';
const CACHE = `draw-clash-${VERSION}`;
const FILES = __FILES__;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  // 新版本接管后删掉旧版本的缓存，避免新旧文件混用。
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('draw-clash-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const remember = response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; };
  // 图片很少变动：先用缓存。页面和代码：先联网拿最新的，离线时才用缓存。
  if (url.pathname.includes('/assets/')) { event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(remember))); return; }
  event.respondWith(fetch(request).then(remember).catch(() => caches.match(request, { ignoreSearch: true }).then(hit => hit || caches.match('./'))));
});
