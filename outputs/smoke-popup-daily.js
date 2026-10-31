/* 弹窗调度器 + 日报定时提醒 冒烟（2026-10-31 续：429 打断前未跑测试）
 * 覆盖：① 多弹窗按优先级排队轮转；② 日报按班次触发（管理员/休不弹、早班到点弹、已交不弹）；③ 页面初始化无报错。 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const SRC = 'C:/temp/kefu_src';
const PORT = 8181;
const REF = 'icfgireprowcqwdodfqx';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 180000);

const LEADER = { id: 'p1', name: '小队长', role: 'leader', phone: '', status: 'active', group_name: 'A组' };
const STAFF  = { id: 'p2', name: '小柚', role: 'staff', phone: '', status: 'active', group_name: 'A组' };
let role = 'leader';

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = p === '/index.html' ? SRC + '/index.html'
    : p === '/app.js' ? SRC + '/app.js'
    : p === '/sw.js' ? ROOT + '/sw.js'
    : path.join(ROOT, p);
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime }); res.end(data);
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
    if (u.includes('/rest/v1/profiles')) return req.respond(json(role === 'leader' ? [LEADER] : [STAFF]));
    if (u.includes('/rest/v1/schedule_data')) {
      const um = decodeURIComponent(u);
      const nm = (um.match(/staff_name=eq\.([^&]+)/) || [])[1] || '';
      if (nm === '小队长') return req.respond(json({ schedule: { [String(new Date().getDate())]: '早' } }));
      return req.respond(json(null));
    }
    if (u.includes('/rest/v1/qc_records')) return req.respond(json([]));
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.evaluateOnNewDocument((ref) => {
    const session = {
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
      user: { id: 'p1', aud: 'authenticated', role: 'authenticated', email: 'p1@youhu.app', app_metadata: {}, user_metadata: {} }
    };
    localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify(session));
    // 固定“现在”为今天 16:00，越过早班 15:30 提醒点，便于验证日报到点弹窗
    const Real = Date; const d = new Real(); d.setHours(16, 0, 0, 0); const ms = d.getTime();
    Date.now = () => ms;
  }, REF);

  // 清理：直接隐藏弹窗 + 清状态（不调用 closeQcGate 等，避免它们再排程 duty/daily 定时器泄漏到后续场景）
  const reset = () => page.evaluate(() => {
    ['qc-gate-modal', 'duty-remind-modal', 'daily-remind-modal', 'sp-notice-modal'].forEach(id => {
      const el = document.getElementById(id); if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    });
    window.__popupQueue = []; window.__activePopup = null;
    window.dutyRemindDone = false;
    Object.keys(sessionStorage).filter(k => k.startsWith('dutyRemind_') || k.startsWith('dailyRemind_')).forEach(k => sessionStorage.removeItem(k));
    Object.keys(localStorage).filter(k => k.startsWith('dailyRemind_')).forEach(k => localStorage.removeItem(k));
  });

  const modalShown = id => page.evaluate(i => { const el = document.getElementById(i); return !!el && el.style.display === 'flex'; }, id);
  const dailyText = () => page.evaluate(() => (document.getElementById('daily-remind-modal') || {}).innerText || '');

  // ── S1：页面初始化无报错 ──
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await reset();
  const s1 = { init_no_error: errs.length === 0 };

  // ── S2：弹窗调度器排队轮转（在页内一次性完成，按当前活跃弹窗释放）──
  const s2 = await page.evaluate(async () => {
    window.__fired = [];
    const run = id => window.__fired.push(id);
    POPUP_RETRY.qcGate = () => { run('qcGate'); popupAcquire('qcGate', 100); };
    POPUP_RETRY.daily  = () => { run('daily');  popupAcquire('daily', 80); };
    POPUP_RETRY.duty   = () => { run('duty');   popupAcquire('duty', 60); };
    POPUP_RETRY.notice = () => { run('notice'); popupAcquire('notice', 40); };
    window.__popupQueue = []; window.__activePopup = null;
    const log = [];
    const a1 = popupAcquire('qcGate', 100);
    const a2 = popupAcquire('daily', 80);
    const a3 = popupAcquire('duty', 60);
    const a4 = popupAcquire('notice', 40);
    const afterAcquire = { a1, a2, a3, a4, active: window.__activePopup, q: window.__popupQueue.map(x => x.id) };
    popupRelease('qcGate');
    await new Promise(r => setTimeout(r, 600));
    log.push(['afterQcGate', window.__activePopup, window.__fired.slice()]);
    popupRelease(window.__activePopup);
    await new Promise(r => setTimeout(r, 600));
    log.push(['afterDaily', window.__activePopup, window.__fired.slice()]);
    popupRelease(window.__activePopup);
    await new Promise(r => setTimeout(r, 600));
    log.push(['afterDuty', window.__activePopup, window.__fired.slice()]);
    popupRelease(window.__activePopup);
    await new Promise(r => setTimeout(r, 600));
    log.push(['afterNotice', window.__activePopup, window.__fired.slice()]);
    window.__popupQueue = []; window.__activePopup = null;
    return { afterAcquire, log, fired: window.__fired.slice() };
  });

  // ── S3：管理员不弹日报 ──
  await reset();
  await page.evaluate(() => { currentProfile = { id: 'p1', name: '小队长', role: 'admin' }; });
  const s3 = await page.evaluate(async () => { await dailyRemindCheck(); return null; });
  await sleep(400);
  const s3_admin_no = !(await modalShown('daily-remind-modal'));

  // ── S4：休班不弹 ──
  await reset();
  await page.evaluate(() => { currentProfile = { id: 'p2', name: '小柚', role: 'staff' }; window.getMyTodayShift = async () => '休'; });
  await page.evaluate(async () => { await dailyRemindCheck(); });
  await sleep(400);
  const s4_off_no = !(await modalShown('daily-remind-modal'));

  // ── S5：早班 + 已过 15:30 → 弹「日报提交提醒」（正文含班次时间 8:00–16:30，不含 15:30 触发点）──
  await reset();
  await page.evaluate(() => {
    currentProfile = { id: 'p2', name: '小柚', role: 'staff' };
    window.getMyTodayShift = async () => '早';
  });
  await page.evaluate(async () => { await dailyRemindCheck(); });
  await sleep(500);
  const s5_shown = await modalShown('daily-remind-modal');
  const s5_text = await dailyText();
  const s5_ok = /日报提交提醒/.test(s5_text) && /8:00/.test(s5_text) && /去填日报/.test(s5_text);

  // ── S6：当天已交日报 → 不弹 ──
  await reset();
  await page.evaluate(() => {
    currentProfile = { id: 'p2', name: '小柚', role: 'staff' };
    window.getMyTodayShift = async () => '早';
    const ds = new Date().toISOString().slice(0, 10);
    localStorage.setItem('dailyRemind_' + ds, JSON.stringify({ done: true }));
  });
  await page.evaluate(async () => { await dailyRemindCheck(); });
  await sleep(400);
  const s6_done_no = !(await modalShown('daily-remind-modal'));

  const checks = {
    init_no_error: s1.init_no_error === true,
    popup_first_acquire_true: s2.afterAcquire.a1 === true,
    popup_queue_prio_desc: JSON.stringify(s2.afterAcquire.q) === JSON.stringify(['daily', 'duty', 'notice']),
    popup_later_false: s2.afterAcquire.a2 === false && s2.afterAcquire.a3 === false && s2.afterAcquire.a4 === false,
    popup_rotate_qc_daily: s2.log[0][1] === 'daily',
    popup_rotate_daily_duty: s2.log[1][1] === 'duty',
    popup_rotate_duty_notice: s2.log[2][1] === 'notice',
    popup_fired_in_order: JSON.stringify(s2.fired) === JSON.stringify(['daily', 'duty', 'notice']),
    daily_admin_skip: s3_admin_no === true,
    daily_off_skip: s4_off_no === true,
    daily_early_shift_shows: s5_shown === true && s5_ok === true,
    daily_done_skip: s6_done_no === true,
    no_page_errors: errs.length === 0
  };
  console.log(JSON.stringify({ checks, errs, s2_log: s2.log }, null, 2));
  console.log(Object.values(checks).every(Boolean) ? 'POPUP_DAILY_SMOKE_PASS' : 'POPUP_DAILY_SMOKE_FAIL');
  await browser.close(); server.close(); clearTimeout(wd);
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
