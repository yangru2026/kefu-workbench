/* 楠岃瘉鏂?sw.js锛氭敞鍐屾垚鍔?鈫?缂撳瓨 HTML 鈫?闄愰€熶笅浜屾鎵撳紑浠嶅畬濂戒笖绉掑紑 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const SRC = 'C:/temp/kefu_src';
const PORT = 8190;
const REF = 'icfgireprowcqwdodfqx';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG'); process.exit(3); }, 180000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const map = { '/': SRC + '/index.html', '/index.html': SRC + '/index.html', '/app.js': SRC + '/app.js', '/sw.js': SRC + '/sw.js' };
  const file = map[p] || path.join(ROOT, decodeURIComponent(p));
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('nf'); }
});
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const page = await browser.newPage();
  page.on('dialog', d => d.accept());
  const logs = [];
  page.on('console', m => { const t = m.text(); if (/Service Worker|SW|鑷姩鎭㈠/.test(t)) logs.push(t.slice(0, 160)); });
  page.on('pageerror', e => logs.push('ERR:' + e.message.slice(0, 160)));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (req.method() === 'OPTIONS' && u.includes('supabase')) {
      return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    }
    if (u.includes('supabase.co')) {
      if (u.includes('/rest/v1/profiles')) return req.respond(json({ id: 'u1', name: '鏉ㄨ尮', role: 'admin' }));
      if (u.includes('/rest/v1/')) return req.respond(json([]));
      return req.respond(json({}));
    }
    req.continue();
  });
  await page.evaluateOnNewDocument((ref) => {
    localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify({
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
      user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'u1@youhu.app', app_metadata: {}, user_metadata: {} }
    }));
  }, REF);

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);   // 绛?SW 娉ㄥ唽 + activate + 棰勫彇

  const sw = await page.evaluate(async () => {
    const out = { secure: window.isSecureContext, hasSW: 'serviceWorker' in navigator };
    if (!out.hasSW) return out;
    const regs = await navigator.serviceWorker.getRegistrations();
    out.regs = regs.length;
    out.scope = regs[0] && regs[0].scope;
    out.active = regs[0] && regs[0].active && regs[0].active.state;
    out.controller = !!(navigator.serviceWorker.controller);
    const names = await caches.keys();
    out.caches = names;
    const pageCacheName = names.find(n => /page$/.test(n));
    if (pageCacheName) {
      const c = await caches.open(pageCacheName);
      const keys = await c.keys();
      out.cachedUrls = keys.map(r => r.url.split('/').pop()).slice(0, 20);
      out.htmlCached = keys.some(r => /index\.html$/.test(r.url));
    }
    return out;
  });

  // 闄愰€熷悗浜屾鎵撳紑
  const cdp = await page.target().createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 180, downloadThroughput: Math.round(1.4 * 1024 * 1024 / 8), uploadThroughput: Math.round(0.7 * 1024 * 1024 / 8)
  });
  const t0 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  const dcl = Date.now() - t0;
  let usable = null;
  try {
    await page.waitForFunction(() => {
      const sp = document.getElementById('boot-splash');
      const hidden = !sp || sp.dataset.hidden === '1' || getComputedStyle(sp).display === 'none';
      return hidden && !!document.querySelector('.nav-item[data-page="home"]');
    }, { timeout: 40000, polling: 100 });
    usable = Date.now() - t0;
  } catch (e) {}
  const intact = await page.evaluate(() => ({
    navItems: document.querySelectorAll('.nav-item').length,
    hasQc: !!document.querySelector('.nav-item[data-page="qc"]'),
    bodyLen: document.body.innerText.length
  }));

  const out = { sw, reload: { dcl, usable, intact }, logs };

  // 二次打开后：核对 HTML 是否已被 SW 缓存，再做第三次「限速冷网络」打开（应秒开）
  const cache2 = await page.evaluate(async () => {
    const names = await caches.keys();
    const pageCacheName = names.find(n => /page$/.test(n));
    if (!pageCacheName) return { htmlCached: false };
    const c = await caches.open(pageCacheName);
    const keys = await c.keys();
    return { htmlCached: keys.some(r => /index\.html$/.test(r.url)), cachedUrls: keys.map(r => r.url.split('/').pop()).slice(0, 12) };
  });
  const t1 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const dcl3 = Date.now() - t1;
  let usable3 = null;
  try {
    await page.waitForFunction(() => {
      const sp = document.getElementById('boot-splash');
      const hidden = !sp || sp.dataset.hidden === '1' || getComputedStyle(sp).display === 'none';
      return hidden && !!document.querySelector('.nav-item[data-page="home"]');
    }, { timeout: 40000, polling: 100 });
    usable3 = Date.now() - t1;
  } catch (e) {}
  out.thirdLoad = { dcl: dcl3, usable: usable3 };
  out.cacheAfterReload = cache2;

  fs.writeFileSync(ROOT + '/outputs/diag-sw-verify.out', JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out, null, 2));
  await browser.close(); server.close(); clearTimeout(wd);
  process.exit(0);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });

