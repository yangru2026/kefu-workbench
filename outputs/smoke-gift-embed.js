const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8129;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 60000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
  try {
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('not found'); }
});

const json = (obj) => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(obj) });

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 868 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (req.method() === 'OPTIONS' && u.includes('supabase')) {
      return req.respond({ status: 200, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' }});
    }
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);

  // 未登录也允许切页：直接调 switchPage
  await page.evaluate(() => { try { switchPage('gift'); } catch(e) { console.log('switch fail', e.message); } });
  await sleep(3500);

  const out = await page.evaluate(() => {
    const wrap = document.getElementById('page-gift');
    const ifr = document.getElementById('gift-iframe');
    const r = ifr.getBoundingClientRect();
    let inner = null;
    try { inner = { h: ifr.contentDocument.body.scrollHeight, cards: ifr.contentDocument.querySelectorAll('.card').length }; } catch(e) { inner = { err: e.message }; }
    return {
      wrapDisplay: getComputedStyle(wrap).display,
      wrapHeight: wrap.getBoundingClientRect().height,
      iframeHeight: r.height, iframeTop: r.top,
      innerPageHeight: inner
    };
  });
  console.log(JSON.stringify(out, null, 2));
  await page.screenshot({ path: 'outputs/gift-fixed.png' });
  const ok = out.iframeHeight > 700 && out.wrapDisplay === 'flex';
  console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
  console.log(ok ? 'FIX_VERIFY_PASS' : 'FIX_VERIFY_FAIL');
  await browser.close(); server.close(); clearTimeout(wd); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
