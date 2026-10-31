/* 客服信息页重做（客服档案 / 加班调休 两区）冒烟 + 截图
 * 断言：
 *  1) 档案表 7 列、加班调休表 6 列
 *  2) 两张表行数一致（同一份过滤结果）
 *  3) 入职日期下带「已入职 …」工龄小字
 *  4) 搜「小」两张表同时收窄
 *  5) 无 pageerror
 * 产出：outputs/smoke-staff-redesign.png
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8152;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 180000);

const PROFILES = [
  { id: 'p1', name: '小雷', real_name: '雷伟', phone: '13100000001', hire_date: '2019-03-11', position: '售前客服', group_name: 'A组', role: 'leader', status: 'active', left_at: null },
  { id: 'p2', name: '小猫', real_name: '毛晓雨', phone: '13100000002', hire_date: '2026-08-20', position: '售前客服', group_name: 'A组', role: 'staff', status: 'active', left_at: null },
  { id: 'p3', name: '七七', real_name: '戚琪', phone: '13100000003', hire_date: '2021-07-01', position: '售后客服', group_name: 'B组', role: 'staff', status: 'active', left_at: null },
  { id: 'p4', name: '苏苏', real_name: '苏漫', phone: '13100000004', hire_date: '2023-05-08', position: '售前客服', group_name: 'B组', role: 'staff', status: 'active', left_at: null },
  { id: 'p5', name: '可可', real_name: '何可', phone: '13100000005', hire_date: '2020-11-02', position: '售前客服', group_name: 'C组', role: 'staff', status: 'active', left_at: null },
  { id: 'p6', name: '莓莓', real_name: '梅婧', phone: '13100000006', hire_date: '2024-02-19', position: '售前客服', group_name: 'C组', role: 'staff', status: 'active', left_at: null },
  { id: 'p7', name: '小南', real_name: '南乔', phone: '13100000007', hire_date: '2022-09-13', position: '售前客服', group_name: '', role: 'staff', status: 'active', left_at: null },
  { id: 'p8', name: '杨茹', real_name: '杨茹', phone: '13100000008', hire_date: '2021-04-06', position: '客服主管', group_name: '', role: 'admin', status: 'active', left_at: null }
];
const OT = [
  { profile_id: 'p1', hours: 12.5 }, { profile_id: 'p1', hours: 6 }, { profile_id: 'p2', hours: 4 },
  { profile_id: 'p3', hours: 9 }, { profile_id: 'p4', hours: 2.5 }, { profile_id: 'p8', hours: 20 }
];
const LV = [
  { profile_id: 'p1', hours: 8 }, { profile_id: 'p3', hours: 9 }, { profile_id: 'p5', hours: 3 }
];

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = p === '/page.html' ? 'C:/temp/kefu_src/index.html'
    : path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
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
  headers: { 'Access-Control-Allow-Origin': '*', 'Content-Range': '0-0/1' }, body: JSON.stringify(o)
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
  page.on('dialog', d => d.accept());

  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url(); const m = req.method();
    if (m === 'OPTIONS' && u.includes('supabase')) {
      return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    }
    if (u.includes('/rest/v1/profiles')) return req.respond(json(PROFILES));
    if (u.includes('/rest/v1/overtime_records')) return req.respond(json(OT));
    if (u.includes('/rest/v1/compensatory_leave_records')) return req.respond(json(LV));
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.goto(`http://127.0.0.1:${PORT}/page.html`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => !!(window.supabase && typeof window.supabase.from === 'function'), { timeout: 25000, polling: 300 });
  } catch (e) {}
  await sleep(600);

  const res = await page.evaluate(async () => {
    // 强制管理员视角，让编辑/清退/明细按钮都出现
    window.isFullAdmin = () => true;
    window.canEdit = () => true;
    try { if (window.currentUser) window.currentUser.role = 'admin'; } catch (e) {}
    // 隐藏 splash & 直接显示页面
    document.querySelectorAll('.splash,.splash-screen,#splash').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const pg = document.getElementById('page-staff-info');
    pg.classList.add('active');
    const sb = document.querySelector('.sidebar'); if (sb) sb.style.display = 'none';
    const mc = document.querySelector('.main-content') || document.querySelector('main');
    if (mc) { mc.style.marginLeft = '0'; mc.style.padding = '24px 28px'; }
    await window.loadStaffInfo();
    await new Promise(r => setTimeout(r, 400));

    const archTh = document.querySelectorAll('#staff-tbody')[0].closest('table').querySelectorAll('thead th');
    const otTable = document.getElementById('ot-tbody').closest('table');
    const otTh = otTable.querySelectorAll('thead th');
    const archRows = document.querySelectorAll('#staff-tbody tr');
    const otRows = document.querySelectorAll('#ot-tbody tr');
    const tenure = document.querySelector('#staff-tbody .tenure');
    const openOT = (id) => { try { openOTDrawer(id); } catch (e) { return { err: e.message }; } return { shown: document.getElementById('ot-drawer').classList.contains('show') }; };
    const r1 = openOT('p1');
    const drawerTxt = (document.getElementById('ot-drawer-summary') || {}).innerText || '';
    closeOTDrawer();

    // 搜索联动
    const inp = document.getElementById('staff-search');
    inp.value = '小'; filterStaff();
    const fArch = document.querySelectorAll('#staff-tbody tr').length;
    const fOt = document.querySelectorAll('#ot-tbody tr').length;
    inp.value = ''; filterStaff();

    return {
      archCols: archTh.length, otCols: otTh.length,
      archRows: archRows.length, otRows: otRows.length,
      tenure: tenure ? tenure.textContent.trim() : null,
      archHeaders: Array.from(archTh).map(t => t.textContent.trim()),
      otHeaders: Array.from(otTh).map(t => t.textContent.trim()),
      drawer: r1, drawerSummary: drawerTxt.replace(/\s+/g, ' ').trim(),
      searchArch: fArch, searchOt: fOt,
      count: (document.getElementById('staff-count') || {}).textContent
    };
  });

  await sleep(300);
  await page.screenshot({ path: path.join(ROOT, 'outputs/smoke-staff-redesign.png'), fullPage: true });

  const cleanErrs = errs.filter(e => !/supabase/i.test(e));
  const checks = {
    arch_cols_7: res.archCols === 7,
    ot_cols_6: res.otCols === 6,
    rows_equal_8: res.archRows === 8 && res.otRows === 8,
    tenure_shown: !!res.tenure && res.tenure.indexOf('已入职') === 0,
    ot_drawer_opens: res.drawer.shown === true,
    search_sync: res.searchArch === res.searchOt && res.searchArch > 0 && res.searchArch < 8,
    no_page_errors: cleanErrs.length === 0
  };

  fs.writeFileSync(path.join(ROOT, 'outputs/smoke-staff-redesign.out'), JSON.stringify({ res, checks, errs: cleanErrs }, null, 2), 'utf8');
  console.log(JSON.stringify({ res, checks, errs: cleanErrs }, null, 2));
  const ok = Object.keys(checks).every(k => checks[k]);
  console.log(ok ? 'STAFF_REDESIGN_SMOKE_PASS' : 'STAFF_REDESIGN_SMOKE_FAIL');

  await browser.close();
  server.close();
  clearTimeout(wd);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
