/* 「今日日报 · 未完成名单」弹窗冒烟 + 截图（2026-11-03，仿售后工作台待办弹窗）
 * 覆盖：弹窗打开/统计/分班次/三类徽标(日报未填/质检未确认/客户之声)/已完成不列/休班不在岗/
 *       全部完成徽标/店铺汇总入口/关闭/无页面异常
 * 产出：outputs/shot-daily-todo.png
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const SRC = 'C:/temp/kefu_src';
const PORT = 8186;
const REF = 'icfgireprowcqwdodfqx';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 180000);

const PROFILES = [
  { id: 'p1', name: '杨茹', role: 'admin', group_name: '', real_name: null },
  { id: 'p2', name: '小柚', role: 'staff', group_name: 'A组', real_name: null },
  { id: 'p3', name: '小雷', role: 'staff', group_name: 'A组', real_name: null },
  { id: 'p4', name: '小南', role: 'staff', group_name: 'B组', real_name: null },
  { id: 'p5', name: '朵朵', role: 'staff', group_name: 'B组', real_name: null },
  { id: 'p6', name: '天天', role: 'staff', group_name: 'C组', real_name: null }
];
const day = String(new Date().getDate());
const monthKey = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
const SCHEDULE_ROWS = [
  { month_key: monthKey, staff_name: '小柚', group_name: 'A组', schedule: { [day]: '早' } },
  { month_key: monthKey, staff_name: '小雷', group_name: 'A组', schedule: { [day]: '中' } },
  { month_key: monthKey, staff_name: '小南', group_name: 'B组', schedule: { [day]: '晚' } },
  { month_key: monthKey, staff_name: '朵朵', group_name: 'B组', schedule: { [day]: '晚' } },
  { month_key: monthKey, staff_name: '天天', group_name: 'C组', schedule: { [day]: '晚' } },
  { month_key: monthKey, staff_name: '泡泡', group_name: 'C组', schedule: { [day]: '休' } }
];
// 小柚交了日报但客户之声 4/5；小雷全好；小南啥都没有+质检2条未确认；朵朵全好；天天没交
const REPORTS = [{ user_id: 'p2' }, { user_id: 'p3' }, { user_id: 'p5' }];
const QC_PENDING = [{ staff_name: '小南' }, { staff_name: '小南' }];
const VOC_ROWS = []
  .concat(Array.from({ length: 4 }, () => ({ staff_name: '小柚' })))
  .concat(Array.from({ length: 5 }, () => ({ staff_name: '小雷' })))
  .concat(Array.from({ length: 5 }, () => ({ staff_name: '朵朵' })));

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
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 });
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
    if (u.includes('/rest/v1/profiles')) {
      if (u.includes('id=eq.p1')) return req.respond(json(PROFILES[0]));
      return req.respond(json(PROFILES));
    }
    if (u.includes('/rest/v1/schedule_data')) {
      if (u.includes('staff_name=eq.')) return req.respond(json(null));   // 本人查询：管理员无排班
      return req.respond(json(SCHEDULE_ROWS));
    }
    if (u.includes('/rest/v1/daily_reports')) return req.respond(json(REPORTS));
    if (u.includes('/rest/v1/qc_records')) return req.respond(json(QC_PENDING));
    if (u.includes('/rest/v1/customer_voice')) return req.respond(json(VOC_ROWS));
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.evaluateOnNewDocument((ref) => {
    const session = {
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
      user: { id: 'p1', aud: 'authenticated', role: 'authenticated', email: 'p1@youhu.app', app_metadata: {}, user_metadata: {} }
    };
    localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify(session));
  }, REF);

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await sleep(4500);
  // 关掉启动期自动弹窗，避免遮住（公告弹窗要点「我知道了」才算关，纯隐藏会被重渲染盖回来）
  await page.evaluate(() => {
    ['qc-gate-modal', 'duty-remind-modal', 'daily-remind-modal'].forEach(id => {
      const el = document.getElementById(id); if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    });
    window.__popupQueue = []; window.__activePopup = null;
  });
  await sleep(500);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#sp-notice-modal button')];
    const known = btns.find(b => /我知道了/.test(b.textContent));
    if (known) known.click();
    const el = document.getElementById('sp-notice-modal');
    if (el && el.style.display !== 'none') { el.style.display = 'none'; el.innerHTML = ''; }
    window.__popupQueue = []; window.__activePopup = null;
  });
  await sleep(600);
  await page.evaluate(() => {
    ['sp-notice-modal', 'qc-gate-modal', 'duty-remind-modal', 'daily-remind-modal'].forEach(id => {
      const el = document.getElementById(id); if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    });
    window.__popupQueue = []; window.__activePopup = null;
  });

  await page.evaluate(() => { openDailyTodoModal(); });
  // 公告弹窗会定时重渲染，内联隐藏压不住 → 注入 !important 样式表强制盖掉（只影响截图，不影响断言）
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = '__kill_notice';
    s.textContent = '#spNoticeMask,#sp-notice-modal,#qc-gate-modal,#duty-remind-modal,#daily-remind-modal{display:none!important;visibility:hidden!important;}';
    document.head.appendChild(s);
  });
  await sleep(1200);

  const st = await page.evaluate(() => {
    const ov = document.getElementById('daily-todo-modal');
    const txt = ov.innerText || '';
    const shown = ov.style.display === 'flex';
    const cnt = s => [...ov.querySelectorAll('span')].filter(sp => sp.textContent.trim() === s).length;
    return {
      shown,
      title: /今日日报 · 未完成名单/.test(txt),
      stats: /在岗/.test(txt) && /已完成/.test(txt) && /未完成/.test(txt),
      onshift5: /在岗\s*5/.test(txt.replace(/<[^>]+>/g, ' ')),
      noReportBadges: cnt('日报未填'),
      qcBadge: cnt('质检未确认 2 条') === 1,
      vocPartial: cnt('客户之声 4/5 条') === 1,
      vocZero: cnt('客户之声 0/5 条') === 2,
      allDoneBadge: cnt('全部完成 ✅'),
      noXiuxiu: !/泡泡/.test(txt),
      btnRefresh: /刷新/.test(txt),
      btnShop: /店铺汇总/.test(txt),
      btnClose: /关闭/.test(txt)
    };
  });

  await page.screenshot({ path: ROOT + '/outputs/shot-daily-todo.png', fullPage: false });
  const dbg = await page.evaluate(() => ({
    visible: ['sp-notice-modal', 'qc-gate-modal', 'duty-remind-modal', 'daily-remind-modal', 'daily-todo-modal']
      .filter(id => { const el = document.getElementById(id); return el && el.style.display !== 'none' && el.offsetParent !== null; }),
    killStyle: !!document.getElementById('__kill_notice'),
    activePopup: window.__activePopup || null,
    centerEl: (() => {
      const el = document.elementFromPoint(720, 480);
      let cur = el, chain = [];
      while (cur && chain.length < 5){ chain.push((cur.id ? '#' + cur.id : '') + (cur.className && typeof cur.className === 'string' ? '.' + cur.className.split(' ')[0] : '')); cur = cur.parentElement; }
      return chain;
    })()
  }));
  console.log('DEBUG ' + JSON.stringify(dbg));

  // 店铺汇总入口
  await page.evaluate(() => { const b = [...document.querySelectorAll('#daily-todo-modal button')].find(b => /店铺汇总/.test(b.textContent)); if (b) b.click(); });
  await sleep(600);
  const afterShop = await page.evaluate(() => ({
    modalHidden: (document.getElementById('daily-todo-modal').style.display || 'none') === 'none',
    trackShown: document.getElementById('daily-track-area').style.display !== 'none'
  }));

  // 重新打开 → 刷新 → 关闭
  await page.evaluate(() => { openDailyTodoModal(); });
  await sleep(900);
  await page.evaluate(() => { const b = [...document.querySelectorAll('#daily-todo-modal button')].find(b => /刷新/.test(b.textContent)); if (b) b.click(); });
  await sleep(1000);
  await page.evaluate(() => { const b = [...document.querySelectorAll('#daily-todo-modal button')].find(b => b.textContent.trim() === '关闭'); if (b) b.click(); });
  await sleep(300);
  const afterClose = await page.evaluate(() => (document.getElementById('daily-todo-modal').style.display || 'none') === 'none');

  const checks = {
    modal_shown: st.shown === true,
    title_ok: st.title === true,
    stats_ok: st.stats === true && st.onshift5 === true,          // 在岗 5 人（休班泡泡不算）
    no_report_badge_x2: st.noReportBadges === 2,                  // 小南/天天没交（小柚小雷朵朵已交）
    qc_badge: st.qcBadge === true,
    voc_partial_org: st.vocPartial === true,                      // 小柚 4/5 橙色
    voc_zero_red: st.vocZero === true,                            // 小南/天天 0/5
    all_done_badge_x1: st.allDoneBadge === 1,                     // 中班全部完成
    off_duty_excluded: st.noXiuxiu === true,                      // 休班泡泡不在名单
    shop_entry: afterShop.modalHidden === true && afterShop.trackShown === true,
    refresh_and_close: afterClose === true,
    no_page_errors: errs.length === 0
  };
  fs.writeFileSync(ROOT + '/outputs/smoke-daily-todo.out', JSON.stringify({ st, afterShop, afterClose, checks, errs }, null, 2), 'utf8');
  console.log(JSON.stringify({ st, afterShop, afterClose, checks }, null, 2));
  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? 'DAILY_TODO_SMOKE_PASS' : 'DAILY_TODO_SMOKE_FAIL');
  await browser.close(); server.close(); clearTimeout(wd);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
