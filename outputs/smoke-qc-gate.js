/* 质检确认门禁（qcGate）+ 日报门禁（dailyGateReason）冒烟
 * 场景：客服小柚登录工作台
 *  1) 有 2 条未确认质检（1 条严重需整改）→ 登录即弹「质检待确认」弹窗，列出正确做法
 *  2) 点「全部已知晓」→ 调 rpc qc_confirm_staff，弹窗关闭
 *  3) dailyGateReason：确认前 reason.type==='qc'；确认后 qc 清空、customer_voice 只有 2 条 → type==='voc'
 *  4) 客户之声补到 5 条 → reason 为 null（日报放行）
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const SRC = 'C:/temp/kefu_src';
const PORT = 8172;
const REF = 'icfgireprowcqwdodfqx';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 180000);

const PROFILE = { id: 'p1', name: '小柚', role: 'staff', phone: '', status: 'active', group_name: 'A组' };
const PENDING = [
  { id: 'recA', qc_date: '2026-10-30', issue_type: '响应时效', severity: '严重需整改', detail: '首响超过 30 秒未回复', guidance: '设置首响提醒，30 秒内必须回复第一句', evidence: '附件×1', staff_confirmed_at: null },
  { id: 'recB', qc_date: '2026-10-29', issue_type: '服务意识', severity: '一般提醒', detail: '用了不确定表述', guidance: '不确定的回「我帮您查一下」', evidence: null, staff_confirmed_at: null }
];
let qcCleared = false;   // 模拟确认后 qc_records 查空
let vocCount = 2;        // 客户之声今日条数
let rpcCalls = 0;

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
    if (u.includes('/rest/v1/profiles')) return req.respond(json([PROFILE]));
    if (u.includes('/rest/v1/qc_records')) {
      if (qcCleared || !/staff_confirmed_at=is\.null/.test(u)) return req.respond(json([]));
      return req.respond(json(PENDING));
    }
    if (u.includes('/rpc/qc_confirm_staff')) {
      rpcCalls++;
      qcCleared = true;   // 模拟确认落库：之后 qc_records 查不到未确认记录
      return req.respond(json([2]));
    }
    if (u.includes('/rest/v1/customer_voice')) return req.respond(json(new Array(vocCount).fill({ id: 'v' })));
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

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);

  const modalVisible = await page.evaluate(() => {
    const el = document.getElementById('qc-gate-modal');
    return !!el && el.style.display === 'flex' && /质检待确认/.test(el.innerText) && /2 条/.test(el.innerText);
  });
  const hasGuidance = await page.evaluate(() => /正确做法/.test((document.getElementById('qc-gate-modal') || {}).innerText || ''));
  const hasSevMark = await page.evaluate(() => /严重需整改/.test((document.getElementById('qc-gate-modal') || {}).innerText || ''));
  const noCloseBtn = await page.evaluate(() => {
    const el = document.getElementById('qc-gate-modal');
    return !!el && !/✕/.test(el.innerText);
  });

  // 确认前：日报应被质检门禁拦住
  await page.screenshot({ path: ROOT + '/outputs/shot-qc-gate-modal.png' });
  const gateBefore = await page.evaluate(() => dailyGateReason().then(r => r && r.type));

  // 点「全部已知晓」
  await page.evaluate(() => qcGateConfirmAll());
  await sleep(1200);
  const closedAfter = await page.evaluate(() => {
    const el = document.getElementById('qc-gate-modal');
    return !!el && el.style.display === 'none';
  });

  // 确认后：qc 清空 → 门禁转到客户之声（2 条 < 5）
  const gateAfterQc = await page.evaluate(() => dailyGateReason().then(r => r && r.type));
  // 补满客户之声（mock 服务端改为 5 条）→ 放行
  vocCount = 5;
  const gateAfterVoc = await page.evaluate(() => dailyGateReason().then(r => r && r.type));

  const checks = {
    modal_shown_on_login: modalVisible === true,
    modal_lists_guidance: hasGuidance === true,
    modal_marks_severe: hasSevMark === true,
    modal_no_close_btn: noCloseBtn === true,
    daily_blocked_by_qc: gateBefore === 'qc',
    rpc_called: rpcCalls >= 1,
    modal_closed_after_confirm: closedAfter === true,
    daily_then_blocked_by_voc: gateAfterQc === 'voc',
    daily_open_after_voc_done: gateAfterVoc === null,
    no_page_errors: errs.length === 0
  };
  console.log(JSON.stringify({ checks, errs }, null, 2));
  console.log(Object.values(checks).every(Boolean) ? 'QC_GATE_SMOKE_PASS' : 'QC_GATE_SMOKE_FAIL');
  await browser.close(); server.close(); clearTimeout(wd);
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
