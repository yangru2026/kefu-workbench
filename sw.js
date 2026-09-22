/* 客服工作台 静态资源缓存 Service Worker
 * 目的：vendor/ 下的库（supabase 208KB / xlsx 862KB / qrcode 56KB）托管在 GitHub Pages(境外)，
 *       国内首次加载常超时 → 页面「加载异常」。用 SW 把它们缓存到本地后，
 *       后续打开直接命中本地缓存，彻底摆脱境外网络抖动。
 * 策略：
 *   - vendor 库：cache-first（缓存优先，后台静默更新）
 *   - 其余同源资源：network-first（保证页面/配置永远最新），失败回落缓存
 */
const VERSION = 'kefu-sw-v1';
const LIB_CACHE = VERSION + '-lib';
const PAGE_CACHE = VERSION + '-page';

// 必须提前建立的核心资源（任一失败不阻塞安装）
const LIB_ASSETS = [
  './vendor/supabase.min.js?v=2',
  './vendor/xlsx.full.min.js?v=2',
  './vendor/qrcode.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(LIB_CACHE);
    // 逐个下载，单个失败不影响其他
    await Promise.all(LIB_ASSETS.map(async (u) => {
      try {
        const r = await fetch(u, { cache: 'reload' });
        if (r && r.ok) await c.put(u, r.clone());
      } catch (err) {
        // 首次安装时网络不好，交给后续 fetch 时再补
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== LIB_CACHE && k !== PAGE_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isLib(url) {
  return /\/vendor\/.*\.js(\?|$)/.test(url.pathname + url.search) ||
         /\/vendor\//.test(url.pathname);
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (!isSameOrigin(url)) return;           // 只处理同源，跨域 CDN 交给浏览器
  if (url.pathname.endsWith('.html')) return; // 页面本身走 network-first

  // ── vendor 库：缓存优先，命中即返回（秒开、不怕断网）
  if (isLib(url)) {
    e.respondWith((async () => {
      const c = await caches.open(LIB_CACHE);
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) {
        // 后台静默更新，不阻塞返回
        fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); }).catch(() => {});
        return hit;
      }
      try {
        const r = await fetch(req);
        if (r && r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        const fallback = await c.match(req, { ignoreSearch: true });
        if (fallback) return fallback;
        return new Response('/* lib unavailable */', { status: 503, headers: { 'Content-Type': 'application/javascript' } });
      }
    })());
    return;
  }

  // ── 其他同源静态资源：network-first，失败回落缓存
  e.respondWith((async () => {
    const c = await caches.open(PAGE_CACHE);
    try {
      const r = await fetch(req);
      if (r && r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      const hit = await c.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});
