/* 客服工作台 静态资源缓存 Service Worker
 * 目的：GitHub Pages 托管在境外，国内直连慢/易超时。核心目标是「打开秒开、切页秒开」。
 *
 * 2026-10-31 性能改造（v3）：
 *   - 【关键】页面 HTML 也纳入缓存：network-with-timeout（1.8s）→ 超时立刻回退本地缓存。
 *     网络快时永远是最新版；网络慢时秒出上次版本，不再干等近 1MB 的 index.html。
 *   - 同源 JS/CSS/JSON：stale-while-revalidate（先返回缓存，后台更新）。app.js 等带 ?v= 版本号，
 *     发布新版本 URL 就变，天然不会读到旧代码。
 *   - vendor 库：cache-first；但不再预缓存 xlsx（861KB，导出时才用，改成用时再拉）。
 *   - images/：stale-while-revalidate（缓存名固定，升级不清空）。
 */
const VERSION = 'kefu-sw-v6';
const LIB_CACHE = VERSION + '-lib';
const PAGE_CACHE = VERSION + '-page';
const IMG_CACHE = 'kefu-sw-img-v1';   // 固定名：升级 SW 不清空已缓存花色图
const IMG_MAX_ENTRIES = 800;
const HTML_TIMEOUT = 1800;             // HTML 等网络的上限，超时就用缓存

// 安装时只预热「小体积 + 必需」的库；xlsx(861KB) 改为用到时再下载
const LIB_ASSETS = [
  './vendor/supabase.min.js?v=2',
  './vendor/qrcode.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(LIB_CACHE);
    await Promise.all(LIB_ASSETS.map(async (u) => {
      try {
        const r = await fetch(u, { cache: 'reload' });
        if (r && r.ok) await c.put(u, r.clone());
      } catch (err) { /* 首次网络差，后续 fetch 时再补 */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== LIB_CACHE && k !== PAGE_CACHE && k !== IMG_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isLib(url) {
  return /\/vendor\/.*\.js(\?|$)/.test(url.pathname + url.search) || /\/vendor\//.test(url.pathname);
}
function isImage(url) {
  if (/\/images\//.test(url.pathname)) return true;
  return /\.(webp|jpe?g|png|gif|svg|avif|ico)$/i.test(url.pathname);
}
function isHtml(req, url) {
  return req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
}
function isSameOrigin(url) { return url.origin === self.location.origin; }

async function trimCache(cache, maxEntries) {
  try {
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    await Promise.all(keys.slice(0, keys.length - maxEntries).map(k => cache.delete(k)));
  } catch (err) {}
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (!isSameOrigin(url)) return;              // 跨域（supabase/CDN）交给浏览器

  // ── 页面 HTML：网络优先，1.8 秒没回来就用缓存（秒开）
  if (isHtml(req, url)) {
    e.respondWith((async () => {
      const c = await caches.open(PAGE_CACHE);
      const hit = await c.match(req, { ignoreSearch: false });
      const net = fetch(req).then(r => {
        if (r && r.ok) c.put(req, r.clone());
        return r;
      });
      if (!hit) {
        try { return await net; } catch (err) { return new Response('离线且无缓存', { status: 503 }); }
      }
      const timeout = new Promise(res => setTimeout(() => res('__timeout__'), HTML_TIMEOUT));
      const winner = await Promise.race([net.catch(() => '__fail__'), timeout]);
      if (winner === '__timeout__' || winner === '__fail__') return hit;   // 慢/断网 → 立返缓存
      return winner;
    })());
    return;
  }

  // ── vendor 库：缓存优先（命中即返回，后台静默更新）
  if (isLib(url)) {
    e.respondWith((async () => {
      const c = await caches.open(LIB_CACHE);
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) {
        fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); }).catch(() => {});
        return hit;
      }
      try {
        const r = await fetch(req);
        if (r && r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        const fb = await c.match(req, { ignoreSearch: true });
        if (fb) return fb;
        return new Response('/* lib unavailable */', { status: 503, headers: { 'Content-Type': 'application/javascript' } });
      }
    })());
    return;
  }

  // ── 图片：stale-while-revalidate
  if (isImage(url)) {
    e.respondWith((async () => {
      const c = await caches.open(IMG_CACHE);
      const hit = await c.match(req);
      if (hit) {
        fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); }).catch(() => {});
        return hit;
      }
      try {
        const r = await fetch(req);
        if (r && r.ok) { c.put(req, r.clone()); trimCache(c, IMG_MAX_ENTRIES); }
        return r;
      } catch (err) {
        return new Response('', { status: 504, statusText: 'image unavailable' });
      }
    })());
    return;
  }

  // ── 其它同源静态（js/css/json/img 等）：先给缓存（秒开），后台更新
  e.respondWith((async () => {
    const c = await caches.open(PAGE_CACHE);
    const hit = await c.match(req);
    const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; });
    if (hit) { net.catch(() => {}); return hit; }
    try { return await net; } catch (err) { throw err; }
  })());
});
