/* 收卷功能冒烟：quiz.html 交卷上报 + quiz-results.html 主管成绩页
 * 用法：node outputs/smoke-quiz-collect.js
 * 覆盖：
 *  A. 不填姓名 → 拦截交卷、不发上报
 *  B. 填姓名全对 → 上报 payload 正确（姓名/分数/满分/明细 35 条/用时）；自评拉满后满分
 *  C. 上报接口 500 → 显示失败提示且按钮可重试
 *  D. 成绩页未登录 → 遮罩「请先登录」
 *  E. 成绩页非管理员 → 遮罩「仅主管可见」
 *  F. 成绩页管理员 → 汇总卡/列表/详情弹窗/筛选/搜索
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8166;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 150000);

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, p === '/' ? '/quiz.html' : p);
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(buf);
});

let pass = 0, fail = 0;
const check = (n, c, extra) => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (extra ? ' | ' + extra : '')); } };

/* ---------- 假数据：在页面内按 seed 生成，见 stubSupabase 里的 mkRows() ---------- */

/* ---------- 页面内桩 ---------- */
function stubFetch() {
  window.__POSTS__ = [];
  window.__FAIL_POST__ = false;
  window.__ALERTS__ = [];
  window.alert = (m) => { window.__ALERTS__.push(String(m)); };
  const realFetch = window.fetch;
  window.fetch = async (url, opt) => {
    if (String(url).indexOf('quiz_results') >= 0) {
      window.__POSTS__.push({ url: String(url), body: JSON.parse(opt.body) });
      if (window.__FAIL_POST__) return { ok: false, status: 500, text: async () => 'permission denied' };
      return { ok: true, status: 201, text: async () => '' };
    }
    return realFetch ? realFetch(url, opt) : Promise.reject(new Error('no fetch'));
  };
}
function stubSupabase() {
  // ⚠️ 配置只从 URL 读，不从 window 读：evaluateOnNewDocument 注册的脚本会在 page 之间残留，
  //    用 window.__CFG__ 会被上一个场景污染（曾导致 D 的「未登录」泄漏到 E/F）。
  // ⚠️ 假数据不要塞进 URL —— Node 的请求头默认上限 16KB，超了直接 431，页面一片空白。
  //    所以 URL 里只放 `seed=1` 标记，数据在页面里现生成。
  const readCfg = () => {
    try {
      const m = String(location.search || '').match(/[?&]cfg=([^&]*)/);
      if (m) return JSON.parse(decodeURIComponent(m[1]));
    } catch (e) {}
    return {};
  };
  const mkDetail = () => {
    const d = [];
    for (let i = 1; i <= 35; i++) {
      d.push({ no: i, sec: '一、单选题', ans: i <= 30 ? 'A. 测试作答' : '测试文本', got: i <= 27 ? 2 : 0, full: 2, kind: i > 30 ? 'self' : 'auto' });
    }
    return d;
  };
  const mkRows = () => {
    const today = new Date(), yest = new Date(Date.now() - 864e5);
    const base = { quiz_key: 'miyang-color-price', quiz_title: '弥生 · 花色与价格 考核试卷', total: 100, auto_total: 76, self_total: 24 };
    return [
      Object.assign({}, base, { id: 'r1', examinee: '张三', score: 90, auto_score: 70, self_score: 20, duration_sec: 830, detail: mkDetail(), created_at: today.toISOString() }),
      Object.assign({}, base, { id: 'r2', examinee: '李四', score: 60, auto_score: 48, self_score: 12, duration_sec: 1200, detail: mkDetail(), created_at: new Date(today.getTime() - 3600e3).toISOString() }),
      Object.assign({}, base, { id: 'r3', examinee: '张三', score: 70, auto_score: 56, self_score: 14, duration_sec: 900, detail: mkDetail(), created_at: yest.toISOString() })
    ];
  };
  const cfg = () => Object.assign({ loggedIn: true, role: 'admin', rows: [] }, readCfg());
  const mk = (result) => {
    const o = {};
    ['select', 'order', 'limit', 'eq', 'delete', 'insert'].forEach(m => { o[m] = () => o; });
    o.single = async () => result;
    o.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
    return o;
  };
  window.supabase = {
    createClient: () => ({
      auth: {
        getSession: async () => ({
          data: { session: cfg().loggedIn === false ? null : { user: { id: 'u1', email: 'ru@youhe.com', app_metadata: {} } } }
        })
      },
      from: (t) => {
        const c = cfg();
        if (t === 'profiles') return mk({ data: { role: c.role }, error: null });
        if (t === 'quiz_results') return mk({ data: c.seed ? mkRows() : (c.rows || []), error: null });
        return mk({ data: [], error: null });
      }
    })
  };
}

const fillAllCorrect = () => {
  QUIZ.questions.forEach(q => {
    if (q.type === 'single' || q.type === 'judge') {
      const inp = document.querySelector('input[name="q' + q.no + '"][value="' + q.answer + '"]');
      if (inp) inp.click();
    } else if (q.type === 'multi') {
      q.answer.forEach(i => { const inp = document.querySelector('input[name="q' + q.no + '"][value="' + i + '"]'); if (inp) inp.click(); });
    } else if (q.type === 'match') {
      q.pairs.forEach((p, i) => {
        const sel = document.querySelectorAll('select[data-no="' + q.no + '"]')[i];
        sel.value = String.fromCharCode(65 + q.rightOptions.indexOf(p.right));
      });
    }
  });
};

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const errs = [];
  const ctxOf = new Map();
  // 每个场景一个独立 BrowserContext：evaluateOnNewDocument 注册的脚本、缓存、storage 全部隔离
  // （踩过坑：同一个默认上下文里，前一个场景注册的"未登录"配置会残留到后面的页面）
  const newPage = async (opts) => {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    ctxOf.set(p, ctx);
    p.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
    // ⚠️ 必须拦掉 supabase-js 本体（本地 vendor 或境外 CDN 都要拦）：
    //    真库一旦加载成功就会覆盖我们的桩 → getSession() 返回真实空会话 → 偶发「未登录」。
    //    （排查了很久，之前误以为是 evaluateOnNewDocument 跨 page 泄漏）
    await p.setRequestInterception(true);
    p.on('request', (req) => {
      const u = req.url();
      if (u.indexOf('cdn.jsdelivr.net') >= 0 || u.indexOf('supabase.co') >= 0 ||
          u.indexOf('vendor/supabase') >= 0 || u.indexOf('vendor/xlsx') >= 0) {
        req.abort().catch(() => {});
        return;
      }
      req.continue().catch(() => {});
    });
    await p.evaluateOnNewDocument(stubFetch);
    if (!(opts && opts.noSupabaseStub)) await p.evaluateOnNewDocument(stubSupabase);
    await p.evaluateOnNewDocument(() => { window.confirm = () => true; });
    // XLSX 桩：只验证"导出了哪几张表"，不真生成文件
    await p.evaluateOnNewDocument(() => {
      window.__SHEETS__ = [];
      window.XLSX = {
        utils: {
          json_to_sheet: () => ({}),
          book_new: () => ({}),
          book_append_sheet: (wb, ws, name) => { window.__SHEETS__.push(name); }
        },
        writeFile: () => { window.__WROTE__ = true; }
      };
    });
    await p.setViewport({ width: 1280, height: 900 });
    return p;
  };
  const closePage = async (p) => {
    const ctx = ctxOf.get(p);
    try { await p.close(); } catch (e) {}
    if (ctx) { try { await ctx.close(); } catch (e) {} }
    ctxOf.delete(p);
  };
  const U = (f, cfg) => 'http://127.0.0.1:' + PORT + '/' + f +
    (cfg ? ('?cfg=' + encodeURIComponent(JSON.stringify(cfg))) : '');

  /* ============ A. 不填姓名 → 拦截 ============ */
  let page = await newPage();
  await page.goto(U('quiz.html'), { waitUntil: 'domcontentloaded' });
  await sleep(600);
  await page.evaluate(() => { document.getElementById('examinee').value = ''; document.getElementById('btnSubmit').click(); });
  await sleep(300);
  const A = await page.evaluate(() => ({ posts: window.__POSTS__.length, alerts: window.__ALERTS__, score: document.getElementById('scoreBox').textContent }));
  check('A 未填姓名不发上报', A.posts === 0, 'posts=' + A.posts);
  check('A 未填姓名有提示', A.alerts.length === 1 && A.alerts[0].indexOf('考生姓名') >= 0, JSON.stringify(A.alerts));
  check('A 未填姓名不判分', A.score.trim() === '', A.score.slice(0, 40));

  /* ============ B. 填姓名 + 全对 → 上报 ============ */
  await page.goto(U('quiz.html'), { waitUntil: 'domcontentloaded' });
  await sleep(600);
  await page.evaluate(() => { document.getElementById('examinee').value = '王小美'; });
  await page.evaluate(fillAllCorrect);
  await page.evaluate(() => document.getElementById('btnSubmit').click());
  await sleep(500);
  const B1 = await page.evaluate(() => ({
    posts: window.__POSTS__,
    note: document.getElementById('submitNote').textContent,
    btn: document.getElementById('btnSubmit').textContent
  }));
  const p1 = (B1.posts[0] || {}).body || {};
  check('B 成功上报 1 条', B1.posts.length === 1, 'posts=' + B1.posts.length);
  check('B 姓名写入 payload', p1.examinee === '王小美', JSON.stringify(p1.examinee));
  check('B 首次交卷=客观题满分 72（自评未打）', p1.score === 72, 'score=' + p1.score);
  check('B 满分 100', p1.total === 100, 'total=' + p1.total);
  check('B 逐题明细 35 条', Array.isArray(p1.detail) && p1.detail.length === 35, 'len=' + (p1.detail || []).length);
  check('B 明细含作答与得分', !!p1.detail && p1.detail.every(d => typeof d.ans === 'string' && d.ans.length > 0 && typeof d.got === 'number' && typeof d.full === 'number'), 'sample=' + JSON.stringify((p1.detail || [])[0]));
  check('B 明细含自主题标记', !!p1.detail && p1.detail.some(d => d.kind === 'self'), 'self=' + JSON.stringify((p1.detail || []).filter(d => d.kind === 'self').length));
  check('B 客观/主观分值齐全', typeof p1.auto_score === 'number' && typeof p1.self_score === 'number', p1.auto_score + '/' + p1.self_score);
  check('B 用时为秒数', typeof p1.duration_sec === 'number' && p1.duration_sec >= 0, 'dur=' + p1.duration_sec);
  check('B 试卷标识正确', p1.quiz_key === 'miyang-color-price', p1.quiz_key);
  check('B 提交后有成功提示', B1.note.indexOf('已提交') >= 0, B1.note.slice(0, 60));
  check('B 未自评时明确提示补自评', B1.note.indexOf('还没自评') >= 0 && B1.btn.indexOf('自评') >= 0, B1.btn + ' | ' + B1.note.slice(0, 50));

  // 自评拉满后重新交卷 → 满分
  await page.evaluate(() => {
    document.querySelectorAll('select.self').forEach(s => { s.value = s.options[s.options.length - 1].value; s.dispatchEvent(new Event('change')); });
  });
  await sleep(250);
  await page.evaluate(() => document.getElementById('btnSubmit').click());
  await sleep(500);
  const B2 = await page.evaluate(() => ({
    posts: window.__POSTS__,
    btn: document.getElementById('btnSubmit').textContent,
    ls: localStorage.getItem('kefu_quiz_examinee')
  }));
  const last = (B2.posts[B2.posts.length - 1] || {}).body || {};
  check('B 重新交卷再记一条', B2.posts.length === 2, 'posts=' + B2.posts.length);
  check('B 自评拉满后总分 100', last.score === 100, 'score=' + last.score);
  check('B 自评完成后按钮变回重新交卷', B2.btn.indexOf('重新交卷') >= 0, B2.btn);
  check('B 姓名被记住', B2.ls === '王小美', String(B2.ls));

  /* ============ C. 上报失败 → 提示可重试 ============ */
  await page.evaluate(() => { window.__FAIL_POST__ = true; window.__POSTS__ = []; });
  await page.evaluate(() => document.getElementById('btnSubmit').click());
  await sleep(600);
  const C = await page.evaluate(() => ({
    note: document.getElementById('submitNote').textContent,
    cls: document.getElementById('submitNote').className,
    btn: document.getElementById('btnSubmit').textContent,
    disabled: document.getElementById('btnSubmit').disabled
  }));
  check('C 失败时有错误提示', C.note.indexOf('失败') >= 0 && C.cls.indexOf('err') >= 0, C.note.slice(0, 70));
  check('C 失败后按钮可重试', C.disabled === false && C.btn.indexOf('交卷') >= 0, C.btn + '/' + C.disabled);
  await closePage(page);

  /* ============ D. 成绩页：未登录 ============ */
  page = await newPage();
  await page.goto(U('quiz-results.html', { loggedIn: false }), { waitUntil: 'domcontentloaded' });
  await sleep(800);
  const D = await page.evaluate(() => ({
    maskShown: document.getElementById('mask').classList.contains('show'),
    title: document.getElementById('maskTitle').textContent,
    mainHidden: document.getElementById('main').style.display === 'none'
  }));
  check('D 未登录显示遮罩', D.maskShown, JSON.stringify(D));
  check('D 提示先登录', D.title.indexOf('登录') >= 0, D.title);
  check('D 主区隐藏', D.mainHidden);
  await closePage(page);

  /* ============ E. 成绩页：普通客服 ============ */
  page = await newPage();
  await page.goto(U('quiz-results.html', { role: 'cs' }), { waitUntil: 'domcontentloaded' });
  await sleep(800);
  const E = await page.evaluate(() => ({
    search: decodeURIComponent(location.search || '').slice(0, 30),
    maskShown: document.getElementById('mask').classList.contains('show'),
    title: document.getElementById('maskTitle').textContent,
    mainHidden: document.getElementById('main').style.display === 'none',
    badge: document.getElementById('roleBadge').textContent
  }));
  check('E 非管理员显示遮罩', E.maskShown && E.mainHidden, JSON.stringify(E));
  check('E 提示仅主管可见', E.title.indexOf('主管') >= 0, E.title);
  await closePage(page);

  /* ============ F. 成绩页：管理员 + 有数据 ============ */
  page = await newPage();
  await page.goto(U('quiz-results.html', { role: 'admin', seed: 1 }), { waitUntil: 'domcontentloaded' });
  await sleep(1000);
  const F = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.card')].map(c => c.querySelector('.k').textContent + '=' + c.querySelector('.v').textContent.replace(/\s+/g, ''));
    const recs = [...document.querySelectorAll('#list .rec')].map(r => r.textContent.replace(/\s+/g, ' ').trim());
    return {
      maskShown: document.getElementById('mask').classList.contains('show'),
      roleBadge: document.getElementById('roleBadge').textContent,
      cards, recs,
      cnt: document.getElementById('listCnt').textContent,
      hasExport: !!document.getElementById('btnExport'),
      hasRoster: !!document.getElementById('btnRoster')
    };
  });
  check('F 管理员可进入（无遮罩）', !F.maskShown && F.roleBadge.indexOf('主管') >= 0, F.roleBadge);
  check('F 交卷人数=2 人（今天）', F.cards.some(c => c.indexOf('交卷人数=2人') >= 0), F.cards.join(' | '));
  check('F 平均分=75', F.cards.some(c => c.indexOf('平均分=75分') >= 0), F.cards.join(' | '));
  check('F 合格率=50%', F.cards.some(c => c.indexOf('合格率（≥80）=50%') >= 0), F.cards.join(' | '));
  check('F 未合格 1 人', F.cards.some(c => c.indexOf('未合格=1人') >= 0), F.cards.join(' | '));
  check('F 列表按人汇总 2 行', F.recs.length === 2, 'rows=' + F.recs.length);
  check('F 张三最新分 90 且标合格', F.recs.some(r => r.indexOf('张三') >= 0 && r.indexOf('90') >= 0 && r.indexOf('合格') >= 0), F.recs.join(' || ').slice(0, 170));
  check('F 列表行显示错题数', F.recs.length > 0 && F.recs.every(r => /错\s*\d+\s*题/.test(r)), F.recs.join(' || ').slice(0, 150));
  check('F 导出与名单按钮存在', F.hasExport && F.hasRoster);
  check('F 今天视图不显示历史提交次数', F.recs.every(r => r.indexOf('2 次') < 0), F.recs.join(' || ').slice(0, 120));

  // 近7天（按人汇总）：张三应提示提交 2 次
  await page.evaluate(() => document.querySelector('.chip[data-p="7d"]').click());
  await sleep(300);
  const F2a = await page.evaluate(() => [...document.querySelectorAll('#list .rec')].map(r => r.textContent.replace(/\s+/g, ' ')));
  check('F 近7天按人汇总 2 人', F2a.length === 2, 'rows=' + F2a.length);
  check('F 张三提示提交 2 次', F2a.some(r => r.indexOf('张三') >= 0 && r.indexOf('2 次') >= 0), F2a.join(' || ').slice(0, 170));

  // 近7天 + 全部明细
  await page.evaluate(() => document.querySelector('.tab[data-v="all"]').click());
  await sleep(300);
  const F2 = await page.evaluate(() => ({
    rows: document.querySelectorAll('#list .rec').length,
    cnt: document.getElementById('listCnt').textContent
  }));
  check('F 近7天全部明细 3 条', F2.rows === 3, 'rows=' + F2.rows + ' / ' + F2.cnt);

  // 详情弹窗（回到今天 + 按人汇总）
  await page.evaluate(() => { document.querySelector('.chip[data-p="today"]').click(); document.querySelector('.tab[data-v="person"]').click(); });
  await sleep(300);
  await page.evaluate(() => document.querySelector('#list .rec [data-act="detail"]').click());
  await sleep(400);
  const F3 = await page.evaluate(() => ({
    shown: document.getElementById('modal').classList.contains('show'),
    title: document.getElementById('mTitle').textContent,
    cards: document.querySelectorAll('#mBody .qd').length,
    wrongCards: document.querySelectorAll('#mBody .qd.wrong').length,
    hasToggle: !!document.getElementById('qdWrong'),
    body: document.getElementById('mBody').textContent
  }));
  check('F 答卷明细弹窗打开', F3.shown, JSON.stringify(F3).slice(0, 120));
  check('F 明细 35 题全显示', F3.cards === 35, 'cards=' + F3.cards);
  check('F 明细标注正确答案', F3.body.indexOf('正确答案') >= 0, F3.body.slice(0, 80));
  check('F 明细含题干（题库已注入）', F3.body.indexOf('系列') >= 0 || F3.body.indexOf('花色') >= 0, F3.body.slice(0, 100));
  check('F 明细含解析', F3.body.indexOf('💡') >= 0, F3.body.slice(0, 100));
  check('F 错题被标红', F3.wrongCards === 8, 'wrong=' + F3.wrongCards);
  check('F 有「只看错题」开关', F3.hasToggle);

  // 只看错题
  await page.evaluate(() => {
    const c = document.getElementById('qdWrong'); c.checked = true; c.dispatchEvent(new Event('change'));
  });
  await sleep(300);
  const F3b = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('#mBody .qd')];
    return { cards: nodes.length, allWrong: nodes.every(e => e.classList.contains('wrong')) };
  });
  check('F 只看错题后只剩错题', F3b.cards === 8 && F3b.allWrong, 'cards=' + F3b.cards + ' allWrong=' + F3b.allWrong);
  await page.evaluate(() => document.getElementById('mClose').click());
  await sleep(250);

  // 导出 Excel：应为 3 张表
  await page.evaluate(() => document.getElementById('btnExport').click());
  await sleep(700);
  const F6 = await page.evaluate(() => ({ sheets: window.__SHEETS__, wrote: !!window.__WROTE__, toast: document.getElementById('toast').textContent }));
  check('F 导出含 3 张表', F6.sheets.join(',') === '成绩汇总,逐题明细,错题排行', JSON.stringify(F6.sheets));
  check('F 导出已落盘', F6.wrote, 'wrote=' + F6.wrote);

  // 搜索过滤
  await page.evaluate(() => {
    const i = document.getElementById('q'); i.value = '李四'; i.dispatchEvent(new Event('input'));
  });
  await sleep(300);
  const F4 = await page.evaluate(() => ({ rows: document.querySelectorAll('#list .rec').length, cnt: document.getElementById('listCnt').textContent }));
  check('F 搜索「李四」只剩 1 人', F4.rows === 1, F4.cnt);

  // 删除
  await page.evaluate(() => {
    const i = document.getElementById('q'); i.value = ''; i.dispatchEvent(new Event('input'));
  });
  await sleep(250);
  const F5a = await page.evaluate(() => document.querySelectorAll('#list .rec').length);
  await page.evaluate(() => document.querySelector('#list .rec [data-act="del"]').click());
  await sleep(400);
  const F5 = await page.evaluate(() => ({ rows: document.querySelectorAll('#list .rec').length, toast: document.getElementById('toast').textContent }));
  check('F 删除一条后列表减少', F5.rows === F5a - 1, F5a + ' → ' + F5.rows + ' / ' + F5.toast);
  await closePage(page);

  /* ============ G. 成绩页：supabase 库没加载成功 → 给友好提示而不是白屏 ============ */
  page = await newPage({ noSupabaseStub: true });
  await page.goto(U('quiz-results.html'), { waitUntil: 'domcontentloaded' });
  await sleep(800);
  const G = await page.evaluate(() => ({
    shown: document.getElementById('mask').classList.contains('show'),
    title: document.getElementById('maskTitle').textContent,
    desc: document.getElementById('maskDesc').textContent
  }));
  check('G 库缺失时显示友好提示', G.shown && G.title.indexOf('组件') >= 0, JSON.stringify(G));
  check('G 提示刷新即可', G.desc.indexOf('刷新') >= 0, G.desc);
  await closePage(page);

  check('全程无页面错误', errs.length === 0, errs.join(' ; '));
  console.log('RESULT: pass=' + pass + ' fail=' + fail);
  clearTimeout(wd);
  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
