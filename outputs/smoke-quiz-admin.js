// 冒烟：admin 免锁路径——isExamAdmin=true 后全部解锁、可切卷
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
  page.on('dialog', async (d) => { await d.accept(); });
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1200));

  const before = await page.evaluate(() => ({
    locks: document.querySelectorAll('.ptab.lock').length,
    unlockMax,
  }));
  // 模拟管理员检测成功
  const after = await page.evaluate(() => {
    isExamAdmin = true; calcUnlock(); renderTabs();
    const locks = document.querySelectorAll('.ptab.lock').length;
    switchPaper(4);  // 直接切最后一卷，被锁会 alert（已桩掉 accept）
    return { locks, unlockMax, curKey: QUIZ.meta.key, textareas: document.querySelectorAll('textarea.ta').length };
  });
  console.log('普通身份: locks=' + before.locks + ' unlockMax=' + before.unlockMax);
  console.log('管理员身份: locks=' + after.locks + ' unlockMax=' + after.unlockMax + ' 当前卷=' + after.curKey + ' 简答框=' + after.textareas);
  console.log('JS报错:', errs.length ? errs : '无');
  const ok = before.locks === 4 && before.unlockMax === 0 &&
    after.locks === 0 && after.unlockMax === 4 &&
    /exam-五/.test(after.curKey) && after.textareas === 10 && errs.length === 0;
  console.log(ok ? '✅ 管理员免锁冒烟通过' : '❌ 失败');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('崩溃', e.message); process.exit(1); });
