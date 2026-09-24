/* 花色素材「秒开」改造验证
 * 验证点：
 *  1. 页面初始化无 pageerror
 *  2. 卡片 img 的 src 不再出现 cdn.jsdelivr.net（历史根因：301 → raw.githubusercontent 超时）
 *  3. img src 指向同源 GitHub Pages（可被 Service Worker 缓存）
 *  4. 图片真实加载成功（naturalWidth > 0），证明新链路可达
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8137;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 120000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8'
      : p.endsWith('.js') ? 'application/javascript'
      : p.endsWith('.webp') ? 'image/webp' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('not found'); }
});

const json = (obj) => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(obj) });
const now = new Date().toISOString();

// 真实形态：thumb_*_url 存的是相对路径（数据库实际值）
const REL_EYE = 'images/patterns/thumb/misho_daily_%E4%B8%80%E5%A4%9C%E9%B2%8D%E5%AF%8C_eye.webp';
const REL_LENS = 'images/patterns/thumb/misho_daily_%E4%B8%80%E5%A4%9C%E9%B2%8D%E5%AF%8C_lens.webp';

const rows = [
  { id: 'a1', brand: '弥生', type: '日抛', name: '一夜鲍富', series: '日常系列', color: '棕色系',
    diameter: '14.2', color_diameter: '13.5', material: '硅水凝胶', base_curve: '8.6',
    price_tier: '29.9元/副', diam_group: '小直径',
    lens_img: REL_LENS, eye_img: REL_EYE, lens_imgs: [REL_LENS], eye_imgs: [REL_EYE],
    thumb_eye_url: REL_EYE, thumb_lens_url: REL_LENS,
    description: '测试用花色一', sort_order: 10, is_discontinued: false, created_at: now },
  { id: 'a2', brand: '弥生', type: '月抛', name: '企鹅妮妮', series: '日常系列', color: '灰色系',
    diameter: '14.0', color_diameter: '13.0', material: '硅水凝胶', base_curve: '8.6',
    price_tier: '39.9元/副', diam_group: '小直径',
    lens_img: '', eye_img: 'images/patterns/thumb/misho_daily_%E4%BC%81%E9%B9%85%E5%A6%AE%E5%A6%AE_eye.webp',
    lens_imgs: [], eye_imgs: ['images/patterns/thumb/misho_daily_%E4%BC%81%E9%B9%85%E5%A6%AE%E5%A6%AE_eye.webp'],
    thumb_eye_url: 'images/patterns/thumb/misho_daily_%E4%BC%81%E9%B9%85%E5%A6%AE%E5%A6%AE_eye.webp',
    thumb_lens_url: '',
    description: '测试用花色二', sort_order: 5, is_discontinued: false, created_at: '2026-07-01T00:00:00Z' },
  { id: 'a3', brand: '弥生', type: '日抛', name: '在逃公主pro', series: '少女漫-日抛', color: '棕色系',
    diameter: '14.2', color_diameter: '13.5', material: '硅水凝胶', base_curve: '8.6',
    price_tier: '29.9元/副', diam_group: '小直径',
    lens_img: '', eye_img: 'https://ienmejlxukhrxjjxvfqf.supabase.co/storage/v1/object/public/pattern-images/eye/41d189d3-7d83-4413-a089-da94ffb90822.jpg',
    lens_imgs: [], eye_imgs: ['https://ienmejlxukhrxjjxvfqf.supabase.co/storage/v1/object/public/pattern-images/eye/41d189d3-7d83-4413-a089-da94ffb90822.jpg'],
    thumb_eye_url: '', thumb_lens_url: '',
    description: '测试用花色三（Supabase Storage 原图，应走 render 缩略）', sort_order: 3, is_discontinued: false, created_at: '2026-06-01T00:00:00Z' }
];

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
  page.on('dialog', d => d.accept());   // 防 confirm/alert 卡死 evaluate

  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (req.method() === 'OPTIONS' && u.includes('supabase')) {
      return req.respond({ status: 200, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' }});
    }
    if (u.includes('/rest/v1/pattern_assets')) return req.respond(json(rows));
    if (u.includes('/rest/v1/pattern_categories')) return req.respond(json([]));
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  await page.evaluate(() => { try { switchPage('patterns'); } catch (e) {} });
  await sleep(2000);
  // 兜底：直接驱动渲染，确保不依赖登录态
  await page.evaluate(() => {
    try {
      if (typeof patternData !== 'undefined' && patternData && patternData.brands) renderPatterns();
    } catch (e) {}
  });
  await sleep(4000);  // 等图片真实加载

  const out = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('#pattern-grid img')];
    const srcs = imgs.map(i => i.getAttribute('src') || '');
    return {
      imgCount: imgs.length,
      srcs,
      jsdelivrCount: srcs.filter(s => s.includes('cdn.jsdelivr.net')).length,
      sameOriginCount: srcs.filter(s => s.indexOf('https://yangru2026.github.io/kefu-workbench/') === 0).length,
      storageThumbCount: srcs.filter(s => s.includes('/storage/v1/render/image/public/') && s.includes('width=400')).length,
      storageRawCount: srcs.filter(s => s.includes('/storage/v1/object/public/')).length,
      loadedOk: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      broken: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
      // 直接测函数
      fnRelative: (typeof toCdnUrl === 'function') ? toCdnUrl('images/patterns/thumb/x.webp') : 'NO_FN',
      fnOldCdn: (typeof toCdnUrl === 'function') ? toCdnUrl('https://cdn.jsdelivr.net/gh/yangru2026/kefu-workbench@main/images/patterns/thumb/x.webp') : 'NO_FN',
      fnSupabase: (typeof toCdnUrl === 'function') ? toCdnUrl('https://ienmejlxukhrxjjxvfqf.supabase.co/storage/v1/object/public/a.webp') : 'NO_FN',
      fnStorageThumb: (typeof toThumbUrl === 'function') ? toThumbUrl('https://ienmejlxukhrxjjxvfqf.supabase.co/storage/v1/object/public/pattern-images/eye/x.jpg') : 'NO_FN',
      fnStorageLarge: (typeof toLargeImageUrl === 'function') ? toLargeImageUrl('https://ienmejlxukhrxjjxvfqf.supabase.co/storage/v1/object/public/pattern-images/eye/x.jpg') : 'NO_FN',
      swRegistered: !!(navigator.serviceWorker && navigator.serviceWorker.controller !== undefined)
    };
  });

  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');

  const ok = errs.length === 0
    && out.imgCount === 4
    && out.jsdelivrCount === 0
    && out.storageRawCount === 0          // 不再直接拉 Supabase Storage 原图
    && out.storageThumbCount === 1        // Storage 图改走 render 缩略端点
    && out.sameOriginCount === 3          // 其余 3 张走同源 GitHub Pages
    && out.loadedOk === 4
    && out.broken === 0
    && out.fnRelative.indexOf('https://yangru2026.github.io/kefu-workbench/images/') === 0
    && out.fnOldCdn.indexOf('https://yangru2026.github.io/kefu-workbench/images/') === 0
    && out.fnSupabase.indexOf('supabase.co') > -1
    && out.fnStorageThumb.indexOf('/storage/v1/render/image/public/') > -1
    && out.fnStorageThumb.indexOf('width=400') > -1
    && out.fnStorageLarge.indexOf('width=1200') > -1;

  console.log(ok ? 'PATTERN_SPEED_SMOKE_PASS' : 'PATTERN_SPEED_SMOKE_FAIL');
  await browser.close(); server.close(); clearTimeout(wd); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
