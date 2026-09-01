// 质检「超时自动确认 + 到期提醒」冒烟测试（用模拟数据库，不碰线上数据）
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8151;
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

  await page.goto(`http://localhost:${PORT}/qc-v2.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));

  const r = await page.evaluate(() => {
    /* ---------- 造一个内存版 supabase ---------- */
    const H = 3600 * 1000;
    const now = Date.now();
    const iso = ms => new Date(ms).toISOString();

    const db = {
      qc_shares: [
        // 1) 已过期 10 小时 → 应自动确认
        { id: 1, token: 't1', staff: '客服甲', record_ids: [101, 102], record_count: 2,
          created_at: iso(now - 58 * H), auto_confirm_hours: 48, due_at: iso(now - 10 * H),
          confirmed_at: null, auto_confirmed: false, reminded_at: null },
        // 2) 还剩 6 小时 → 应发催办提醒（在 12 小时窗口内）
        { id: 2, token: 't2', staff: '客服乙', record_ids: [103], record_count: 1,
          created_at: iso(now - 42 * H), auto_confirm_hours: 48, due_at: iso(now + 6 * H),
          confirmed_at: null, auto_confirmed: false, reminded_at: null },
        // 3) 还剩 30 小时 → 不该动
        { id: 3, token: 't3', staff: '客服丙', record_ids: [104], record_count: 1,
          created_at: iso(now - 18 * H), auto_confirm_hours: 48, due_at: iso(now + 30 * H),
          confirmed_at: null, auto_confirmed: false, reminded_at: null },
        // 4) 已手动确认 → 不该动
        { id: 4, token: 't4', staff: '客服丁', record_ids: [105], record_count: 1,
          created_at: iso(now - 80 * H), auto_confirm_hours: 48, due_at: iso(now - 32 * H),
          confirmed_at: iso(now - 60 * H), auto_confirmed: false, reminded_at: null },
        // 5) 已过期，但提醒过了；且没写 due_at（老数据）→ 靠 created_at + hours 兜底
        { id: 5, token: 't5', staff: '客服戊', record_ids: [106], record_count: 1,
          created_at: iso(now - 50 * H), auto_confirm_hours: 48, due_at: null,
          confirmed_at: null, auto_confirmed: false, reminded_at: iso(now - 13 * H) }
      ],
      profiles: [
        { id: 'u-甲', name: '客服甲' }, { id: 'u-乙', name: '客服乙' },
        { id: 'u-丙', name: '客服丙' }, { id: 'u-丁', name: '客服丁' },
        { id: 'u-戊', name: '客服戊' }
      ],
      notifications: [],
      qc_records: [
        { id: 101, status: 'pending', coach_date: null },
        { id: 102, status: 'pending', coach_date: null },
        { id: 103, status: 'pending', coach_date: null },
        { id: 104, status: 'pending', coach_date: null },
        { id: 105, status: 'done',    coach_date: '2026-08-20' },
        { id: 106, status: 'pending', coach_date: null }
      ]
    };
    const log = { notifications: [], recordUpdates: [], shareUpdates: [] };

    function match(row, f) {
      const [op, col, val] = f;
      if (op === 'eq') return String(row[col]) === String(val);
      if (op === 'is') return (row[col] === null || row[col] === undefined) === (val === null);
      if (op === 'in') return (val || []).map(String).indexOf(String(row[col])) > -1;
      return true;
    }
    function builder(table) {
      const b = { _t: table, _f: [], _upd: null, _ins: null, _single: false };
      ['select','order','limit','gte','lte'].forEach(n => { b[n] = () => b; });
      ['eq','is','in'].forEach(n => { b[n] = (c, v) => { b._f.push([n, c, v]); return b; }; });
      b.single = () => { b._single = true; return b; };
      b.update = v => { b._upd = v; return b; };
      b.insert = v => { b._ins = v; return b; };
      b.then = resolve => {
        const rows = db[table] || [];
        if (b._ins) {
          const val = Object.assign({}, b._ins, { id: 900 + db[table].length + 1 });
          db[table].push(val);
          if (table === 'notifications') log.notifications.push(val);
          return Promise.resolve({ data: val, error: null }).then(resolve);
        }
        if (b._upd) {
          const hit = rows.filter(row => b._f.every(f => match(row, f)));
          hit.forEach(row => {
            Object.assign(row, b._upd);
            if (table === 'qc_shares') log.shareUpdates.push({ id: row.id, upd: b._upd });
            if (table === 'qc_records') log.recordUpdates.push({ id: row.id, upd: b._upd });
          });
          return Promise.resolve({ data: hit, error: null }).then(resolve);
        }
        const out = rows.filter(row => b._f.every(f => match(row, f))).map(x => Object.assign({}, x));
        const data = b._single ? (out[0] || null) : out;
        return Promise.resolve({ data, error: null }).then(resolve);
      };
      return b;
    }
    window.supabase = { from: builder };
    window.__mockDb = db;
    window.__mockLog = log;

    /* ---------- 1) 纯函数：到期时间 / 状态判定 ---------- */
    const s1 = db.qc_shares.find(x => x.id === 1);
    const s2 = db.qc_shares.find(x => x.id === 2);
    const s3 = db.qc_shares.find(x => x.id === 3);
    const s4 = db.qc_shares.find(x => x.id === 4);
    const s5 = db.qc_shares.find(x => x.id === 5);

    const before = {
      due1: dueAtOf(s1).toISOString(),
      status1: shareStatusOf(s1),
      status2: shareStatusOf(s2),
      status3: shareStatusOf(s3),
      status4: shareStatusOf(s4),
      status5: shareStatusOf(s5),
      left2: Math.round(msLeftOf(s2) / 3600000),
      countdown2: fmtCountdown(msLeftOf(s2)),
      countdown1: fmtCountdown(msLeftOf(s1)),
      oldDataDue5: dueAtOf(s5).toISOString()   // 老数据没 due_at，靠 created_at+48h 兜底
    };

    /* ---------- 2) 跑一次到期扫描 ---------- */
    return runQcShareSweep().then(() => {
      const after = {
        s1: { confirmed: !!s1.confirmed_at, auto: s1.auto_confirmed },
        s2: { confirmed: !!s2.confirmed_at, reminded: !!s2.reminded_at },
        s3: { confirmed: !!s3.confirmed_at, reminded: !!s3.reminded_at },
        s4: { confirmed: !!s4.confirmed_at, auto: s4.auto_confirmed },
        s5: { confirmed: !!s5.confirmed_at, auto: s5.auto_confirmed },
        rec101: db.qc_records.find(x => x.id === 101).status,
        rec102: db.qc_records.find(x => x.id === 102).status,
        rec103: db.qc_records.find(x => x.id === 103).status,
        rec104: db.qc_records.find(x => x.id === 104).status,
        rec105: db.qc_records.find(x => x.id === 105).status,
        rec106: db.qc_records.find(x => x.id === 106).status,
        notes: log.notifications.map(n => ({ to: n.user_id, title: n.title })),
        statusAfter1: shareStatusOf(s1)
      };

      /* ---------- 3) 汇总弹窗渲染 ---------- */
      qcShares = db.qc_shares.slice();
      isAdmin = true;
      renderConfirmStatus('all');
      const listHtml = document.getElementById('csList').innerHTML;
      after.kpiAuto = document.getElementById('csKpiAuto').textContent;
      after.kpiConfirmed = document.getElementById('csKpiConfirmed').textContent;
      after.kpiPending = document.getElementById('csKpiPending').textContent;
      after.kpiOverdue = document.getElementById('csKpiOverdue').textContent;
      after.hasAutoLabel = listHtml.indexOf('已自动确认') > -1;
      after.autoRows = (listHtml.match(/cs-row auto/g) || []).length;
      after.pendingShowsCountdown = listHtml.indexOf('剩 ') > -1;
      after.remindedMark = listHtml.indexOf('已催') > -1;

      return { before, after };
    });
  });

  console.log('=== 扫描前 ===');
  console.log(JSON.stringify(r.before, null, 2));
  console.log('\n=== 扫描后 ===');
  console.log(JSON.stringify(r.after, null, 2));

  let pass = 0, fail = 0;
  const chk = (cond, msg) => { if (cond) { pass++; console.log('  PASS  ' + msg); } else { fail++; console.log('  FAIL  ' + msg); } };
  console.log('\n=== 断言 ===');

  // 状态判定
  chk(r.before.status1 === 'overdue', '过期 10 小时 → 状态 overdue');
  chk(r.before.status2 === 'pending', '剩 6 小时 → 状态 pending');
  chk(r.before.status3 === 'pending', '剩 30 小时 → 状态 pending');
  chk(r.before.status4 === 'confirmed', '已手动确认 → 状态 confirmed');
  chk(r.before.status5 === 'overdue', '老数据（无 due_at）过期 → 状态 overdue');
  chk(r.before.left2 === 6, '剩余小时数计算正确（6 小时）');
  chk(/天|小时/.test(r.before.countdown2), '倒计时文案正常：' + r.before.countdown2);
  chk(r.before.countdown1 === '已到期', '过期后倒计时显示「已到期」');

  // 自动确认
  chk(r.after.s1.confirmed === true, '过期分享已写入 confirmed_at');
  chk(r.after.s1.auto === true, '过期分享标记为 auto_confirmed');
  chk(r.after.s5.confirmed === true, '老数据（无 due_at）也能自动确认');
  chk(r.after.s5.auto === true, '老数据标记为 auto_confirmed');
  chk(r.after.statusAfter1 === 'auto', '自动确认后状态变为 auto');

  // 未到期的不能误伤
  chk(r.after.s2.confirmed === false, '剩 6 小时的不被自动确认');
  chk(r.after.s2.reminded === true, '剩 6 小时的已写入提醒时间 reminded_at');
  chk(r.after.s3.confirmed === false && r.after.s3.reminded === false, '剩 30 小时的完全不动');
  chk(r.after.s4.auto === false, '已手动确认的不被改写成自动确认');

  // 联动已讲解
  chk(r.after.rec101 === 'done' && r.after.rec102 === 'done', '自动确认后关联记录置为已讲解（101/102）');
  chk(r.after.rec106 === 'done', '老数据自动确认后记录也置为已讲解（106）');
  chk(r.after.rec103 === 'pending', '未到期的不动记录状态（103）');
  chk(r.after.rec104 === 'pending', '未到期的不动记录状态（104）');
  chk(r.after.rec105 === 'done', '原本已讲解的不受影响（105）');

  // 通知
  const titles = r.after.notes.map(n => n.title);
  chk(titles.some(t => t.indexOf('已超时自动确认') > -1), '自动确认后发出通知');
  chk(titles.some(t => t.indexOf('即将超时') > -1), '到期前发出催办提醒');
  chk(r.after.notes.filter(n => n.to === 'u-甲').length === 1, '通知发给对应客服（客服甲）');
  chk(r.after.notes.filter(n => n.to === 'u-丙').length === 0, '未到期的不发通知（客服丙）');

  // 汇总弹窗
  chk(r.after.kpiAuto === '2', 'KPI「自动确认」= 2（实际 ' + r.after.kpiAuto + '）');
  chk(r.after.kpiConfirmed === '1', 'KPI「已确认」= 1（实际 ' + r.after.kpiConfirmed + '）');
  chk(r.after.kpiPending === '2', 'KPI「待确认」= 2（实际 ' + r.after.kpiPending + '）');
  chk(r.after.kpiOverdue === '0', 'KPI「逾期未确认」= 0（实际 ' + r.after.kpiOverdue + '）');
  chk(r.after.hasAutoLabel, '列表显示「⏰ 已自动确认」标签');
  chk(r.after.autoRows === 2, '自动确认行数 = 2（实际 ' + r.after.autoRows + '）');
  chk(r.after.pendingShowsCountdown, '待确认行显示剩余倒计时');
  chk(r.after.remindedMark, '已催过的显示「已催」标记');

  const real = errors.filter(e => e.indexOf('ERR_NAME_NOT_RESOLVED') < 0 && e.indexOf('favicon') < 0 && e.indexOf('Failed to load resource') < 0);
  chk(real.length === 0, '无 JS 报错' + (real.length ? '：' + JSON.stringify(real.slice(0, 3)) : ''));

  console.log('\n断言: pass=' + pass + ' fail=' + fail);

  // 截图：确认状态弹窗 + 批量栏的超时选择
  await page.evaluate(() => {
    document.getElementById('confirmStatusModal').classList.add('active');
    document.getElementById('bulkBar').classList.add('show');
    const cnt = document.getElementById('bulkCount'); if (cnt) cnt.textContent = '已选 3 条';
    window.scrollTo(0, 0);
  });
  await new Promise(r2 => setTimeout(r2, 400));
  await page.screenshot({ path: path.join(ROOT, 'outputs', 'qc-autoconfirm-status.png') });
  await page.evaluate(() => { document.getElementById('confirmStatusModal').classList.remove('active'); });
  await new Promise(r2 => setTimeout(r2, 200));
  await page.screenshot({ path: path.join(ROOT, 'outputs', 'qc-autoconfirm-bulkbar.png') });

  await browser.close();
  server.close();
})();
