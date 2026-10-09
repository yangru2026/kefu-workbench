/* 验证 min-width:auto 塌列理论：
 * 给 nav-item 注入放大字号（模拟茹姐浏览器的"最小字号/字体偏宽"），
 * 看是否复现「大部分项单排 + 弥生价/极氧价两列」的截图形态 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8153;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 120000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = p === '/new.html' ? 'C:/temp/kefu_src/index.html'
    : path.join(ROOT, decodeURIComponent(p));
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
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*', '--force-device-scale-factor=1']
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
  await sleep(2500);

  // 模拟 admin 全部菜单可见（她截图里有成员管理等 admin 项）
  await page.evaluate(() => {
    document.querySelectorAll('.admin-only-nav, .qc-admin-nav').forEach(el => el.style.display = '');
  });

  // 逐步放大字号，观察塌列拐点
  for (const fsz of [13, 16, 18, 20]) {
    await page.evaluate(f => {
      let st = document.getElementById('__minwidth_probe');
      if (!st) { st = document.createElement('style'); st.id = '__minwidth_probe'; document.head.appendChild(st); }
      st.textContent = `.nav-item { font-size: ${f}px !important; }`;
    }, fsz);
    await sleep(250);
    const rows = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.nav-item')].filter(el => el.offsetParent !== null || el.getBoundingClientRect().width > 0);
      const seen = {};
      items.forEach(el => {
        const r = el.getBoundingClientRect();
        const key = Math.round(r.top);
        (seen[key] = seen[key] || []).push({ t: (el.textContent || '').trim().slice(0, 4), x: Math.round(r.x), w: Math.round(r.width) });
      });
      return Object.entries(seen).slice(0, 14).map(([top, arr]) => ({ top: +top, n: arr.length, items: arr }));
    });
    console.log(`\n── 字号 ${fsz}px ──`);
    rows.forEach(r => console.log(`  y=${r.top} 项数=${r.n}`, r.items.map(i => i.t + '(' + i.w + ')').join(' | ')));
  }

  // 字号 18 时截个图留证
  await page.evaluate(() => {
    const st = document.getElementById('__minwidth_probe');
    st.textContent = '.nav-item { font-size: 18px !important; }';
  });
  await sleep(300);
  const sb = await page.$('.sidebar');
  if (sb) await sb.screenshot({ path: 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/nav-minwidth-collapse.png' });

  await browser.close();
  server.close();
  clearTimeout(wd);
  process.exit(0);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
