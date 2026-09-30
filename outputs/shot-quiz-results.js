/* 给茹姐看的成绩页效果截图（用假数据渲染，无需登录）
 * 用法：node outputs/shot-quiz-results.js
 * 产出：outputs/preview-quiz-results-list.png（成绩列表）
 *       outputs/preview-quiz-results-detail.png（答卷明细·只看错题）
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8199;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 90000);

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, p === '/' ? '/quiz-results.html' : p);
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(buf);
});

function stubSupabase() {
  const readCfg = () => {
    try {
      const m = String(location.search || '').match(/[?&]cfg=([^&]*)/);
      if (m) return JSON.parse(decodeURIComponent(m[1]));
    } catch (e) {}
    return {};
  };
  const mkDetail = () => {
    const d = [];
    for (let i = 1; i <= 35; i++) {
      d.push({ no: i, sec: '一、单选题', ans: i <= 30 ? 'A. 测试作答' : '测试文本', got: i <= 27 ? 2 : 0, full: 2, kind: i > 30 ? 'self' : 'auto' });
    }
    return d;
  };
  const mkRows = () => {
    const today = new Date(), yest = new Date(Date.now() - 864e5);
    const base = { quiz_key: 'miyang-color-price', quiz_title: '弥生 · 花色与价格 考核试卷', total: 100, auto_total: 76, self_total: 24 };
    return [
      Object.assign({}, base, { id: 'r1', examinee: '张依诺', score: 92, auto_score: 72, self_score: 20, duration_sec: 738, detail: mkDetail(), created_at: today.toISOString() }),
      Object.assign({}, base, { id: 'r2', examinee: '李思思', score: 64, auto_score: 52, self_score: 12, duration_sec: 1195, detail: mkDetail(), created_at: new Date(today.getTime() - 2400e3).toISOString() }),
      Object.assign({}, base, { id: 'r3', examinee: '王雨欣', score: 84, auto_score: 68, self_score: 16, duration_sec: 902, detail: mkDetail(), created_at: new Date(today.getTime() - 5400e3).toISOString() }),
      Object.assign({}, base, { id: 'r4', examinee: '陈小满', score: 76, auto_score: 60, self_score: 16, duration_sec: 1104, detail: mkDetail(), created_at: yest.toISOString() })
    ];
  };
  const cfg = () => Object.assign({ loggedIn: true, role: 'admin', rows: [] }, readCfg());
  const mk = (result) => {
    const o = {};
    ['select', 'order', 'limit', 'eq', 'delete', 'insert'].forEach(m => { o[m] = () => o; });
    o.single = async () => result;
    o.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
    return o;
  };
  window.supabase = {
    createClient: () => ({
      auth: {
        getSession: async () => ({
          data: { session: cfg().loggedIn === false ? null : { user: { id: 'u1', email: 'ru@youhe.com', app_metadata: {} } } }
        })
      },
      from: (t) => {
        const c = cfg();
        if (t === 'profiles') return mk({ data: { role: c.role }, error: null });
        if (t === 'quiz_results') return mk({ data: c.seed ? mkRows() : (c.rows || []), error: null });
        return mk({ data: [], error: null });
      }
    })
  };
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*', '--force-device-scale-factor=2']
  });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.indexOf('cdn.jsdelivr.net') >= 0 || u.indexOf('supabase.co') >= 0 ||
        u.indexOf('vendor/supabase') >= 0 || u.indexOf('vendor/xlsx') >= 0) { req.abort().catch(() => {}); return; }
    req.continue().catch(() => {});
  });
  await page.evaluateOnNewDocument(stubSupabase);
  await page.evaluateOnNewDocument(() => { window.confirm = () => true; window.alert = () => {}; });
  await page.setViewport({ width: 1180, height: 860 });
  await page.goto('http://127.0.0.1:' + PORT + '/quiz-results.html?cfg=' +
    encodeURIComponent(JSON.stringify({ role: 'admin', seed: 1 })), { waitUntil: 'domcontentloaded' });
  await sleep(1200);

  // 1) 成绩列表
  await page.screenshot({ path: path.join(ROOT, 'outputs/preview-quiz-results-list.png') });
  console.log('✔ 列表截图');

  // 2) 答卷明细（只看错题）
  await page.evaluate(() => document.querySelector('#list .rec [data-act="detail"]').click());
  await sleep(500);
  await page.evaluate(() => {
    const c = document.getElementById('qdWrong');
    if (c) { c.checked = true; c.dispatchEvent(new Event('change')); }
  });
  await sleep(400);
  const box = await page.$('.modal-box');
  await box.screenshot({ path: path.join(ROOT, 'outputs/preview-quiz-results-detail.png') });
  console.log('✔ 明细截图');

  clearTimeout(wd);
  await browser.close();
  server.close();
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
