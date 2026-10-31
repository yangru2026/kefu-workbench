/* pages.dev 线上验收冒烟：真实网络打开 Cloudflare Pages 部署，检查初始化与关键功能
 * 不 mock supabase（走真实后端），只看未登录状态能否正常渲染、SW 是否注册、有无 JS 异常
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const URL0 = 'https://kefu-workbench-c9x.pages.dev/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 180000);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
  page.on('dialog', d => d.accept());

  const t0 = Date.now();
  await page.goto(URL0, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const dcl = Date.now() - t0;
  await sleep(5000);

  const info = await page.evaluate(() => ({
    title: document.title,
    hasLogin: !!document.getElementById('login-screen') || /登录|账号/.test(document.body.innerText.slice(0, 400)),
    navCount: document.querySelectorAll('.nav-item').length,
    dutyModal: !!document.getElementById('duty-remind-modal'),
    qcModal: !!document.getElementById('qc-gate-modal'),
    iframeSrc: (document.getElementById('qc-iframe') || {}).dataset ? document.getElementById('qc-iframe').dataset.src : null,
    bodyLen: document.body.innerText.length
  }));

  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs.length) return 'none';
    const r = regs[0];
    return (r.active ? 'active' : (r.installing ? 'installing' : (r.waiting ? 'waiting' : 'unknown'))) + '|scope=' + r.scope;
  });

  // 子页 iframe 是否可加载（Pages 上 .html 会 308 到无扩展路径）
  const sub = await page.evaluate(async () => {
    try {
      const r = await fetch('qc-stats.html?v=20261031j');
      return { status: r.status, finalUrl: r.url, len: (await r.text()).length };
    } catch (e) { return { error: e.message }; }
  });

  await page.screenshot({ path: 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/shot-pages-dev.png' });

  const checks = {
    page_loaded: info.title.includes('尤赫'),
    nav_items_present: info.navCount >= 20,
    duty_modal_present: info.dutyModal === true,
    qc_gate_present: info.qcModal === true,
    sw_registered: /active|installing|waiting/.test(swState),
    subpage_fetch_ok: sub.status === 200 && sub.len > 10000,
    no_page_errors: errs.length === 0
  };
  console.log(JSON.stringify({ checks, info, swState, sub, dcl, errs }, null, 2));
  console.log(Object.values(checks).every(Boolean) ? 'PAGES_DEV_SMOKE_PASS' : 'PAGES_DEV_SMOKE_FAIL');
  await browser.close(); clearTimeout(wd);
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
