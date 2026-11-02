/* 客服视角质检页效果截图（用真实 11-01 小猫的记录做演示数据）
 * 产出：outputs/shot-qc-staff-1-list.png（列表态）、outputs/shot-qc-staff-2-open.png（展开一条+正确做法+我已知晓）
 * 用法：node outputs/shot-qc-staff-view.js
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const SRC = 'C:/temp/kefu_src';
const PORT = 8177;
const REF = 'icfgireprowcqwdodfqx';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 真实库里的 3 条（11-01 小猫，小暖登记，一般提醒，各带 1 张附件）。
   第 1 条演示「已确认」态，后 2 条待确认（真实库里均为待确认，这里加一条已确认是为了把两种状态都展示出来） */
const RECS = [
  {
    id: 'reczz28U12j5jK8d', qc_date: '2026-11-01', staff_name: '小猫', qc_name: '小暖',
    issue_type: '销售意识', severity: '一般提醒', amount: 0,
    detail: '客户问：有没有大直径一点的，这个只有日抛吗宝贝',
    guidance: '可以给买家推荐下季抛大直径的哦 比如：花漾甜梦，月光拿铁~',
    raw: {'客户ID':'tb0023529281'}, evidence: '附件×1', staff_confirmed_at: '2026-11-01T10:12:00Z',
  },
  {
    id: 'reczz28U12j5l4xk', qc_date: '2026-11-01', staff_name: '小猫', qc_name: '小暖',
    issue_type: '销售意识', severity: '一般提醒', amount: 0,
    detail: '客户问：晴空飞鸟有月抛嘛',
    guidance: '推荐季抛的：糖霜日落、椰影摇光、酒心巧克力 类似棕色的 发发上眼图',
    raw: {'客户ID':'tb0023529281'}, evidence: '附件×1', staff_confirmed_at: null,
  },
  {
    id: 'reczz28U12j5m2ze', qc_date: '2026-11-01', staff_name: '小猫', qc_name: '小暖',
    issue_type: '销售意识', severity: '一般提醒', amount: 0,
    detail: '客户问有没有棕色系日抛，客服只回了"没有"，没有推荐替代款',
    guidance: '先安抚再给方案：日抛没有棕色的话，主动推荐同色系季抛并发上眼图，报活动价留住客户',
    raw: {'客户ID':'tb0023529281'}, evidence: '附件×1', staff_confirmed_at: null,
  },
];

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = p === '/qc.html' ? SRC + '/qc-stats.html' : path.join(ROOT, decodeURIComponent(p));
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8'
      : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime }); res.end(data);
  } catch (e) { res.writeHead(404); res.end('nf'); }
});
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 2 });
  page.on('dialog', d => d.accept());

  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url(); const m = req.method();
    if (m === 'OPTIONS' && u.includes('supabase')) {
      return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    }
    if (/supabase\.min\.js/.test(u)) {
      try { return req.respond({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(ROOT + '/vendor/supabase.min.js', 'utf8') }); }
      catch (e) { return req.respond({ status: 404, body: 'nf' }); }
    }
    if (u.includes('/rest/v1/profiles')) return req.respond(json({ id: 'u-cat', name: '小猫', role: 'staff' }));
    if (u.includes('/rest/v1/qc_records')) return req.respond(json(RECS));
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.evaluateOnNewDocument((ref) => {
    const session = {
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
      user: { id: 'u-cat', aud: 'authenticated', role: 'authenticated', email: 'cat@youhu.app', app_metadata: {}, user_metadata: {} }
    };
    localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify(session));
  }, REF);

  await page.goto(`http://127.0.0.1:${PORT}/qc.html`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.screenshot({ path: ROOT + '/outputs/shot-qc-staff-1-list.png' });
  console.log('✅ shot-qc-staff-1-list.png');

  // 点开第一条待确认的「展开查看」，等 3 秒解锁「我已知晓」，截展开态
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#panel-mine .cfm-btn')]
      .filter(b => /展开查看/.test(b.textContent));
    if (!btns.length) return false;
    btns[0].click(); return true;
  });
  if (clicked) {
    await sleep(3300);
    await page.screenshot({ path: ROOT + '/outputs/shot-qc-staff-2-open.png' });
    console.log('✅ shot-qc-staff-2-open.png（展开态）');
  } else {
    console.log('⚠️ 没找到「展开查看」按钮');
  }

  await browser.close();
  server.close();
  process.exit(0);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
