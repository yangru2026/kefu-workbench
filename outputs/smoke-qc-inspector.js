const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8137;
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
  await new Promise(r => setTimeout(r, 2500));

  const result = await page.evaluate(() => {
    // 注意：currentProfile / qcReportPhoneMap / qcReportData 都是顶层 let 声明，
    // 不挂在 window 上，必须用直接赋值（window.x = 无效）
    currentProfile = { name: '杨茹', role: 'admin' };
    qcReportPhoneMap = {
      '13800000001': { name: '杨茹' },
      '13800000002': { name: '小念' },
      '13800000003': { name: '小暖' },
      '13800000004': { name: '小雷' }
    };
    // 假数据：杨茹3条 / 小念3条 / 小暖0条 / 小雷1条
    qcReportData = [
      { created_by: '13800000001', staff: '客服甲', severity: '一般',       penalty_amount: 0,  status: 'done' },
      { created_by: '13800000001', staff: '客服甲', severity: '严重',       penalty_amount: 10, status: 'pending' },
      { created_by: '13800000001', staff: '客服乙', severity: '严重需整改', penalty_amount: 20, status: 'done' },
      { created_by: '13800000002', staff: '客服丙', severity: '一般',       penalty_amount: 0,  status: 'pending' },
      { created_by: '13800000002', staff: '客服丙', severity: '一般',       penalty_amount: 0,  status: 'done' },
      { created_by: '13800000002', staff: '客服丁', severity: '严重',       penalty_amount: 5,  status: 'done' },
      { created_by: '13800000004', staff: '客服甲', severity: '严重需整改', penalty_amount: 30, status: 'pending' }
    ];
    const injected = {
      profile: currentProfile && currentProfile.name,
      phoneKeys: Object.keys(qcReportPhoneMap).length,
      dataLen: qcReportData.length
    };
    renderQcInspectorDetail();
    const box = document.getElementById('qc-report-by-inspector-detail');
    const groups = Array.from(box.querySelectorAll('.qc-insp-group')).map(g => ({
      title: g.querySelector('.qc-insp-title').innerText.trim(),
      rows: Array.from(g.querySelectorAll('tbody tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()).join(' | ')
      )
    }));
    return { injected, groupCount: groups.length, groups };
  });

  console.log('=== 质检员明细渲染结果 ===');
  console.log(JSON.stringify(result, null, 2));

  // 断言
  const exp = [
    { name: '杨茹', staffRows: 2, total: '合计 | 3 | ¥30 | 1 | 1 | 1 | 2/3' },
    { name: '小念', staffRows: 2, total: '合计 | 3 | ¥5 | 2 | 1 | 0 | 2/3' },
    { name: '小暖', staffRows: 0, total: null },
    { name: '小雷', staffRows: 1, total: '合计 | 1 | ¥30 | 0 | 0 | 1 | 0/1' }
  ];
  let pass = 0, fail = 0;
  const chk = (cond, msg) => { if (cond) { pass++; console.log('  PASS  ' + msg); } else { fail++; console.log('  FAIL  ' + msg); } };

  chk(result.groupCount === 4, '渲染出 4 个质检员分组（实际 ' + result.groupCount + '）');
  exp.forEach((e, i) => {
    const g = result.groups[i];
    if (!g) { chk(false, e.name + ' 分组存在'); return; }
    chk(g.title.indexOf(e.name) > -1, e.name + ' 分组标题含姓名');
    const dataRows = g.rows.filter(r => r.indexOf('合计') !== 0 && r.indexOf('该时间范围') !== 0);
    chk(dataRows.length === e.staffRows, e.name + ' 被质检人行数=' + e.staffRows + '（实际 ' + dataRows.length + '）');
    if (e.total) {
      const tot = g.rows.find(r => r.indexOf('合计') === 0);
      chk(tot === e.total, e.name + ' 合计行正确：' + e.total + (tot ? '（实际 ' + tot + '）' : '（无合计行）'));
    } else {
      chk(g.rows.some(r => r.indexOf('该时间范围') > -1), e.name + ' 无记录时显示占位提示');
    }
  });

  console.log('\n=== JS 错误 ===');
  const real = errors.filter(e => e.indexOf('ERR_NAME_NOT_RESOLVED') < 0 && e.indexOf('favicon') < 0);
  console.log(real.length ? JSON.stringify(real, null, 2) : 'none');
  console.log('\n断言: pass=' + pass + ' fail=' + fail);

  // 截图展示「一个质检员对应多个被质检人」效果
  await page.evaluate(() => {
    const pg = document.getElementById('page-qc-report');
    pg.style.display = 'block';
    const nav = document.querySelector('.nav-item[data-page="qc-report"]');
    if (nav) nav.style.display = 'flex';
    window.scrollTo(0, document.querySelector('#page-qc-report .qc-report-block-full').getBoundingClientRect().top + window.scrollY - 20);
  });
  await new Promise(r2 => setTimeout(r2, 300));
  await page.screenshot({ path: path.join(ROOT, 'outputs', 'qc-report-multi-staff.png') });

  await browser.close();
  server.close();
})();
