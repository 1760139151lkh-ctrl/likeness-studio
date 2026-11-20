/* 哈基秀 service worker：静态资源缓存优先（第二次打开秒开），页面与接口永远走网络。 */
const CACHE = 'hjx-static-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.endsWith('studio.json')) return;
  const versioned = /^\/v[0-9a-f]{16}\//.test(url.pathname);
  const heavy = /\/(img|vendor|fonts)\//.test(url.pathname);
  if (!versioned && !heavy) return;   // unversioned code: let the browser revalidate as usual
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok && res.type === 'basic') cache.put(e.request, res.clone());
    return res;
  })());
});
