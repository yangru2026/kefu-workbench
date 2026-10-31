/* 侧边栏分组重做冒烟：每组可折叠 + 菜单项卡片化
 * 场景（本地 + mock supabase，未登录访客）：
 *  1) 三个分组渲染（客服常用 15 项 / 常用资料 9 项 / 管理 3 项）
 *  2) 菜单项带卡片边框样式（border + background）
 *  3) 点组标题 → body 隐藏 + localStorage 记忆；再点 → 展开
 *  4) 刷新后折叠状态恢复
 *  5) switchPage('qc') active 高亮仍在（query 跨容器生效）
 *  6) 质检登记(qc-admin-nav)/管理板块(admin-only-nav) 隐藏逻辑不受影响
 *  7) 窄屏(≤768px)下组标题隐藏、折叠组强制展开、卡片样式还原
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const SRC = 'C:/temp/kefu_src';
const PORT = 8182;
const REF = 'icfgireprowcqwdodfqx';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 180000);

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
  await page.setViewport({ width: 1280, height: 900 });
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
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await sleep(3500);

  // 1) 分组与数量
  const s1 = await page.evaluate(() => {
    const gs = [...document.querySelectorAll('.nav-group')];
    return {
      groups: gs.length,
      names: gs.map(g => g.querySelector('.nav-group-head span').textContent),
      counts: gs.map(g => g.querySelectorAll('.nav-item').length),
      allVisible: gs.every(g => g.querySelector('.nav-group-body').style.display !== 'none')
    };
  });
  const c1 = s1.groups === 3 && s1.names.join(',') === '客服常用,常用资料,管理' && s1.counts.join(',') === '15,9,3';

  // 2) 卡片样式
  const c2 = await page.evaluate(() => {
    const it = document.querySelector('.nav-item[data-page="home"]');
    const cs = getComputedStyle(it);
    return cs.borderTopWidth === '1px' && cs.borderRadius === '10px' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
  });

  // 3) 折叠/展开 + localStorage
  await page.evaluate(() => { document.querySelector('.nav-group[data-g="docs"] .nav-group-head').click(); });
  await sleep(200);
  const fold = await page.evaluate(() => {
    const g = document.querySelector('.nav-group[data-g="docs"]');
    return { collapsed: g.classList.contains('collapsed'), hidden: getComputedStyle(g.querySelector('.nav-group-body')).display === 'none', saved: JSON.parse(localStorage.getItem('kefu_nav_groups') || '{}') };
  });
  const c3 = fold.collapsed && fold.hidden && fold.saved.docs === true;
  await page.evaluate(() => { document.querySelector('.nav-group[data-g="docs"] .nav-group-head').click(); });
  await sleep(200);
  const c3b = await page.evaluate(() => !document.querySelector('.nav-group[data-g="docs"]').classList.contains('collapsed'));

  // 4) 刷新恢复折叠状态
  await page.evaluate(() => { document.querySelector('.nav-group[data-g="admin"] .nav-group-head').click(); });
  await sleep(150);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const c4 = await page.evaluate(() => document.querySelector('.nav-group[data-g="admin"]').classList.contains('collapsed')
    && !document.querySelector('.nav-group[data-g="kefu"]').classList.contains('collapsed'));
  await page.evaluate(() => localStorage.removeItem('kefu_nav_groups'));

  // 5) switchPage 跨容器 active
  const c5 = await page.evaluate(() => { switchPage('qc'); return document.querySelector('.nav-item[data-page="qc"]').classList.contains('active') && currentPage === 'qc'; });
  await page.evaluate(() => switchPage('home'));

  // 6) 权限项隐藏
  const c6 = await page.evaluate(() => getComputedStyle(document.querySelector('.qc-admin-nav')).display === 'none'
    && getComputedStyle(document.querySelector('.admin-only-nav')).display === 'none');

  await page.screenshot({ path: ROOT + '/outputs/shot-nav-groups.png' });

  // 7) 窄屏
  await page.setViewport({ width: 480, height: 800 });
  await sleep(400);
  const c7 = await page.evaluate(() => {
    const head = document.querySelector('.nav-group-head');
    const body = document.querySelector('.nav-group[data-g="docs"] .nav-group-body');
    const item = document.querySelector('.nav-item[data-page="ai"]');   // 非 active 项（active 带绿底是正常态）
    const hidden = getComputedStyle(head).display === 'none';
    const bg = getComputedStyle(item).backgroundColor;
    return hidden && getComputedStyle(body).display !== 'none' && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent');
  });
  await page.setViewport({ width: 1280, height: 900 });

  const checks = {
    three_groups_right_counts: c1,
    items_card_style: c2,
    fold_expand_and_persist: c3 && c3b,
    fold_restored_after_reload: c4,
    switchpage_active_across_container: c5,
    permission_items_hidden: c6,
    mobile_narrow_ok: c7,
    no_page_errors: errs.length === 0
  };
  console.log(JSON.stringify({ checks, s1, errs }, null, 2));
  console.log(Object.values(checks).every(Boolean) ? 'NAV_GROUPS_SMOKE_PASS' : 'NAV_GROUPS_SMOKE_FAIL');
  await browser.close(); server.close(); clearTimeout(wd);
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
