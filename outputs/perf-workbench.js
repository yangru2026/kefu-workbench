/* 工作台首屏 & 切页性能实测（限速模拟国内访问 GitHub Pages）
 * 网络：latency 180ms / 下行 1.4Mbps（≈175KB/s，947KB 的 index.html 冷启动要 ~5.5s）
 * 输出：冷启动(无 SW 缓存) / 二次打开(SW 命中) / 空闲预热后切子页 各自耗时
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const SRC = 'C:/temp/kefu_src';
const PORT = 8168;
const REF = 'icfgireprowcqwdodfqx';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 240000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const map = { '/': SRC + '/index.html', '/index.html': SRC + '/index.html', '/app.js': SRC + '/app.js', '/sw.js': SRC + '/sw.js' };
  const file = map[p] || path.join(ROOT, decodeURIComponent(p));
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8'
      : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
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
  page.on('dialog', d => d.accept());

  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url(); const m = req.method();
    if (m === 'OPTIONS' && u.includes('supabase')) {
      return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    }
    if (u.includes('supabase.co')) {
      if (u.includes('/rest/v1/profiles')) return req.respond(json({ id: 'u1', name: '杨茹', role: 'admin' }));
      if (u.includes('/rest/v1/')) return req.respond(json([]));
      return req.respond(json({}));
    }
    req.continue();
  });

  await page.evaluateOnNewDocument((ref) => {
    const session = { access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
      user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'u1@youhu.app', app_metadata: {}, user_metadata: {} } };
    localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify(session));
  }, REF);

  const cdp = await page.target().createCDPSession();
  await cdp.send('Network.enable');
  const throttle = async () => cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 180, downloadThroughput: Math.round(1.4 * 1024 * 1024 / 8), uploadThroughput: Math.round(0.7 * 1024 * 1024 / 8)
  });

  async function measureLoad(label) {
    await throttle();
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const dcl = Date.now() - t0;
    // 等到界面可用（splash 消失 / 侧边栏可点）
    let usable = null;
    try {
      await page.waitForFunction(() => {
        const sp = document.getElementById('boot-splash');
        const hidden = !sp || sp.dataset.hidden === '1' || getComputedStyle(sp).display === 'none';
        return hidden && !!document.querySelector('.nav-item[data-page="home"]');
      }, { timeout: 60000, polling: 100 });
      usable = Date.now() - t0;
    } catch (e) { usable = null; }
    return { label, dcl, usable };
  }

  // SW 是否接管
  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.length ? 'registered' : 'none';
  }).catch(() => 'err');

  const cold = await measureLoad('cold');
  await sleep(1500);
  // 等 SW 安装 + 预热触发（空闲 2.5s + 预取）
  await sleep(7000);
  const warm = await measureLoad('warm');

  // 切页耗时：点导航 → 目标页 iframe 有内容 / 页面 active 有数据
  async function measureSwitch(pageKey, readyFn) {
    const t0 = Date.now();
    await page.evaluate(k => {
      const nav = document.querySelector('.nav-item[data-page="' + k + '"]');
      if (nav) nav.click();
    }, pageKey);
    let ok = null;
    try {
      await page.waitForFunction(readyFn, { timeout: 30000, polling: 100 });
      ok = Date.now() - t0;
    } catch (e) { ok = null; }
    return { page: pageKey, ms: ok };
  }

  const sw1 = await measureSwitch('restock', () => {
    const f = document.getElementById('restock-iframe');
    try { return f && f.contentDocument && f.contentDocument.body && f.contentDocument.body.innerText.length > 40; } catch (e) { return false; }
  });
  const sw2 = await measureSwitch('qc', () => {
    const f = document.getElementById('qc-iframe');
    try { return f && f.contentDocument && f.contentDocument.body && f.contentDocument.body.innerText.length > 40; } catch (e) { return false; }
  });
  const sw3 = await measureSwitch('ranking', () => {
    const el = document.getElementById('page-ranking');
    return el && el.classList.contains('active') && el.innerText.length > 60;
  });

  const out = { swState, cold, warm, switches: [sw1, sw2, sw3] };
  fs.writeFileSync(ROOT + '/outputs/perf-workbench.out', JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out, null, 2));

  await browser.close(); server.close(); clearTimeout(wd);
  process.exit(0);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
