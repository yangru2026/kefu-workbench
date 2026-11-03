/**
 * restock.html（补货情况）冒烟 + 截图（2026-11-03 两分类版）
 * 场景A 管理员：两个分组渲染、条数正确、可登记、生成图片出 dataURL
 * 场景B 客服：只读、无登记按钮、也能生成图片
 * 产出：outputs/shot-restock-admin.png / shot-restock-staff.png / shot-restock-poster.png
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8177;
const REF = 'icfgireprowcqwdodfqx';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 120000);

const ROWS = [
  { id: 1, toss: '半年抛', name: '我喜欢你', status: 'restocking', eta_date: '11.7左右', note: null, updated_at: '2026-11-03T01:00:00Z' },
  { id: 2, toss: '半年抛', name: '汪汪队', status: 'restocking', eta_date: '11.7左右', note: null, updated_at: '2026-11-03T01:00:00Z' },
  { id: 3, toss: '半年抛', name: '少女心事', status: 'restocking', eta_date: '11.13左右', note: null, updated_at: '2026-11-03T01:00:00Z' },
  { id: 4, toss: '半年抛', name: '黑莓缪斯', status: 'restocking', eta_date: '11.11左右', note: null, updated_at: '2026-11-03T01:00:00Z' },
  { id: 5, toss: '日抛', name: '校花指南6片装', status: 'restocking', eta_date: '12.10左右', note: null, updated_at: '2026-11-03T01:00:00Z' },
  { id: 6, toss: '日抛', name: '小黑环pro6片装', status: 'restocking', eta_date: '11.5左右', note: null, updated_at: '2026-11-03T01:00:00Z' },
  { id: 7, toss: '半年抛', name: '窗外樱花', status: 'no', eta_date: null, note: null, updated_at: '2026-11-03T01:00:00Z' },
  { id: 8, toss: '日抛', name: '冰葡萄6片装', status: 'no', eta_date: null, note: null, updated_at: '2026-11-03T01:00:00Z' }
];

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime }); res.end(data);
  } catch (e) { res.writeHead(404); res.end('nf'); }
});
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });

async function run(browser, role, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 920, deviceScaleFactor: 1.5 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
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
    if (u.includes('/rest/v1/profiles')) return req.respond(json({ id: 'u1', name, role }));
    if (u.includes('/rest/v1/restock_items')) {
      if (m === 'POST') { let b = ''; req.on('data', c => b += c); req.on('end', () => { posts.push(b); req.respond(json([])); }); return; }
      return req.respond(json(ROWS));
    }
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.evaluateOnNewDocument((ref, userRole) => {
    const session = {
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
      user: { id: 'u1', email: 'u@workbench.test', app_metadata: { role: userRole }, user_metadata: {} }
    };
    localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify(session));
  }, REF, role);

  const posts = [];
  await page.goto('http://127.0.0.1:' + PORT + '/restock.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);

  const st = await page.evaluate(() => ({
    badge: document.getElementById('roleBadge').textContent,
    cntWait: document.getElementById('cntWait').textContent,
    cntNo: document.getElementById('cntNo').textContent,
    waitCards: document.querySelectorAll('#gridWait .item').length,
    noCards: document.querySelectorAll('#gridNo .item').length,
    hasDone: !!document.getElementById('secDone'),
    hasAdd: document.getElementById('btnAdd').style.display !== 'none',
    firstWait: (document.querySelector('#gridWait .item .name') || {}).textContent || '',
    firstDate: (document.querySelector('#gridWait .item .date') || {}).textContent || ''
  }));

  // 生成图片
  let poster = { dataLen: 0 };
  try {
    poster = await Promise.race([
      page.evaluate(() => {
        document.getElementById('btnPoster').click();
        const img = document.getElementById('posterImg');
        const maskShow = document.getElementById('posterMask').classList.contains('show');
        return { dataLen: (img.src || '').length, isPng: /^data:image\/png/.test(img.src), maskShow };
      }),
      new Promise(r => setTimeout(() => r({ timeout: true }), 10000))
    ]);
  } catch (e) { poster = { err: String(e) }; }

  const shotName = role === 'admin' ? 'shot-restock-admin.png' : 'shot-restock-staff.png';
  await page.screenshot({ path: 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/' + shotName });

  let posterShot = null;
  if (role === 'admin' && poster.isPng) {
    posterShot = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/shot-restock-poster.png';
    const el = await page.$('#posterMask .modal');
    if (el) await el.screenshot({ path: posterShot });
  }

  await page.close();
  return { st, poster, errs, posts, shotName, posterShot };
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const out = { assertions: [] };
  const ok = (n, c, x) => out.assertions.push({ name: n, pass: !!c, extra: x || '' });
  try {
    const admin = await run(browser, 'admin', '杨茹');
    const staff = await run(browser, 'staff', '小柚');

    ok('管理员：两分组渲染（补货中6/不补2）', admin.st.waitCards === 6 && admin.st.noCards === 2, JSON.stringify(admin.st));
    ok('管理员：条数徽标正确', admin.st.cntWait === '6 款' && admin.st.cntNo === '2 款');
    ok('旧「已入库」分组已移除', admin.st.hasDone === false);
    ok('管理员：显示登记按钮', admin.st.hasAdd === true);
    ok('补货中卡带预计时间（按到货时间排序，最早 11.5 在前）', /预计 11\.5左右/.test(admin.st.firstDate || ''), admin.st.firstDate);
    ok('客服：只读（无登记按钮）', staff.st.hasAdd === false);
    ok('客服：数据一致', staff.st.waitCards === 6 && staff.st.noCards === 2);
    ok('生成图片：弹出预览且是 PNG', admin.poster.isPng === true && admin.poster.maskShow === true, JSON.stringify(admin.poster));
    ok('生成图片：内容非空', (admin.poster.dataLen || 0) > 20000, 'len=' + admin.poster.dataLen);
    ok('客服也能生成图片', staff.poster.isPng === true);
    ok('管理员视角无页面异常', admin.errs.length === 0, admin.errs.slice(0, 2).join('|'));
    ok('客服视角无页面异常', staff.errs.length === 0, staff.errs.slice(0, 2).join('|'));
    out.shots = [admin.shotName, staff.shotName, admin.posterShot];
  } catch (e) {
    out.fatal = String(e && e.stack || e);
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  clearTimeout(wd);
  const pass = out.assertions.filter(a => a.pass).length;
  const fail = out.assertions.filter(a => !a.pass);
  console.log('=== restock 冒烟 ===');
  out.assertions.forEach(a => console.log((a.pass ? 'PASS ' : 'FAIL ') + a.name + (a.extra && !a.pass ? '  [' + a.extra + ']' : '')));
  console.log('--- ' + pass + ' / ' + out.assertions.length + ' 通过');
  if (out.fatal) console.log('FATAL: ' + out.fatal);
  process.exit(fail.length ? 1 : 0);
})();
