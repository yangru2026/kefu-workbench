// 冒烟：最新题库注入 + 试卷五人工评分（本地 file:// 加载 quiz.html）
const puppeteer = require('puppeteer-core');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FILE = 'file:///' + path.resolve(__dirname, '..', 'quiz.html').replace(/\\/g, '/');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', async (d) => { await d.accept(); }); // 桩掉 confirm
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1200));

  const basic = await page.evaluate(() => ({
    papers: PAPERS.map(p => ({ key: p.meta.key, counts: p.meta.counts, total: p.meta.total,
      types: p.questions.reduce((m, q) => (m[q.type] = (m[q.type] || 0) + 1, m), {}) })),
    tabs: document.querySelectorAll('.ptab').length,
    curKey: QUIZ.meta.key,
  }));
  console.log('卷:', JSON.stringify(basic.papers, null, 1));
  console.log('tabs=' + basic.tabs, '默认卷=' + basic.curKey);

  // 切到试卷五（第5个 tab）——先模拟已交卷 1-4，否则会被顺序解锁拦截
  await page.evaluate(() => { ['exam-一', 'exam-二', 'exam-三', 'exam-四'].forEach(k => doneKeys.add(k)); calcUnlock(); renderTabs(); });
  await page.evaluate(() => switchPaper(4));
  await new Promise((r) => setTimeout(r, 400));
  const p5 = await page.evaluate(() => ({
    key: QUIZ.meta.key, manual: MANUAL_GRADE(),
    ta: document.querySelectorAll('textarea.ta').length,
    selfSel: document.querySelectorAll('select.self').length,
    hintHasManual: document.body.innerHTML.includes('主管人工评分'),
  }));
  console.log('试卷五:', JSON.stringify(p5));

  // 判分（全部不答）→ 应全为 review、got=0，分数框显示待评
  await page.evaluate(() => grade());
  await new Promise((r) => setTimeout(r, 300));
  const graded = await page.evaluate(() => ({
    rows: (window.__qRes || []).map(r => r.kind),
    scoreBox: document.getElementById('scoreBox').innerText.replace(/\s+/g, ' ').slice(0, 120),
  }));
  console.log('判分 kinds:', JSON.stringify(graded.rows));
  console.log('分数框:', graded.scoreBox);

  // 试卷二简答仍是自评（先模拟交过试卷一解锁）
  await page.evaluate(() => { doneKeys.add('exam-一'); calcUnlock(); renderTabs(); });
  await page.evaluate(() => switchPaper(1));
  await new Promise((r) => setTimeout(r, 400));
  const p2 = await page.evaluate(() => ({
    key: QUIZ.meta.key, manual: MANUAL_GRADE(),
    selfSelAfterGrade: (grade(), document.querySelectorAll('select.self').length),
    selfKinds: (window.__qRes || []).filter(r => r.kind === 'self').length,
  }));
  console.log('试卷二:', JSON.stringify(p2));

  await page.screenshot({ path: 'outputs/smoke-quiz-manual.png', fullPage: false });
  await browser.close();

  const t5 = basic.papers[4], t1 = basic.papers[0];
  const ok =
    t1.key === 'exam-一' && t1.counts === 25 && t1.total === 100 &&
    t5.key === 'exam-五' && t5.counts === 10 && t5.total === 100 && t5.types.text === 10 &&
    p5.manual === true && p5.ta === 10 && p5.selfSel === 0 && p5.hintHasManual &&
    graded.rows.length === 10 && graded.rows.every(k => k === 'review') &&
    graded.scoreBox.includes('人工评分') &&
    p2.manual === false && p2.selfSelAfterGrade === 4 && p2.selfKinds === 4 &&
    errs.length === 0;
  console.log('JS报错:', errs.length ? errs : '无');
  console.log(ok ? '✅ 冒烟全部通过' : '❌ 有断言失败');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('崩溃', e.message); process.exit(1); });
