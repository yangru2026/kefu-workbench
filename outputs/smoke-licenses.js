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

  // 3) 切换到培训资料页
  await page.evaluate(() => window.switchPage('training'));
  await new Promise(r => setTimeout(r, 3000));

  // 3.1) 验证资料模块：第二行为培训资料大类，不含售前话术
  const trainPage = await page.evaluate(() => {
    const moduleTabs = document.getElementById('training-module-tabs');
    const tabs = document.getElementById('training-group-tabs');
    return {
      hasModuleTabs: !!(moduleTabs && moduleTabs.innerText.includes('培训资料') && moduleTabs.innerText.includes('售前话术')),
      tabsHtml: tabs ? tabs.innerText.slice(0, 200) : 'N/A'
    };
  });
  console.log('[培训页模块Tab]', trainPage.hasModuleTabs);
  console.log('[培训页资料大类]', trainPage.tabsHtml.replace(/\n/g, ' | '));

  // 3.2) 切换到售前话术模块，验证分组 Tab
  const scriptPage = await page.evaluate(() => {
    setTrainingModule('话术');
    const tabs = document.getElementById('training-group-tabs');
    return {
      tabsHtml: tabs ? tabs.innerText.slice(0, 120) : 'N/A',
      hasAll: tabs ? tabs.innerText.includes('全部') : false,
      hasJiYang: tabs ? tabs.innerText.includes('极氧') : false
    };
  });
  console.log('[培训页话术分组]', scriptPage.tabsHtml.replace(/\n/g, ' | '));

  // 3.3) 验证售前话术「通用」分组三级小类 Tab
  const subcatCheck = await page.evaluate(() => {
    trainingCategories = [
      { id: 'g-sh', name: '售前话术', sort_order: 500, parent_id: '' },
      { id: 's1', name: '商品问题', sort_order: 10, parent_id: '售前话术-通用' },
      { id: 's2', name: '活动优惠问题', sort_order: 20, parent_id: '售前话术-通用' },
      { id: 's3', name: '订单操作问题', sort_order: 30, parent_id: '售前话术-通用' },
      { id: 's4', name: '催单催付', sort_order: 40, parent_id: '售前话术-通用' },
      { id: 's5', name: '发货快递', sort_order: 50, parent_id: '售前话术-通用' },
      { id: 's6', name: '售后保障（售前咨询售后规则）', sort_order: 60, parent_id: '售前话术-通用' },
      { id: 's7', name: '权限规则问题', sort_order: 70, parent_id: '售前话术-通用' },
      { id: 's8', name: '比价竞品问题', sort_order: 80, parent_id: '售前话术-通用' },
      { id: 's9', name: '使用风险禁忌咨询', sort_order: 90, parent_id: '售前话术-通用' },
      { id: 's10', name: '客户情绪与聊天互动', sort_order: 100, parent_id: '售前话术-通用' },
      { id: 's11', name: '售前前置投诉顾虑', sort_order: 110, parent_id: '售前话术-通用' },
      { id: 's12', name: '商务合作咨询', sort_order: 120, parent_id: '售前话术-通用' }
    ];
    setTrainingScriptGroup('通用');
    const el = document.getElementById('training-subcat-tabs');
    const html = el ? el.innerHTML : '';
    return {
      visible: el && el.style.display !== 'none',
      hasAll: html.includes('全部'),
      hasSub1: html.includes('商品问题'),
      hasSub12: html.includes('商务合作咨询'),
      count: (html.match(/training-script-subcat-tab/g) || []).length
    };
  });
  console.log('[培训页三级小类]', JSON.stringify(subcatCheck));

  // 3.4) 验证极氧品牌定位页面内直接展示
  const jiyangCheck = await page.evaluate(() => {
    setTrainingModule('资料');
    setTrainingGroup('品牌背景和定位');
    setTrainingSubcat('极氧');
    const content = document.getElementById('training-content');
    const text = content ? content.innerText : '';
    const hasInlinePage = content && content.querySelector('.jy-page-container');
    return {
      inlinePage: !!hasInlinePage,
      hasHeader: text.includes('极氧品牌介绍'),
      hasBrandPosition: text.includes('中高端硅水凝胶日抛'),
      hasCompareTable: text.includes('晨露系列') && text.includes('森氧系列'),
      hasMorningSeries: text.includes('樱花半夏'),
      hasForestSeries: text.includes('梦蝶晚意'),
      hasTip: text.includes('戴8小时以上')
    };
  });
  console.log('[极氧品牌定位详情]', JSON.stringify(jiyangCheck));

  // 4) 回到首页，验证店铺分组表
  await page.evaluate(() => window.switchPage('home'));
  await new Promise(r => setTimeout(r, 1000));
  const homeShopGroup = await page.evaluate(() => {
    const table = document.querySelector('.shop-group-table');
    const text = table ? table.innerText : '';
    return {
      hasTable: !!table,
      hasGroupA: text.includes('抖音1店') && text.includes('天猫极氧'),
      hasGroupB: text.includes('拼多多1店') && text.includes('小红书MS'),
      hasGroupC: text.includes('抖音2店') && text.includes('抖音4店')
    };
  });
  console.log('[首页店铺分组]', JSON.stringify(homeShopGroup));

  console.log('\n===== 冒烟结果 =====');
  console.log(errors.length === 0 ? '✅ 无任何 JS 错误' : '❌ ' + errors.length + ' 个错误:');
  errors.slice(0, 10).forEach(e => console.log('  ' + e));

  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('冒烟异常:', e); process.exit(1); });
