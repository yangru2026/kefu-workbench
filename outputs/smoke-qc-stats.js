/* 质检统计页（qc-stats.html）冒烟 + 截图
 * 场景A：管理员 → 四个 tab 都能渲染、KPI 有值、明细行数=总条数
 * 场景B：普通客服（小柚）→ 只有「我的质检」，行数=自己的记录数，看不到 tabs
 * 产出：outputs/shot-qc-stats-admin.png / shot-qc-stats-detail.png / shot-qc-stats-staff.png
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const SRC = 'C:/temp/kefu_src';
const PORT = 8164;
const REF = 'icfgireprowcqwdodfqx';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 180000);

const STAFF = ['小柚', '小雷', '小猫', '七七', '苏苏', '可可', '莓莓', '小南'];
const TYPES = ['服务意识', '响应时效', '操作差错', '销售意识', '异常反馈', '红线高压'];
const SEVS = ['一般提醒', '严重问题', '严重需整改'];
const AMTS = [0, 0, 10, 20, 50, 100];
const RECS = (() => {
  const out = [];
  const today = new Date('2026-10-31T00:00:00');
  for (let i = 0; i < 46; i++) {
    const d = new Date(today); d.setDate(today.getDate() - (i % 21));
    const staff = STAFF[i % STAFF.length === 0 ? 1 : i % STAFF.length];
    const sev = SEVS[i % 3 === 0 ? 0 : (i % 5 === 0 ? 2 : 1)];
    // 造出「严重问题但还没定扣罚」的记录（金额 0），用于验证待定扣罚提示条
    const pendingNoMoney = sev !== '一般提醒' && i % 7 === 0;
    out.push({
      id: 'rec' + i,
      qc_date: d.toISOString().slice(0, 10),
      staff_name: i < 6 ? '小柚' : staff,
      qc_name: i % 2 ? '杨茹' : '小雷',
      issue_type: TYPES[i % TYPES.length],
      severity: sev,
      amount: (sev === '一般提醒' || pendingNoMoney) ? 0 : AMTS[(i % 4) + 2],
      detail: ['回复客户时用了"应该可以"等不确定表述', '首响超过 30 秒未回复', '未按话术确认度数', '漏发注意事项', '客户催单未及时安抚', '承诺了无法保证的发货时效'][i % 6],
      note: i % 4 === 0 ? '已当面提醒' : null
    });
  }
  return out;
})();

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = p === '/qc.html' ? SRC + '/qc-stats.html'
    : p === '/app.js' ? SRC + '/app.js'
    : path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime }); res.end(data);
  } catch (e) { res.writeHead(404); res.end('nf'); }
});
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });

async function run(browser, role, name, qcFail) {
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
    if (u.includes('/rest/v1/profiles')) return req.respond(json({ id: 'u1', name: name, role: role }));
    if (u.includes('/rest/v1/qc_records')) {
      if (qcFail) return req.respond({ status: 400, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ code: '42703', message: 'column qc_records.qc_date does not exist' }) });
      // 仿真 PostgREST 的 staff_name=eq.xxx 过滤（页面靠这个把客服限定成只看自己）
      const m2 = u.match(/staff_name=eq\.([^&]+)/);
      const list = m2 ? RECS.filter(r => r.staff_name === decodeURIComponent(m2[1])) : RECS;
      return req.respond(json(list));
    }
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  // 注入登录态（supabase-js v2 的 storage key）
  await page.evaluateOnNewDocument((ref) => {
    const session = {
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
      user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'u1@youhu.app', app_metadata: {}, user_metadata: {} }
    };
    localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify(session));
  }, REF);

  await page.goto(`http://127.0.0.1:${PORT}/qc.html`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  const st = await page.evaluate(() => {
    const vis = id => { const el = document.getElementById(id); return el && el.style.display !== 'none' && el.innerHTML.length > 0; };
    return {
      badge: (document.getElementById('roleBadge') || {}).textContent,
      tabsShown: document.getElementById('tabs').style.display !== 'none',
      kpiCount: document.querySelectorAll('.kpi').length,
      rankRows: document.querySelectorAll('#panel-rank .rank-row').length,
      trendCols: document.querySelectorAll('#panel-trend .tcol').length,
      typeRows: document.querySelectorAll('#panel-type .type-row').length,
      detailRows: document.querySelectorAll('#panel-detail table.tb tbody tr').length,
      mineRows: document.querySelectorAll('#panel-mine table.tb tbody tr').length,
      mineShown: document.getElementById('panel-mine').style.display !== 'none',
      registerBtn: document.getElementById('btnRegister').style.display !== 'none',
      pendingShown: document.getElementById('pendingBox').style.display !== 'none',
      pendingText: (document.getElementById('pendingBox').innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      errShown: document.getElementById('errBar').style.display !== 'none',
      errText: (document.getElementById('errBar').innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      noMaskElement: !document.getElementById('setupMask')
    };
  });

  const shots = {};
  if (role !== 'staff') {
    await page.screenshot({ path: ROOT + '/outputs/shot-qc-stats-admin.png', fullPage: true });
    await page.evaluate(() => {
      document.querySelectorAll('.tab').forEach(b => { if (b.dataset.tab === 'detail') b.click(); });
    });
    await sleep(300);
    await page.screenshot({ path: ROOT + '/outputs/shot-qc-stats-detail.png', fullPage: true });
    const tr = await page.evaluate(() => {
      document.querySelectorAll('.tab').forEach(b => { if (b.dataset.tab === 'trend') b.click(); });
      return 1;
    });
    await sleep(300);
    await page.screenshot({ path: ROOT + '/outputs/shot-qc-stats-trend.png', fullPage: true });
  } else {
    await page.screenshot({ path: ROOT + '/outputs/shot-qc-stats-staff.png', fullPage: true });
  }
  await page.close();
  return { st, errs };
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });

  const admin = await run(browser, 'admin', '杨茹');
  const staff = await run(browser, 'staff', '小柚');
  const broken = await run(browser, 'admin', '杨茹', true);   // 模拟旧表结构（查询报错）

  const mineCount = RECS.filter(r => r.staff_name === '小柚').length;
  const checks = {
    admin_tabs_shown: admin.st.tabsShown === true,
    admin_kpi_4: admin.st.kpiCount === 4,
    admin_rank_rows: admin.st.rankRows > 0,
    admin_trend_cols: admin.st.trendCols > 0,
    admin_type_rows: admin.st.typeRows > 0,
    admin_detail_all: admin.st.detailRows === RECS.length,
    staff_no_tabs: staff.st.tabsShown === false,
    staff_only_mine: staff.st.mineShown === true && staff.st.mineRows === mineCount,
    admin_register_btn: admin.st.registerBtn === true,
    admin_pending_notice: admin.st.pendingShown === true && /还没定扣罚/.test(admin.st.pendingText),
    staff_no_register_btn: staff.st.registerBtn === false && staff.st.pendingShown === false,
    no_mask_element: broken.st.noMaskElement === true,                       // 模态弹窗已彻底移除
    broken_shows_dismissable_bar: broken.st.errShown === true && /SQL/.test(broken.st.errText),
    no_page_errors: admin.errs.concat(staff.errs, broken.errs).length === 0
  };
  fs.writeFileSync(ROOT + '/outputs/smoke-qc-stats.out', JSON.stringify({ admin: admin.st, staff: staff.st, broken: broken.st, mineCount, checks, errs: admin.errs.concat(staff.errs, broken.errs) }, null, 2), 'utf8');
  console.log(JSON.stringify({ admin: admin.st, staff: staff.st, broken: broken.st, mineCount, checks }, null, 2));
  const ok = Object.keys(checks).every(k => checks[k]);
  console.log(ok ? 'QC_STATS_SMOKE_PASS' : 'QC_STATS_SMOKE_FAIL');

  await browser.close(); server.close(); clearTimeout(wd);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
