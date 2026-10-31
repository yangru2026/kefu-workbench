/* 申请审批挪出管理板块 冒烟
 * 断言：
 *  A. 侧边栏存在客服常用组的「申请审批」入口（无 admin-only-nav）
 *  B. 普通客服（staff）switchPage('requests') 不被门禁拦截，页面正常打开
 *  C. 页面能渲染申请表单（app.js 的 renderReqForm 生效）
 *  D. loadRequests 非管理员查询带 requester_id 过滤（拦截请求检查 query 参数）
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8160;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 120000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = p === '/page.html' ? 'C:/temp/kefu_src/index.html'
    : p === '/app.js' ? 'C:/temp/kefu_src/app.js'
    : path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8'
      : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('nf'); }
});
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify([]) });
const requestsSeen = [];

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
      try { return req.respond({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/vendor/supabase.min.js', 'utf8') }); }
      catch (e) { return req.respond({ status: 404, body: 'nf' }); }
    }
    if (u.includes('/rest/v1/cs_requests')) {
      requestsSeen.push(decodeURIComponent(u));
      return req.respond(json([]));
    }
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.goto(`http://127.0.0.1:${PORT}/page.html`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => !!(window.supabase && typeof window.supabase.from === 'function'), { timeout: 25000, polling: 300 });
  } catch (e) {}
  await sleep(800);

  const A = await page.evaluate(() => {
    const nav = document.querySelector('.nav-item[data-page="requests"]');
    return {
      exists: !!nav,
      adminOnly: nav ? nav.classList.contains('admin-only-nav') : null,
      inCommonGroup: nav ? !!(nav.previousElementSibling && /restock/.test(nav.previousElementSibling.dataset.page || '')) : false,
      visible: nav ? nav.style.display !== 'none' : false
    };
  });

  // 模拟普通客服身份
  const B = await page.evaluate(async () => {
    window.__toasts = [];
    window.showToast = m => window.__toasts.push(String(m));
    // index.html 顶层是 let currentProfile（词法绑定，不在 window 上），必须直接赋值
    currentProfile = { id: 'p-staff', name: '小柚', role: 'staff', group_name: 'B组' };
    currentUser = { id: 'p-staff' };
    window.allStaffData = [{ id: 'p1', name: '小雷', real_name: '雷伟' }];
    try { switchPage('requests'); } catch (e) { return { err: e.message }; }
    await new Promise(r => setTimeout(r, 600));
    const pg = document.getElementById('page-requests');
    return {
      active: pg && pg.classList.contains('active'),
      blocked: window.__toasts.some(t => t.indexOf('仅管理员') > -1),
      formRendered: !!(document.getElementById('req-form-content') && document.getElementById('req-form-content').innerHTML.length > 20),
      navActive: !!(document.querySelector('.nav-item[data-page="requests"]') && document.querySelector('.nav-item[data-page="requests"]').classList.contains('active'))
    };
  });

  await sleep(400);
  const D = { csRequestsQueried: requestsSeen.length > 0, scoped: requestsSeen.every(u => u.indexOf('requester_id') > -1) };

  const cleanErrs = errs.filter(e => !/supabase/i.test(e));
  const checks = {
    nav_in_common_group: A.exists && !A.adminOnly && A.inCommonGroup,
    staff_page_opens: B.active === true && B.blocked === false && B.navActive === true,
    form_rendered: B.formRendered === true,
    query_scoped_to_self: D.csRequestsQueried && D.scoped,
    no_page_errors: cleanErrs.length === 0
  };
  fs.writeFileSync(path.join(ROOT, 'outputs/smoke-requests-nav.out'), JSON.stringify({ A, B, D, checks, errs: cleanErrs }, null, 2), 'utf8');
  console.log(JSON.stringify({ A, B, D, checks, errs: cleanErrs }, null, 2));
  const ok = Object.keys(checks).every(k => checks[k]);
  console.log(ok ? 'REQUESTS_NAV_SMOKE_PASS' : 'REQUESTS_NAV_SMOKE_FAIL');

  await browser.close();
  server.close();
  clearTimeout(wd);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
