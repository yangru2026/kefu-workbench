// 质检报告页布局遮挡检测：验证「质检员明细」整宽块不与下方 4 个小表重叠、且不产生横向溢出
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8141;
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

const VIEWPORTS = [
  { w: 1440, h: 1000, label: '桌面 1440' },
  { w: 1024, h: 900, label: '笔记本 1024' }
];

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  let pass = 0, fail = 0;
  const chk = (cond, msg) => { if (cond) { pass++; console.log('  PASS  ' + msg); } else { fail++; console.log('  FAIL  ' + msg); } };

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2500));

    const m = await page.evaluate(() => {
      // 顶层 let，必须直接赋值
      currentProfile = { name: '杨茹', role: 'admin' };
      qcReportPhoneMap = {
        '13800000001': { name: '杨茹' },
        '13800000002': { name: '小念' },
        '13800000003': { name: '小暖' },
        '13800000004': { name: '小雷' }
      };
      const staffs = ['客服甲', '客服乙的名字比较长测试换行', '客服丙', '客服丁', '客服戊', '客服己'];
      const sev = ['一般', '严重', '严重需整改'];
      qcReportData = [];
      for (let i = 0; i < 60; i++) {
        qcReportData.push({
          created_by: '1380000000' + ((i % 4) + 1),
          staff: staffs[i % staffs.length],
          severity: sev[i % 3],
          penalty_amount: (i % 5) * 10,
          status: i % 2 ? 'done' : 'pending'
        });
      }
      renderQcReport();

      // 显示质检报告页（绕过登录）
      const pg = document.getElementById('page-qc-report');
      pg.style.display = 'block';
      const nav = document.querySelector('.nav-item[data-page="qc-report"]');
      if (nav) nav.style.display = 'flex';

      const full = document.querySelector('#page-qc-report .qc-report-block-full');
      const tables = document.getElementById('page-qc-report') ? document.querySelectorAll('#page-qc-report .qc-report-tables .qc-report-block') : [];
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
      const overlap = (a, b) => !(a.right <= b.x + 0.5 || b.right <= a.x + 0.5 || a.bottom <= b.y + 0.5 || b.bottom <= a.y + 0.5);

      const fullRect = full ? rect(full) : null;
      const sibRects = Array.from(tables).map(rect);
      const overlaps = fullRect ? sibRects.filter(r => overlap(fullRect, r)).length : -1;

      // 明细容器自身：应能滚动而不撑破页面
      const detail = document.getElementById('qc-report-by-inspector-detail');
      const detailOverflowX = detail ? (detail.scrollWidth - detail.clientWidth) : -1;
      const detailHasScroll = detail ? getComputedStyle(detail).overflow : '';

      // 页面横向不应出现滚动条
      const pageEl = document.getElementById('page-qc-report');
      const pageOverflowX = pageEl ? (pageEl.scrollWidth - pageEl.clientWidth) : -1;
      const docOverflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;

      // 各小表容器内是否有内容溢出到块外
      const blockSpill = Array.from(tables).map(b => {
        const inner = b.querySelector('div[style*="overflow"]');
        if (!inner) return 0;
        return Math.max(0, inner.getBoundingClientRect().right - b.getBoundingClientRect().right);
      });

      const tablesWrap = document.querySelector('#page-qc-report .qc-report-tables');
      const wrapW = tablesWrap ? tablesWrap.getBoundingClientRect().width : 0;

      return {
        fullRect, sibCount: sibRects.length, overlaps,
        sibRects, wrapW,
        detailOverflowX, detailHasScroll,
        pageOverflowX, docOverflowX,
        blockSpill,
        groups: document.querySelectorAll('#qc-report-by-inspector-detail .qc-insp-group').length
      };
    });

    console.log('\n===== ' + vp.label + ' (' + vp.w + 'x' + vp.h + ') =====');
    console.log('整宽块 rect: ' + JSON.stringify(m.fullRect && { x: Math.round(m.fullRect.x), y: Math.round(m.fullRect.y), w: Math.round(m.fullRect.w), h: Math.round(m.fullRect.h) }));
    console.log('同级小表数: ' + m.sibCount + ' | 质检员分组数: ' + m.groups);
    console.log('明细容器 overflow: ' + m.detailHasScroll + ' | 内部横向可滚动像素: ' + m.detailOverflowX);
    console.log('页面横向溢出: page=' + m.pageOverflowX + ' doc=' + m.docOverflowX);

    chk(m.overlaps === 0, '整宽块与 4 个小表块无重叠（重叠数=' + m.overlaps + '）');
    chk(m.fullRect && Math.abs(m.fullRect.w - m.wrapW) <= 2,
      '整宽块与下方表格区同宽（' + Math.round(m.fullRect.w) + ' vs ' + Math.round(m.wrapW) + '）');
    chk(m.detailHasScroll.indexOf('auto') > -1, '明细容器带滚动（overflow=' + m.detailHasScroll + '）');
    chk(m.pageOverflowX <= 1, '质检报告页无横向溢出（' + m.pageOverflowX + '）');
    chk(m.docOverflowX <= 1, '整个文档无横向溢出（' + m.docOverflowX + '）');
    chk(m.blockSpill.every(v => v <= 1), '4 个小表块内容不溢出块外（最大溢出 ' + Math.round(Math.max(...m.blockSpill)) + 'px）');
    chk(m.groups === 4, '明细区渲染 4 个质检员分组（' + m.groups + '）');

    const real = errors.filter(e => e.indexOf('ERR_NAME_NOT_RESOLVED') < 0 && e.indexOf('favicon') < 0);
    chk(real.length === 0, '无 JS 报错' + (real.length ? '：' + JSON.stringify(real.slice(0, 3)) : ''));

    await page.evaluate(() => {
      const el = document.querySelector('#page-qc-report .qc-report-block-full');
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
    });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(ROOT, 'outputs', 'qc-report-layout-' + vp.w + '.png'), fullPage: false });
    await page.close();
  }

  console.log('\n断言: pass=' + pass + ' fail=' + fail);
  await browser.close();
  server.close();
})();
