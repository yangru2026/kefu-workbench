/* 冒烟测试：侧边栏改造 + 查验证明页面切换 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8101;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(path.resolve(ROOT)) || !fs.existsSync(file)) { res.writeHead(404); res.end('404'); return; }
  const ext = path.extname(file);
  const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('requestfailed', r => { if (r.url().includes('supabase.co')) errors.push('REQFAIL: ' + r.url().slice(0, 100)); });

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // 等待页面主体就绪
  await page.waitForFunction(() => {
    const nav = document.querySelector('nav');
    return nav && nav.innerText.includes('首页');
  }, { timeout: 20000 }).catch(async () => {
    console.log('[warn] nav 未就绪，诊断：', await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      bodyLen: (document.body ? document.body.innerHTML.length : -1),
      bodyHead: (document.body ? document.body.innerHTML.slice(0, 200) : 'NO BODY')
    })));
  });
  await new Promise(r => setTimeout(r, 3000));

  // 1) 菜单结构检查
  const menu = await page.evaluate(() => {
    const navText = document.querySelector('nav').innerText;
    return {
      hasChangYong: navText.includes('常用资料'),
      hasYanCha: navText.includes('查验证明'),
      hasPeiXun: navText.includes('培训资料'),
      hasMeiRiSuBao: navText.includes('每日速报'),
      licItem: !!document.querySelector('.nav-item[data-page="licenses"]'),
      trainingItem: !!document.querySelector('.nav-item[data-page="training"]'),
      bulletinItem: !!document.querySelector('.nav-item[data-page="bulletin"]')
    };
  });
  console.log('[菜单]', JSON.stringify(menu));

  // 2) 切换到查验证明页
  await page.evaluate(() => window.switchPage('licenses'));
  await new Promise(r => setTimeout(r, 3000));
  const licPage = await page.evaluate(() => {
    const el = document.getElementById('page-licenses');
    return {
      active: el ? el.classList.contains('active') : false,
      hasContent: !!document.getElementById('lic-content'),
      hasFilters: !!document.getElementById('lic-platform')
    };
  });
  console.log('[查验证明页]', JSON.stringify(licPage));

  // 3) 切换到培训资料页（操作类顶级 tab 逻辑）
  await page.evaluate(() => window.switchPage('training'));
  await new Promise(r => setTimeout(r, 3000));
  const trainPage = await page.evaluate(() => {
    const tabs = document.getElementById('training-group-tabs');
    return { tabsHtml: tabs ? tabs.innerText.slice(0, 120) : 'N/A' };
  });
  console.log('[培训页 Tab]', trainPage.tabsHtml.replace(/\n/g, ' | '));

  // 4) 回到首页
  await page.evaluate(() => window.switchPage('home'));
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n===== 冒烟结果 =====');
  console.log(errors.length === 0 ? '✅ 无任何 JS 错误' : '❌ ' + errors.length + ' 个错误:');
  errors.slice(0, 10).forEach(e => console.log('  ' + e));

  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('冒烟异常:', e); process.exit(1); });
