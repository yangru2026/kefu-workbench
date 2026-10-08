/* 成员管理「改组别 / 改角色」链路 —— 幂等 + 真落库校验 冒烟
 * 场景A：原本有组、输入框清空，用户点「取消」→ 不发 PATCH、输入框立刻回显原组
 * 场景B：原本有组、清空后点「确定」→ 发 PATCH 把 group_name 置为 null
 * 场景C：正常改组 A组 → C组，PATCH 回传 1 行 → 提示「已更新」
 * 场景D：更新被权限挡掉（PATCH 回传 0 行且无 error）→ 必须提示「❌ 没改上」，不得假报「已更新」
 * 场景E：改组后重新 loadMembers（服务端真值仍 A组）→ 界面必须回显服务端真值，不能停留在假成功值
 * 用法：/old.html = 修前版本，/new.html = 修后版本。修前应 FAIL、修后应 PASS。
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8146;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 180000);

let patchMode = 'ok';       // 'ok' | 'empty'
let patchCalls = [];        // 记录每笔 PATCH 的 body

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  let file;
  if (p === '/old.html') file = 'C:/temp/kefu_old_index.html';
  else if (p === '/new.html') file = 'C:/temp/kefu_src/index.html';
  else file = path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8'
      : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('nf'); }
});
const json = o => ({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o)
});

/* 只在页内种子数据 + 桩掉 loadMembers（避免真去查库）；renderMembers 用页面自己的 */
const SEED_FN = () => {
  window.__serverGroup = 'A组';
  window.currentUser = { id: 'ADMIN-1' };
  window.currentProfile = { id: 'ADMIN-1', role: 'admin' };
  window.membersData = [{
    id: 'M-1', name: '小柚', real_name: '杨茹', phone: '13100000000',
    role: 'staff', group_name: 'A组', status: 'active', left_at: null, created_at: '2026-09-24'
  }];
  window.loadMembers = async function () {
    window.membersData = [{
      id: 'M-1', name: '小柚', real_name: '杨茹', phone: '13100000000',
      role: 'staff', group_name: window.__serverGroup, status: 'active', left_at: null, created_at: '2026-09-24'
    }];
    window.renderMembers();
  };
  window.__toasts = [];
  window.showToast = function (msg) { window.__toasts.push(String(msg)); };
  window.renderMembers();
};

/* 取组别输入框：onchange 里带 updateMemberGroup 的那个 */
const GROUP_SEL = () => {
  const list = document.querySelectorAll('input[data-id="M-1"]');
  for (const el of list) {
    if ((el.getAttribute('onchange') || '').indexOf('updateMemberGroup') > -1) return el;
  }
  return list.length ? list[list.length - 1] : null;
};

async function run(browser, route) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
  page.on('dialog', d => d.accept());
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    const m = req.method();
    if (m === 'OPTIONS' && u.includes('supabase')) {
      return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    }
    if (u.includes('/rest/v1/')) {
      if (m === 'PATCH' || m === 'POST') {
        patchCalls.push(req.postData() || '');
        return req.respond(json(patchMode === 'empty' ? [] : [{ id: 'M-1' }]));
      }
      return req.respond(json([]));
    }
    if (u.includes('/auth/v1/')) return req.respond(json({ user: { id: 'ADMIN-1' }, session: null }));
    req.continue();
  });

  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'domcontentloaded' });

  let libOk = false;
  try {
    await page.waitForFunction(
      () => { try { return !!(window.supabase && typeof window.supabase.from === 'function'); } catch (e) { return false; } },
      { timeout: 25000, polling: 300 });
    libOk = true;
  } catch (e) { /* libOk 保持 false */ }
  await sleep(500);

  await page.evaluate(SEED_FN);
  await sleep(200);

  /* 设值并派发 change（页面用的是 onchange） */
  const setGroup = (v) => page.evaluate((val) => {
    window.__toasts = [];
    window.__patchCalls = 0;
    const list = document.querySelectorAll('input[data-id="M-1"]');
    let inp = null;
    for (const el of list) {
      if ((el.getAttribute('onchange') || '').indexOf('updateMemberGroup') > -1) { inp = el; break; }
    }
    if (!inp && list.length) inp = list[list.length - 1];
    if (!inp) return { err: 'no-input', count: list.length };
    inp.value = val;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, attr: inp.getAttribute('onchange'), count: list.length };
  }, v);
  const readGroup = () => page.evaluate(() => {
    const g = (function () {
      const list = document.querySelectorAll('input[data-id="M-1"]');
      for (const el of list) {
        if ((el.getAttribute('onchange') || '').indexOf('updateMemberGroup') > -1) return el;
      }
      return list.length ? list[list.length - 1] : null;
    })();
    return { value: g ? g.value : null, toasts: window.__toasts.slice(), panelOpen: !!(document.getElementById('page-members') || {}).classList };
  });

  // ── A：清空 + 取消（confirm=false）→ 不发请求、回显原值
  patchCalls = [];
  await page.evaluate(() => { window.confirm = function () { return false; }; });
  const probeA = await setGroup('');
  await sleep(700);
  const sA = await readGroup();
  const aCalls = patchCalls.slice();

  // ── B：清空 + 确定（confirm=true）→ 发 PATCH 置 null
  patchCalls = [];
  await page.evaluate(() => { window.confirm = function () { return true; }; });
  await setGroup('');
  await sleep(700);
  const sB = await readGroup();
  const bCalls = patchCalls.slice();

  // ── C：正常改组 A组 → C组
  patchMode = 'ok';
  patchCalls = [];
  await setGroup('C组');
  await sleep(700);
  const sC = await readGroup();
  const cCalls = patchCalls.slice();

  // ── D：被权限挡掉（0 行、无 error）→ 必须提示"没改上"
  patchMode = 'empty';
  patchCalls = [];
  await setGroup('D组');
  await sleep(900);
  const sD = await readGroup();
  const dCalls = patchCalls.slice();

  // ── E：重新 loadMembers（服务端真值 A组）→ 必须回显 A组
  patchMode = 'ok';
  await page.evaluate(() => { window.__serverGroup = 'A组'; return window.loadMembers(); });
  await sleep(500);
  const sE = await readGroup();

  // ── F：改角色（走同一个 updateMember）→ 被挡时也必须报错
  patchMode = 'empty';
  patchCalls = [];
  await page.evaluate(() => { window.__toasts = []; });
  const fAttr = await page.evaluate(() => {
    const sel = document.querySelector('select[data-id="M-1"]');
    if (!sel) return null;
    sel.value = 'leader';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return sel.getAttribute('onchange');
  });
  await sleep(900);
  const sF = await page.evaluate(() => ({ toasts: window.__toasts.slice() }));
  const fCalls = patchCalls.slice();

  await page.close();
  const cleanErrs = errs.filter(e => !/supabase/i.test(e));
  const checks = {
    inp_found: !!(probeA && probeA.ok),
    A_cancel_noRequest_keepsOld: aCalls.length === 0 && sA.value === 'A组',
    B_confirm_sendsNull: bCalls.length === 1 && /"group_name":\s*null/.test(bCalls[0]),
    C_ok_toastUpdated: sC.toasts.some(t => t.indexOf('已更新') > -1),
    D_blocked_notClaimedAsUpdated: sD.toasts.some(t => t.indexOf('没改上') > -1),
    E_afterReload_showsServerTruth: sE.value === 'A组',
    F_roleBlocked_alsoReports: fCalls.length === 1 && sF.toasts.some(t => t.indexOf('没改上') > -1),
    no_page_errors: cleanErrs.length === 0,
  };
  return {
    libOk, checks, errs: cleanErrs,
    detail: { attr: probeA && probeA.attr, sA, aCalls, sB, bCalls, sC, cCalls, sD, dCalls, sE, fAttr, sF, fCalls }
  };
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });

  const out = {};
  for (const [label, route] of [['修前(old)', '/old.html'], ['修后(new)', '/new.html']]) {
    patchCalls = []; patchMode = 'ok';
    const r = await run(browser, route);
    const passed = Object.keys(r.checks).every(k => r.checks[k]);
    out[label] = { passed, ...r };
    console.log('\n===== ' + label + ' =====');
    console.log('supabase ready:', r.libOk, '| onchange attr:', r.detail.attr);
    console.log('A 清空+取消:', JSON.stringify(r.detail.sA), '| PATCH:', r.detail.aCalls.length);
    console.log('B 清空+确定:', JSON.stringify(r.detail.sB), '| PATCH:', JSON.stringify(r.detail.bCalls));
    console.log('C 正常改组:', JSON.stringify(r.detail.sC), '| PATCH:', JSON.stringify(r.detail.cCalls));
    console.log('D 被挡(组):', JSON.stringify(r.detail.sD), '| PATCH:', JSON.stringify(r.detail.dCalls));
    console.log('E 重载回显:', JSON.stringify(r.detail.sE));
    console.log('F 被挡(角色):', JSON.stringify(r.detail.sF), '| PATCH:', JSON.stringify(r.detail.fCalls));
    console.log('checks:', JSON.stringify(r.checks));
    console.log('page errors:', r.errs.length ? r.errs.join(' | ') : 'none');
    console.log('=>', passed ? 'PASS' : 'FAIL');
  }

  const ok = out['修前(old)'].passed === false && out['修后(new)'].passed === true;
  console.log('\nSUMMARY: 修前=' + (out['修前(old)'].passed ? 'PASS' : 'FAIL')
    + ' 修后=' + (out['修后(new)'].passed ? 'PASS' : 'FAIL')
    + ' (期望 修前=FAIL / 修后=PASS)');
  console.log(ok ? 'MEMBER_GROUP_SMOKE_PASS' : 'MEMBER_GROUP_SMOKE_FAIL');

  await browser.close();
  server.close();
  clearTimeout(wd);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
