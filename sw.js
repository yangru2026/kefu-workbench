/* 客服工作台 静态资源缓存 Service Worker
 * 目的：vendor/ 下的库（supabase 208KB / xlsx 862KB / qrcode 56KB）与花色素材图片
 *       托管在 GitHub Pages(境外)，国内首次加载常超时 → 页面「加载异常」/「图片加载太慢」。
 *       用 SW 把它们缓存到本地后，后续打开直接命中本地缓存，摆脱境外网络抖动。
 * 策略：
 *   - vendor 库：cache-first（缓存优先，后台静默更新）
 *   - images/ 图片：stale-while-revalidate（先返回缓存=秒开，后台静默拉新版）
 *   - 其余同源资源：network-first（保证页面/配置永远最新），失败回落缓存
 */
const VERSION = 'kefu-sw-v2';
const LIB_CACHE = VERSION + '-lib';
const PAGE_CACHE = VERSION + '-page';
// 图片缓存名刻意不随 VERSION 变化：SW 升级时不至于把用户已缓存的花色图全部清掉
const IMG_CACHE = 'kefu-sw-img-v1';
const IMG_MAX_ENTRIES = 800;   // 条目上限（约 30MB），超出后按插入顺序淘汰旧条目

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
    await Promise.all(keys.filter(k => k !== LIB_CACHE && k !== PAGE_CACHE && k !== IMG_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isLib(url) {
  return /\/vendor\/.*\.js(\?|$)/.test(url.pathname + url.search) ||
         /\/vendor\//.test(url.pathname);
}

// 花色素材等图片资源（同源 GitHub Pages 下的 images/）
function isImage(url) {
  if (/\/images\//.test(url.pathname)) return true;
  return /\.(webp|jpe?g|png|gif|svg|avif|ico)$/i.test(url.pathname);
}

// 控制图片缓存体积：超出上限时删除最早插入的条目，避免无限增长
async function trimCache(cache, maxEntries) {
  try {
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    await Promise.all(keys.slice(0, keys.length - maxEntries).map(k => cache.delete(k)));
  } catch (err) {}
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

  // ── 花色素材图片：stale-while-revalidate（命中缓存秒开，后台静默更新）
  if (isImage(url)) {
    e.respondWith((async () => {
      const c = await caches.open(IMG_CACHE);
      const hit = await c.match(req);
      if (hit) {
        // 先把缓存版本返回给页面（秒开），同时后台拉一次最新资源
        fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); }).catch(() => {});
        return hit;
      }
      try {
        const r = await fetch(req);
        if (r && r.ok) { c.put(req, r.clone()); trimCache(c, IMG_MAX_ENTRIES); }
        return r;
      } catch (err) {
        // 网络彻底不通时返回空占位，避免破图图标
        return new Response('', { status: 504, statusText: 'image unavailable' });
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
