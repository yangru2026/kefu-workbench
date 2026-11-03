/**
 * 截「排班表 · 关联飞书表格」：状态条 + 关联弹窗
 * node outputs/shot-schedule-sheet.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(ROOT, p);
      fs.readFile(fp, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('nf'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--proxy-bypass-list=*', '--window-size=1500,1100'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 1100, deviceScaleFactor: 1.5 });
    page.on('dialog', (d) => d.accept().catch(() => {}));
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message || e)));
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2600);
    const ev = (fn, t) => Promise.race([
      page.evaluate(fn).catch((e) => ({ err: String((e && e.message) || e) })),
      new Promise((r) => setTimeout(() => r({ timeout: true }), t || 9000)),
    ]);

    // 管理员身份 + 进排班页
    const step1 = await ev(() => {
      try { currentProfile = { role: 'admin', name: '杨茹', id: 'x' }; } catch (e) {}
      const n = document.querySelector('[data-page="schedule"]');
      if (n) n.click();
      const pg = document.getElementById('page-schedule');
      if (pg && !pg.classList.contains('active')) { document.querySelectorAll('.page').forEach((p) => p.classList.remove('active')); pg.classList.add('active'); }
      return true;
    });
    await sleep(2500);
    await ev(() => {
      try { if (typeof loadScheduleFromDB === 'function') loadScheduleFromDB(); } catch (e) {}
      try { if (typeof loadScheduleSyncStatus === 'function') loadScheduleSyncStatus(); } catch (e) {}
      try { if (typeof syncAdminButtons === 'function') syncAdminButtons(); } catch (e) {}
      const b = document.getElementById('sched-link-btn');
      if (b) b.style.display = '';
      const s = document.getElementById('sched-sync-btn');
      if (s) s.style.display = '';
    });
    await sleep(3000);

    const status = await ev(() => {
      const s = document.getElementById('sched-sync-status');
      const w = document.getElementById('schedule-table-wrapper');
      return {
        status: s ? s.innerText : '(no status)',
        hasUrl: !!(typeof SCHEDULE_SHEET_CFG !== 'undefined' && SCHEDULE_SHEET_CFG.url),
        rows: w ? w.querySelectorAll('tr').length : 0,
        linkBtn: !!(document.getElementById('sched-link-btn')),
      };
    });
    console.log('状态条:', JSON.stringify(status));

    await page.screenshot({ path: path.join(ROOT, 'outputs/shot-schedule-page.png'), fullPage: false });

    // 打开关联弹窗
    await ev(() => { if (typeof openScheduleSheetModal === 'function') openScheduleSheetModal(); });
    await sleep(700);
    const modal = await ev(() => {
      const m = document.getElementById('sched-sheet-modal');
      return {
        visible: m ? getComputedStyle(m).display : 'none',
        url: (document.getElementById('sched-sheet-url') || {}).value || '',
        month: (document.getElementById('sched-sheet-month') || {}).value || '',
      };
    });
    console.log('弹窗:', JSON.stringify(modal));
    await page.screenshot({ path: path.join(ROOT, 'outputs/shot-schedule-modal.png') });

    // 真调一次后端（试读，不写库），把结果渲染到弹窗里
    await ev(async () => {
      const out = document.getElementById('sched-sheet-result');
      const url = document.getElementById('sched-sheet-url').value.trim();
      try {
        const j = await callScheduleSheetSync(true, { url, sheet_name: '', month_key: '', cleanup: true });
        out.style.color = j.ok ? '#0f9d76' : '#c0392b';
        out.textContent = scheduleSyncSummary(j);
      } catch (e) {
        out.style.color = '#c0392b';
        out.textContent = '❌ 试读失败：' + e.message;
      }
    }, 20000);
    await sleep(1500);
    const res = await ev(() => (document.getElementById('sched-sheet-result') || {}).innerText || '');
    console.log('同步结果:\n' + res);
    await page.screenshot({ path: path.join(ROOT, 'outputs/shot-schedule-modal-result.png') });

    console.log('页面报错:', errs.length ? errs.slice(0, 5).join(' | ') : '无');
  } catch (e) {
    console.log('FATAL ' + ((e && e.message) || e));
  } finally {
    await browser.close().catch(() => {});
    srv.close();
  }
})();
