const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8123;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(path.resolve(ROOT)) || !fs.existsSync(file)) { res.writeHead(404); res.end('404'); return; }
  const ext = path.extname(file);
  const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1200'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('nav') && document.querySelector('nav').innerText.includes('首页'), { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  // 进入培训资料 -> 资料 -> 品牌背景和定位 -> 极氧
  const result = await page.evaluate(() => {
    try {
      window.switchPage('training');
      // 设置模块为资料
      if (typeof setTrainingModule === 'function') setTrainingModule('资料');
      // 设置大类
      if (typeof setTrainingGroup === 'function') setTrainingGroup('品牌背景和定位');
      if (typeof setTrainingSubcat === 'function') setTrainingSubcat('极氧');
      return { ok: true };
    } catch (e) { return { ok: false, err: e.message }; }
  });
  await new Promise(r => setTimeout(r, 1500));

  const check = await page.evaluate(() => {
    const c = document.getElementById('training-content');
    if (!c) return { found: false };
    const parts = c.querySelectorAll('.jy-part').length;
    const partTitles = Array.from(c.querySelectorAll('.jy-part-title')).map(e => e.innerText.trim());
    const tables = c.querySelectorAll('.jy-data-table').length;
    const tips = c.querySelectorAll('.jy-tip').length;
    const cards = c.querySelectorAll('.jy-reco-card').length;
    const colors = c.querySelectorAll('.jy-data-table tbody tr').length;
    return { found: true, parts, partTitles, tables, tips, cards, colors, htmlLen: c.innerHTML.length };
  });

  console.log('RENDER RESULT:', JSON.stringify(check, null, 2));
  console.log('ERRORS:', errors.length ? JSON.stringify(errors, null, 2) : 'none');

  await browser.close();
  server.close();
})();
