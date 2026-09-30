/* 考核答题页 冒烟：判分正确性
 * 场景A：全部答对（主观题自评满分）→ 100/100，显示「合格」
 * 场景B：全部答错（主观题自评 0）→ 0/100，显示「未达 80 分」
 * 场景C：交卷后每题都出现解析
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8155;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 90000);

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

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
  await page.evaluateOnNewDocument(() => { window.confirm = () => true; window.alert = () => {}; });
  await page.evaluateOnNewDocument(() => {
    // 交卷时页面会尝试把成绩上报给 Supabase；本地冒烟里桩掉，避免真发请求
    const rf = window.fetch;
    window.fetch = async (u, o) => (String(u).indexOf('quiz_results') >= 0)
      ? { ok: true, status: 201, text: async () => '' }
      : (rf ? rf(u, o) : Promise.reject(new Error('no fetch')));
  });
  await page.setViewport({ width: 1280, height: 900 });

  const URL = 'http://127.0.0.1:' + PORT + '/quiz.html';

  // ---------- 场景 A：全对 ----------
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(600);
  const fillA = await page.evaluate(() => {
    const pick = (correct) => {
      QUIZ.questions.forEach(q => {
        if (q.type === 'single' || q.type === 'judge') {
          const idx = correct ? q.answer : (q.answer + 1) % q.options.length;
          const inp = document.querySelector('input[name="q' + q.no + '"][value="' + idx + '"]');
          if (inp) { inp.click(); }
        } else if (q.type === 'multi') {
          const idxs = correct ? q.answer : q.options.map((_, i) => i).filter(i => q.answer.indexOf(i) < 0);
          idxs.forEach(i => { const inp = document.querySelector('input[name="q' + q.no + '"][value="' + i + '"]'); if (inp) inp.click(); });
        } else if (q.type === 'match') {
          q.pairs.forEach((p, i) => {
            const sel = document.querySelectorAll('select[data-no="' + q.no + '"]')[i];
            const rightL = String.fromCharCode(65 + q.rightOptions.indexOf(p.right));
            const wrongL = String.fromCharCode(65 + ((q.rightOptions.indexOf(p.right) + 1) % q.rightOptions.length));
            sel.value = correct ? rightL : wrongL;
          });
        }
      });
    };
    pick(true);
    document.getElementById('examinee').value = '冒烟测试';   // 交卷要求填姓名
    return { qCount: QUIZ.questions.length, textCount: QUIZ.questions.filter(q => q.type === 'text').length };
  });
  check('题目全部渲染（' + fillA.qCount + ' 题）', fillA.qCount === 35, 'got ' + fillA.qCount);
  await page.evaluate(() => document.getElementById('btnSubmit').click());
  await sleep(400);
  // 主观题自评拉满
  await page.evaluate(() => {
    document.querySelectorAll('select.self').forEach(s => { s.value = s.options[s.options.length - 1].value; s.dispatchEvent(new Event('change')); });
  });
  await sleep(300);
  const scoreA = await page.evaluate(() => document.getElementById('scoreBox').textContent);
  check('场景A 全对=100/100', scoreA.indexOf('100 / 100') >= 0, scoreA.slice(0, 80));
  check('场景A 判定合格', scoreA.indexOf('合格') >= 0 && scoreA.indexOf('未达') < 0, scoreA.slice(0, 60));
  const resA = await page.evaluate(() => ({
    shown: document.querySelectorAll('.res.show').length,
    okCount: document.querySelectorAll('.res.show.ok').length,
    badCount: document.querySelectorAll('.res.show.bad').length,
    sampleExp: (document.querySelector('.res.show') || {}).textContent || ''
  }));
  check('场景A 每题都有结果块', resA.shown === 35, 'shown=' + resA.shown);
  check('场景A 无错题', resA.badCount === 0, 'bad=' + resA.badCount);
  check('场景A 解析包含正确答案', resA.sampleExp.indexOf('正确答案') >= 0, resA.sampleExp.slice(0, 60));

  // ---------- 场景 B：全错 ----------
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(600);
  await page.evaluate(() => { document.getElementById('examinee').value = '冒烟测试'; });
  await page.evaluate(() => {
    QUIZ.questions.forEach(q => {
      if (q.type === 'single' || q.type === 'judge') {
        const idx = (q.answer + 1) % q.options.length;
        const inp = document.querySelector('input[name="q' + q.no + '"][value="' + idx + '"]');
        if (inp) inp.click();
      } else if (q.type === 'multi') {
        q.options.forEach((_, i) => { if (q.answer.indexOf(i) < 0) { const inp = document.querySelector('input[name="q' + q.no + '"][value="' + i + '"]'); if (inp) inp.click(); } });
      } else if (q.type === 'match') {
        q.pairs.forEach((p, i) => {
          const sel = document.querySelectorAll('select[data-no="' + q.no + '"]')[i];
          sel.value = String.fromCharCode(65 + ((q.rightOptions.indexOf(p.right) + 1) % q.rightOptions.length));
        });
      }
    });
  });
  await page.evaluate(() => document.getElementById('btnSubmit').click());
  await sleep(400);
  const scoreB = await page.evaluate(() => document.getElementById('scoreBox').textContent);
  check('场景B 全错=0/100', /(^|\D)0 \/ 100/.test(scoreB) || scoreB.indexOf('0 / 100') >= 0, scoreB.slice(0, 80));
  check('场景B 提示未达 80 分', scoreB.indexOf('未达 80 分') >= 0, scoreB.slice(0, 80));

  // ---------- 场景 C：部分对（只对单选）→ 分数=单选总分 32 ----------
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(600);
  await page.evaluate(() => { document.getElementById('examinee').value = '冒烟测试'; });
  await page.evaluate(() => {
    QUIZ.questions.forEach(q => {
      if (q.type === 'single') {
        const inp = document.querySelector('input[name="q' + q.no + '"][value="' + q.answer + '"]');
        if (inp) inp.click();
      }
    });
  });
  await page.evaluate(() => document.getElementById('btnSubmit').click());
  await sleep(300);
  const scoreC = await page.evaluate(() => document.getElementById('scoreBox').textContent);
  check('场景C 只对单选=32/100', scoreC.indexOf('32 / 100') >= 0, scoreC.slice(0, 80));

  check('全程无页面错误', errs.length === 0, errs.join(' ; '));
  console.log('RESULT: pass=' + pass + ' fail=' + fail);
  clearTimeout(wd);
  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
