/* 组长质检登记提醒（dutyRemind）冒烟
 * 规则：组长按当日班次弹「今日质检登记提醒」；早班 16:00-16:30、中班 20:30-21:00；
 * 晚班/休/调/无班次不提醒；普通客服与管理员不弹；每天（sessionStorage）只弹一次；
 * 质检待确认弹窗（qcGate）显示时 duty 让位，qcGate 关闭后补弹。
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const SRC = 'C:/temp/kefu_src';
const PORT = 8178;
const REF = 'icfgireprowcqwdodfqx';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 180000);

const LEADER = { id: 'p1', name: '小队长', role: 'leader', phone: '', status: 'active', group_name: 'A组' };
const STAFF  = { id: 'p2', name: '小柚', role: 'staff', phone: '', status: 'active', group_name: 'A组' };
const PENDING = [
  { id: 'recA', qc_date: '2026-10-30', issue_type: '响应时效', severity: '严重需整改', detail: '首响超时', guidance: '30 秒内首响', evidence: null, staff_confirmed_at: null }
];
let role = 'leader';            // 当前登录角色
let todayShift = '早';          // schedule_data 当天班次
let qcPendingMode = false;      // true = qc_records 有未确认（qcGate 会弹）

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
      if (nm === '小队长') return req.respond(json({ schedule: { [String(new Date().getDate())]: todayShift } }));
      return req.respond(json(null));
    }
    if (u.includes('/rest/v1/qc_records')) {
      if (qcPendingMode && /staff_confirmed_at=is\.null/.test(u)) return req.respond(json(PENDING));
      return req.respond(json([]));
    }
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
  }, REF);

  const dutyVisible = () => page.evaluate(() => {
    const el = document.getElementById('duty-remind-modal');
    return !!el && el.style.display === 'flex';
  });
  const dutyText = () => page.evaluate(() => (document.getElementById('duty-remind-modal') || {}).innerText || '');
  const gateVisible = () => page.evaluate(() => {
    const el = document.getElementById('qc-gate-modal');
    return !!el && el.style.display === 'flex';
  });
  const rearm = () => page.evaluate(() => {
    dutyRemindDone = false;
    Object.keys(sessionStorage).filter(k => k.startsWith('dutyRemind_')).forEach(k => sessionStorage.removeItem(k));
  });

  // ── 场景 1：组长 + 早班 → 登录后弹提醒 ──
  qcPendingMode = false; todayShift = '早';
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const s1 = { shown: await dutyVisible() };
  s1.text = await dutyText();
  s1.early_ok = /早班/.test(s1.text) && /16:00 – 16:30/.test(s1.text) && /可调休/.test(s1.text);
  s1.has_register_btn = /去登记质检/.test(s1.text);
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (/我知道了/.test(b.innerText) && !b.closest('#duty-remind-modal')) b.click(); });
  });
  await sleep(600);
  await page.evaluate(() => { dutyRemindClose(); renderDutyRemind(DUTY_SHIFT_TEXT['早']); });
  await sleep(300);
  await page.screenshot({ path: ROOT + '/outputs/shot-duty-remind.png' });

  // ── 场景 2：点「去登记质检」→ 打开飞书登记表 + 弹窗关闭 ──
  await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(String(u)); return null; }; });
  await page.evaluate(() => dutyRemindGo());
  await sleep(300);
  const s2 = await page.evaluate(() => ({ opened: (window.__opened || [])[0] || '', closed: (document.getElementById('duty-remind-modal') || {}).style.display === 'none' }));

  // ── 场景 3：晚班 → 不弹（重置后手动触发） ──
  todayShift = '晚';
  await rearm();
  await page.evaluate(() => dutyRemindCheck());
  await sleep(400);
  const s3_notShown = !(await dutyVisible());

  // ── 场景 4：中班 → 弹，时段 20:30 – 21:00 ──
  todayShift = '中';
  await rearm();
  await page.evaluate(() => dutyRemindCheck());
  await sleep(400);
  const s4 = { shown: await dutyVisible(), mid_ok: /中班/.test(await dutyText()) && /20:30 – 21:00/.test(await dutyText()) };

  // ── 场景 5：普通客服 → 不弹（页面内 currentProfile 同步改为 staff） ──
  role = 'staff';
  await page.evaluate(() => dutyRemindClose());
  await rearm();
  await page.evaluate(() => { currentProfile = Object.assign({}, currentProfile, { name: '小柚', role: 'staff' }); });
  await page.evaluate(() => dutyRemindCheck());
  await sleep(400);
  const s5_notShown = !(await dutyVisible());
  role = 'leader'; todayShift = '早';

  // ── 场景 6：qcGate 有待确认 → duty 让位；qcGate 关闭后补弹 ──
  qcPendingMode = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(4500);
  const s6 = { gate_first: await gateVisible(), duty_hidden_while_gate: !(await dutyVisible()) };
  await page.evaluate(() => {
    Object.keys(sessionStorage).filter(k => k.startsWith('dutyRemind_')).forEach(k => sessionStorage.removeItem(k));
    window.open = u => null; qcGateGoPage();
  });
  await sleep(1600);
  s6.duty_after_gate_close = await dutyVisible();
  s6.gate_closed = !(await gateVisible());

  const checks = {
    leader_early_shift_popup: s1.shown === true && s1.early_ok === true,
    has_register_btn: s1.has_register_btn === true,
    register_opens_feishu: s2.opened.includes('feishu') && s2.closed === true,
    night_shift_no_popup: s3_notShown === true,
    mid_shift_popup_slot: s4.shown === true && s4.mid_ok === true,
    staff_no_popup: s5_notShown === true,
    duty_yields_to_qcGate: s6.gate_first === true && s6.duty_hidden_while_gate === true,
    duty_after_gate_close: s6.duty_after_gate_close === true && s6.gate_closed === true,
    no_page_errors: errs.length === 0
  };
  console.log(JSON.stringify({ checks, errs, s1: s1.text }, null, 2));
  console.log(Object.values(checks).every(Boolean) ? 'DUTY_REMIND_SMOKE_PASS' : 'DUTY_REMIND_SMOKE_FAIL');
  await browser.close(); server.close(); clearTimeout(wd);
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
