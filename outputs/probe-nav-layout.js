/* 渲染本地 index.html，截图侧边栏 + 输出每个 nav-item 的实际布局值 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8151;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 120000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  let file;
  if (p === '/new.html') file = 'C:/temp/kefu_src/index.html';
  else if (p === '/old.html') file = 'C:/temp/kefu_old_index.html';
  else file = path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
  try {
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch (e) { res.writeHead(404); res.end('nf'); }
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });
  page.on('dialog', d => d.accept());
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (req.method() === 'OPTIONS' && u.includes('supabase'))
      return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (u.includes('/rest/v1/') || u.includes('/auth/v1/') || u.includes('/functions/v1/'))
      return req.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '[]' });
    req.continue();
  });

  await page.goto(`http://127.0.0.1:${PORT}/new.html`, { waitUntil: 'domcontentloaded' });
  await sleep(3500);

  const info = await page.evaluate(() => {
    const nav = document.querySelector('.sidebar-nav');
    const cs = nav ? getComputedStyle(nav) : null;
    const items = [...document.querySelectorAll('.nav-item')].map(el => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        page: el.dataset.page,
        display: s.display,
        flexBasis: s.flexBasis,
        width: Math.round(r.width),
        x: Math.round(r.x),
        text: (el.textContent || '').trim().slice(0, 8)
      };
    });
    return {
      navFound: !!nav,
      navDisplay: cs ? cs.display : null,
      navFlexWrap: cs ? cs.flexWrap : null,
      navWidth: nav ? Math.round(nav.getBoundingClientRect().width) : null,
      sidebarWidth: (() => { const sb = document.querySelector('.sidebar'); return sb ? Math.round(sb.getBoundingClientRect().width) : null; })(),
      items
    };
  });

  console.log(JSON.stringify(info, null, 1));

  const sb = await page.$('.sidebar');
  if (sb) await sb.screenshot({ path: 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/nav-sidebar-now.png' });

  await browser.close();
  server.close();
  clearTimeout(wd);
  process.exit(0);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
