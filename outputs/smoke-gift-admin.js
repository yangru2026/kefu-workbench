const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8128;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 60000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = path.join(ROOT, p === '/' ? 'gift-test.html' : p);
  try {
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('not found'); }
});

const json = (obj) => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(obj) });
const rows = Array.from({ length: 10 }, (_, i) => ({
  id: 'g' + (i + 1), name: '测试赠品' + (i + 1), merchant_code: '编码' + (i + 1),
  cost: String(i + 1), image_path: null, sort_order: i + 1
}));

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE[' + m.type() + ']:', m.text().slice(0, 200)); });
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (req.method() === 'OPTIONS' && u.includes('supabase')) {
      return req.respond({ status: 200, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400'
      }});
    }
    if (u.includes('/rest/v1/gift_codes')) { console.log('REQ gift_codes -> mock'); return req.respond(json(rows)); }
    if (u.includes('/rest/v1/profiles')) { console.log('REQ profiles -> mock'); return req.respond(json({ id: 'u1', role: 'admin', name: 'test' })); }
    if (u.includes('/auth/v1/')) { console.log('REQ auth -> mock {}'); return req.respond(json({})); }
    if (u.includes('supabase')) console.log('REQ (pass):', u.slice(0, 120));
    req.continue();
  });
  // 拦截 supabase-js：getSession 永远返回已登录用户
  await page.evaluateOnNewDocument(() => {
    let _sb;
    Object.defineProperty(window, 'supabase', {
      configurable: true,
      get() { return _sb; },
      set(v) {
        if (v && v.createClient) {
          const orig = v.createClient.bind(v);
          v.createClient = (...a) => {
            const c = orig(...a);
            const fakeUser = { id: 'u1', aud: 'authenticated', app_metadata: {}, user_metadata: {} };
            c.auth.getSession = async () => ({ data: { session: { access_token: 'fake', user: fakeUser } } });
            return c;
          };
        }
        _sb = v;
      }
    });
  });

  await page.goto(`http://127.0.0.1:${PORT}/gift-test.html`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);

  const info = await page.evaluate(() => {
    const cards = document.querySelectorAll('.card');
    const first = cards[0];
    return {
      badge: document.getElementById('roleBadge').textContent,
      cardCount: cards.length,
      firstCardHTML: first ? first.outerHTML.slice(0, 500) : null,
      firstCardRect: first ? JSON.parse(JSON.stringify(first.getBoundingClientRect())) : null,
      gridRect: JSON.parse(JSON.stringify(document.getElementById('grid').getBoundingClientRect()))
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: 'outputs/gift-repro.png' });
  console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
  await browser.close(); server.close(); clearTimeout(wd); process.exit(0);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
