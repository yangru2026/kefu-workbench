// 质检报告「按月选择 / 上月 / 时区修复」冒烟测试
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8145;
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
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  const r = await page.evaluate(() => {
    const out = {};

    out.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    out.tzOffsetMin = -new Date().getTimezoneOffset();

    // --- qcMonthStr：必须用本地时区，不能是 UTC ---
    out.monthStr = {
      // 2026-09-01 07:30 北京时间 = 2026-08-31 23:30 UTC
      sep1Early: qcMonthStr(new Date('2026-09-01T07:30:00+08:00')),
      oct1Early: qcMonthStr(new Date('2026-10-01T00:30:00+08:00')),
      aug31Late: qcMonthStr(new Date('2026-08-31T19:00:00+08:00')),
      jan1Early: qcMonthStr(new Date('2026-01-01T03:00:00+08:00'))
    };

    // --- qcMonthBounds：各月天数 ---
    out.bounds = {
      feb2026: qcMonthBounds('2026-02'),
      feb2024: qcMonthBounds('2024-02'), // 闰年
      apr2026: qcMonthBounds('2026-04'),
      dec2026: qcMonthBounds('2026-12'),
      bad: qcMonthBounds('')
    };

    // --- qcMonthList：倒序 ---
    out.list = qcMonthList('2026-06', '2026-09');
    out.listSingle = qcMonthList('2026-08', '2026-08');

    // --- 各模式的区间 ---
    const sel = document.getElementById('qc-report-month');

    qcReportRange = 'week';
    out.week = getQcReportRange();

    qcReportRange = 'month';
    out.month = getQcReportRange();

    qcReportRange = 'lastmonth';
    out.lastmonth = getQcReportRange();

    // 手动塞月份选项再走 monthpick
    sel.innerHTML = '<option value="2026-08">2026 年 08 月</option><option value="2026-09">2026 年 09 月</option>';
    sel.value = '2026-08';
    qcReportRange = 'monthpick';
    out.monthpickAug = getQcReportRange();
    sel.value = '2026-09';
    out.monthpickSep = getQcReportRange();

    // 自定义
    document.getElementById('qc-report-start').value = '2026-08-01';
    document.getElementById('qc-report-end').value = '2026-08-31';
    qcReportRange = 'custom';
    out.custom = getQcReportRange();
    // 留空 = 全部
    document.getElementById('qc-report-start').value = '';
    document.getElementById('qc-report-end').value = '';
    out.customEmpty = getQcReportRange();

    // --- 区间提示文案 ---
    qcReportRange = 'monthpick'; sel.value = '2026-08';
    renderQcRangeHint();
    out.hintMonthPick = document.getElementById('qc-report-range-hint').textContent;
    qcReportRange = 'custom';
    renderQcRangeHint();
    out.hintAll = document.getElementById('qc-report-range-hint').textContent;

    // --- 按钮高亮联动 ---
    sel.innerHTML = '<option value="2026-08">08</option><option value="2026-09">09</option>';
    sel.value = '2026-09';
    setQcReportRange('monthpick');
    out.activeAfterPick = Array.from(document.querySelectorAll('.qc-range-btn[data-range]'))
      .filter(b => b.classList.contains('active')).map(b => b.getAttribute('data-range'));
    out.pickActive = document.querySelector('#page-qc-report .qc-month-pick').classList.contains('active');

    setQcReportRange('month');
    out.activeAfterMonth = Array.from(document.querySelectorAll('.qc-range-btn[data-range]'))
      .filter(b => b.classList.contains('active')).map(b => b.getAttribute('data-range'));
    out.pickActiveAfterMonth = document.querySelector('#page-qc-report .qc-month-pick').classList.contains('active');

    // 控件存在性
    out.hasLastMonthBtn = !!document.querySelector('.qc-range-btn[data-range="lastmonth"]');
    out.hasMonthSelect = !!document.getElementById('qc-report-month');

    return out;
  });

  console.log('=== 浏览器时区 ===');
  console.log(r.tz + '  UTC+' + (r.tzOffsetMin / 60));
  console.log('\n=== qcMonthStr（本地时区，修复前用 toISOString 会错） ===');
  console.log(JSON.stringify(r.monthStr));
  console.log('\n=== qcMonthBounds ===');
  console.log(JSON.stringify(r.bounds));
  console.log('\n=== qcMonthList ===');
  console.log(JSON.stringify(r.list) + '  单月: ' + JSON.stringify(r.listSingle));
  console.log('\n=== 各模式区间 ===');
  ['week', 'month', 'lastmonth', 'monthpickAug', 'monthpickSep', 'custom', 'customEmpty'].forEach(k => {
    console.log('  ' + k.padEnd(14) + JSON.stringify(r[k]));
  });
  console.log('\n=== 区间提示 ===');
  console.log('  按月: ' + r.hintMonthPick + '   留空: ' + r.hintAll);
  console.log('\n=== 按钮联动 ===');
  console.log('  选月份后高亮按钮: ' + JSON.stringify(r.activeAfterPick) + '  下拉高亮=' + r.pickActive);
  console.log('  点本月后高亮按钮: ' + JSON.stringify(r.activeAfterMonth) + '  下拉高亮=' + r.pickActiveAfterMonth);

  let pass = 0, fail = 0;
  const chk = (cond, msg) => { if (cond) { pass++; console.log('  PASS  ' + msg); } else { fail++; console.log('  FAIL  ' + msg); } };
  console.log('\n=== 断言 ===');

  chk(r.tzOffsetMin === 480, '浏览器时区为 UTC+8（' + r.tz + '）');

  // 时区修复
  chk(r.monthStr.sep1Early === '2026-09', '时区修复：9/1 07:30 北京时间 → 2026-09（修复前会算成 2026-08）');
  chk(r.monthStr.oct1Early === '2026-10', '时区修复：10/1 00:30 北京时间 → 2026-10');
  chk(r.monthStr.aug31Late === '2026-08', '8/31 19:00 仍为 2026-08');
  chk(r.monthStr.jan1Early === '2026-01', '跨年：1/1 03:00 → 2026-01（修复前会算成 2025-12）');

  // 月天数
  chk(r.bounds.feb2026.end === '2026-02-28', '2026-02 结束日 28（平年）');
  chk(r.bounds.feb2024.end === '2024-02-29', '2024-02 结束日 29（闰年）');
  chk(r.bounds.apr2026.end === '2026-04-30', '2026-04 结束日 30');
  chk(r.bounds.dec2026.end === '2026-12-31', '2026-12 结束日 31');
  chk(r.bounds.bad === null, '空月份返回 null 不崩溃');

  // 月份列表倒序
  chk(JSON.stringify(r.list) === JSON.stringify(['2026-09', '2026-08', '2026-07', '2026-06']), '月份列表倒序且连续');
  chk(JSON.stringify(r.listSingle) === JSON.stringify(['2026-08']), '单月列表只出一项');

  // 区间
  chk(r.month.start.slice(8) === '01', '本月从 1 号开始（' + r.month.start + '）');
  chk(r.lastmonth.start.slice(8) === '01', '上月从 1 号开始（' + r.lastmonth.start + '）');
  chk(r.monthpickAug.start === '2026-08-01' && r.monthpickAug.end === '2026-08-31', '按月选 2026-08 → 08-01~08-31');
  chk(r.monthpickSep.start === '2026-09-01' && r.monthpickSep.end === '2026-09-30', '按月选 2026-09 → 09-01~09-30');
  chk(r.month.start !== r.lastmonth.start, '本月与上月区间不同');
  chk(r.custom.start === '2026-08-01' && r.custom.end === '2026-08-31', '自定义区间生效');
  chk(r.customEmpty.start === '2000-01-01' && r.customEmpty.end === '2099-12-31', '自定义留空 = 全部数据');

  // 提示
  chk(r.hintMonthPick.indexOf('2026-08-01 ~ 2026-08-31') > -1, '区间提示显示具体日期（' + r.hintMonthPick.trim() + '）');
  chk(r.hintAll.indexOf('全部数据') > -1, '留空时提示「全部数据」');

  // 联动
  chk(r.hasLastMonthBtn, '存在「上月」按钮');
  chk(r.hasMonthSelect, '存在月份下拉框');
  chk(r.activeAfterPick.length === 0 && r.pickActive === true, '选月份时：3 个按钮均不高亮，下拉高亮');
  chk(JSON.stringify(r.activeAfterMonth) === JSON.stringify(['month']) && r.pickActiveAfterMonth === false, '点本月时：只有本月高亮，下拉取消高亮');

  const real = errors.filter(e => e.indexOf('ERR_NAME_NOT_RESOLVED') < 0 && e.indexOf('favicon') < 0 && e.indexOf('Failed to load resource') < 0);
  chk(real.length === 0, '无 JS 报错' + (real.length ? '：' + JSON.stringify(real.slice(0, 3)) : ''));

  // 截图
  await page.evaluate(() => {
    const pg = document.getElementById('page-qc-report');
    pg.style.display = 'block';
    const nav = document.querySelector('.nav-item[data-page="qc-report"]');
    if (nav) nav.style.display = 'flex';
    window.scrollTo(0, document.querySelector('#page-qc-report .qc-report-header').getBoundingClientRect().top + window.scrollY - 20);
  });
  await new Promise(r2 => setTimeout(r2, 300));
  await page.screenshot({ path: path.join(ROOT, 'outputs', 'qc-report-month.png') });

  console.log('\n断言: pass=' + pass + ' fail=' + fail);
  await browser.close();
  server.close();
})();
