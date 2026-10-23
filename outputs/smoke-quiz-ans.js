// 本地冒烟：quiz.html（ansTextOf 正确性 + 无 JS 报错）与 quiz-results.html（bankOf/PAPER_ANS 生效 + 无 JS 报错）
const puppeteer = require('puppeteer-core');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const Q = 'file:///' + path.resolve(__dirname, '..', 'quiz.html').replace(/\\/g, '/');
const R = 'file:///' + path.resolve(__dirname, '..', 'quiz-results.html').replace(/\\/g, '/');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  let fail = 0;

  // ---- quiz.html ----
  {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(Q, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1500));
    const res = await page.evaluate(() => {
      const found = [];
      for (const p of PAPERS) {
        for (const q of p.questions || []) {
          if (q.stem && q.stem.includes('这款大不大')) found.push({ key: p.meta.key, no: q.no, correct: ansTextOf(q) });
        }
      }
      return {
        papers: PAPERS.length,
        tabs: document.querySelectorAll('.ptab').length,
        found,
        hasFn: typeof ansTextOf === 'function',
      };
    });
    console.log('[quiz.html] papers=' + res.papers + ' tabs=' + res.tabs + ' ansTextOf=' + res.hasFn);
    res.found.forEach((f) => console.log('  ' + f.key + ' #' + f.no + ' correct=' + f.correct));
    const ok = res.hasFn && res.papers === 5 && res.found.length === 1 && /B\. 着色直径/.test(res.found[0].correct) && errs.length === 0;
    console.log('  JS报错:', errs.length ? errs : '无', ok ? '✅' : '❌');
    if (!ok) fail = 1;
    await page.close();
  }

  // ---- quiz-results.html ----
  {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(R, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1500));
    const res = await page.evaluate(() => {
      // 模拟宋思羽那条：exam-一 第18题，detail 无 correct（旧提交）
      const fakeR = { quiz_key: 'exam-一', detail: [] };
      const fakeX = { no: 18 };
      const b = bankOf(fakeR, fakeX);
      // 模拟新提交自带 correct
      const b2 = Object.assign({}, bankOf(fakeR, { no: 18 }), { ans: 'X. 自带' , });
      const b2ans = ('correct' in {}) ? '' : 'X. 自带';
      // 老价格卷回落（quiz_key 不在新库）
      const bOld = bankOf({ quiz_key: 'price-quiz' }, { no: 1 });
      return {
        hasPaperAns: typeof PAPER_ANS === 'object' && Object.keys(PAPER_ANS).length,
        q18: { stem: (b.stem || '').slice(0, 30), ans: b.ans, exp: (b.explain || '').slice(0, 30) },
        oldFallback: bOld ? (bOld.ans || '').slice(0, 20) : '(空)',
      };
    });
    console.log('[quiz-results.html] PAPER_ANS卷数=' + res.hasPaperAns);
    console.log('  exam-一 #18: stem=' + res.q18.stem + ' | 正确答案=' + res.q18.ans + ' | 解析=' + res.q18.exp);
    console.log('  老价格卷回落 #1: ' + res.oldFallback);
    const ok = res.hasPaperAns >= 5 && /着色直径/.test(res.q18.ans) && res.oldFallback.length > 0 && errs.length === 0;
    console.log('  JS报错:', errs.length ? errs : '无', ok ? '✅' : '❌');
    if (!ok) fail = 1;
    await page.close();
  }

  await browser.close();
  process.exit(fail);
})().catch((e) => { console.error('崩溃', e.message); process.exit(1); });
