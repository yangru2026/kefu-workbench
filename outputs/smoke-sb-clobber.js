/* 复现「supabase.from is not a function」覆盖事故的冒烟
 * 场景：
 *  1) 前 1.2s 内所有 supabase 库源返回 404 → 走到「全部失败」分支，启动 autoRecover
 *  2) 之后放行本地 vendor → 库就绪 → initSupabase 建立客户端
 *  3) autoRecover 下一轮 tick（2.5s/5s/7.5s...）：修复前 checkFn 只认 .createClient，
 *     会把客户端误判成"库没加载"并重注 vendor → 覆盖客户端；修复后应直接判定就绪并停机
 * 断言：
 *  A. 客户端就绪（supabase.from 是函数）
 *  B. 9 秒后客户端仍然就绪（没有被 UMD 覆盖回去）
 *  C. 手动触发 __retrySupabaseLoad 也无害
 *  D. 编辑弹窗改组别保存 → 提示「已保存」
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8156;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 180000);

const PROFILES = [
  { id: 'p1', name: '小柚', real_name: '', phone: '13100000009', hire_date: null, position: '售前客服', group_name: null, role: 'staff', status: 'active', left_at: null },
  { id: 'p2', name: '小雷', real_name: '雷伟', phone: '13100000001', hire_date: '2019-03-11', position: '售前客服', group_name: 'A组', role: 'leader', status: 'active', left_at: null }
];
const VENDOR = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/vendor/supabase.min.js';
let serveVendor = false; // 前 1.2s 关闭，之后放行

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = p === '/page.html' ? 'C:/temp/kefu_src/index.html' : path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8'
      : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
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
  const logs = [];
  page.on('console', m => { const t = m.text(); if (/supabase|自动恢复/.test(t)) logs.push(t); });
  page.on('pageerror', e => logs.push('PAGEERROR:' + e.message));
  page.on('dialog', d => d.accept());

  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url(); const m = req.method();
    if (m === 'OPTIONS' && u.includes('supabase')) {
      return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    }
    // 库脚本：前 1.2s 一律 404，模拟"网络全挂"
    if (/supabase\.min\.js/.test(u)) {
      if (!serveVendor || u.indexOf('jsdelivr') >= 0 || u.indexOf('unpkg') >= 0 || u.indexOf('npmmirror') >= 0) {
        return req.respond({ status: 404, body: 'nf' });
      }
      try { return req.respond({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(VENDOR, 'utf8') }); }
      catch (e) { return req.respond({ status: 404, body: 'nf' }); }
    }
    if (u.includes('/rest/v1/profiles')) {
      if (m === 'PATCH') return req.respond(json([{ id: 'p1' }]));
      return req.respond(json(PROFILES));
    }
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.goto(`http://127.0.0.1:${PORT}/page.html`, { waitUntil: 'domcontentloaded' });
  setTimeout(() => { serveVendor = true; }, 1200);

  // A. 等客户端就绪
  let clientReady = false;
  try {
    await page.waitForFunction(() => !!(window.supabase && typeof window.supabase.from === 'function'), { timeout: 30000, polling: 300 });
    clientReady = true;
  } catch (e) {}

  // B. 等 autoRecover 的多轮 tick（2.5s/5s/7.5s），看客户端是否被覆盖
  await sleep(9000);
  const after9s = await page.evaluate(() => ({ from: typeof (window.supabase || {}).from }));

  // C. 手动触发重试入口（若存在）也应无害
  const c = await page.evaluate(async () => {
    if (typeof window.__retrySupabaseLoad === 'function') { try { window.__retrySupabaseLoad(); } catch (e) {} }
    await new Promise(r => setTimeout(r, 1200));
    return { from: typeof (window.supabase || {}).from };
  });

  // D. 编辑弹窗保存组别
  await page.evaluate(() => {
    window.isFullAdmin = () => true;
    window.canEdit = () => true;
    try { if (window.currentUser) window.currentUser.role = 'admin'; } catch (e) {}
    window.__toasts = [];
    window.showToast = function (m) { window.__toasts.push(String(m)); };
  });
  const d = await page.evaluate(async () => {
    // 先把名单种进去（跳过整页加载链路，只验证保存链路）
    window.staffInfoData = [{ id: 'p1', name: '小柚', real_name: '', phone: '13100000009', hire_date: null, position: '售前客服', group_name: null, overtime: 0, compensatory_leave: 0, role: 'staff', status: 'active', left_at: null }];
    window.staffInfoAllData = window.staffInfoData.slice();
    try { openStaffDetail('p1'); } catch (e) { return { err: e.message }; }
    const sel = document.getElementById('sd-group');
    if (!sel) return { err: 'no modal' };
    sel.value = 'B组';
    document.getElementById('sd-save-btn').click();
    await new Promise(r => setTimeout(r, 1500));
    return { toasts: window.__toasts.slice() };
  });

  const checks = {
    A_client_ready: clientReady === true,
    B_no_clobber_after_9s: after9s.from === 'function',
    C_retry_harmless: c.from === 'function',
    D_save_group_ok: !d.err && d.toasts && d.toasts.some(t => t.indexOf('已保存') > -1)
  };
  fs.writeFileSync(path.join(ROOT, 'outputs/smoke-sb-clobber.out'), JSON.stringify({ clientReady, after9s, c, d, logs }, null, 2), 'utf8');
  console.log(JSON.stringify({ clientReady, after9s, c, d, checks }, null, 2));
  console.log('console logs:', logs.slice(0, 20).join(' || ') || 'none');
  const ok = Object.keys(checks).every(k => checks[k]);
  console.log(ok ? 'SB_CLOBBER_SMOKE_PASS' : 'SB_CLOBBER_SMOKE_FAIL');

  await browser.close();
  server.close();
  clearTimeout(wd);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
