const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8127;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 45000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = path.join(ROOT, p === '/' ? 'gift.html' : p);
  try {
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('not found'); }
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const errs = [];
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
  page.on('dialog', d => d.accept());
  await page.goto(`http://127.0.0.1:${PORT}/gift.html`, { waitUntil: 'domcontentloaded' });
  await sleep(3000); // 等 supabase CDN + auth 初始化

  const out = await page.evaluate(() => ({
    title: document.querySelector('.topbar h1') ? document.querySelector('.topbar h1').textContent : null,
    badge: document.getElementById('roleBadge') ? document.getElementById('roleBadge').textContent : null,
    authMaskShown: document.getElementById('authMask').classList.contains('active'),
    gridText: document.getElementById('grid').textContent.slice(0, 80),
    hasSearch: !!document.getElementById('searchInput'),
    adminBtnHidden: document.getElementById('btnAdd').style.display === 'none'
  }));

  // 搜索输入不报错
  await page.type('#searchInput', '伴侣盒');
  await sleep(300);

  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
  const ok = errs.length === 0 && out.title && out.hasSearch;
  console.log(ok ? 'SMOKE_PASS' : 'SMOKE_FAIL');
  await browser.close();
  server.close();
  clearTimeout(wd);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('SMOKE_CRASH:' + e.message); process.exit(2); });
