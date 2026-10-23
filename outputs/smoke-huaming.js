// 冒烟：花名速查页（本地 file://）——统计、搜索、筛选、徽章
const puppeteer = require('puppeteer-core');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FILE = 'file:///' + path.resolve(__dirname, '..', 'huaming.html').replace(/\\/g, '/');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));

  const s0 = await page.evaluate(() => ({
    total: DATA.length,
    cards: document.querySelectorAll('.card').length,
    statText: document.querySelector('.stats').innerText.replace(/\s+/g, ' '),
    seriesOpts: document.querySelectorAll('#seriesSel option').length,
  }));
  console.log('初始:', JSON.stringify(s0));

  // 搜索"乌托邦"
  await page.type('#q', '乌托邦');
  await new Promise((r) => setTimeout(r, 300));
  const s1 = await page.evaluate(() => {
    const c = document.querySelector('.card');
    return { cnt: document.getElementById('cnt').textContent,
             tag: c && c.querySelector('.tag').textContent, cls: c && c.className };
  });
  console.log('搜乌托邦:', JSON.stringify(s1));

  // 清空搜索 → 筛"定轴款"
  await page.evaluate(() => { document.getElementById('q').value = ''; document.getElementById('q').dispatchEvent(new Event('input')); });
  await page.click('.chip.dz');
  await new Promise((r) => setTimeout(r, 300));
  const s2 = await page.evaluate(() => ({
    cnt: document.getElementById('cnt').textContent,
    allDz: [...document.querySelectorAll('.card .tag')].every(t => t.textContent === '定轴'),
  }));
  console.log('筛定轴:', JSON.stringify(s2));

  // 筛日抛
  await page.evaluate(() => { document.querySelector('.chip[data-kind=""]').click(); });
  await page.click('.chip[data-toss="日抛"]');
  await new Promise((r) => setTimeout(r, 300));
  const s3 = await page.evaluate(() => ({
    cnt: document.getElementById('cnt').textContent,
    allDaily: [...document.querySelectorAll('.card')].every(c => c.querySelector('.meta b').textContent === '日抛'),
  }));
  console.log('筛日抛:', JSON.stringify(s3));

  // 系列筛选
  await page.evaluate(() => { document.querySelector('.chip[data-toss=""]').click(); });
  await page.evaluate(() => { const s = document.getElementById('seriesSel'); s.value = '少女漫'; s.dispatchEvent(new Event('change')); });
  await new Promise((r) => setTimeout(r, 300));
  const s4 = await page.evaluate(() => ({
    cnt: document.getElementById('cnt').textContent,
    allSeries: [...document.querySelectorAll('.card')].every(c => c.innerText.includes('少女漫')),
  }));
  console.log('筛系列少女漫:', JSON.stringify(s4));

  await page.screenshot({ path: 'outputs/smoke-huaming.png', fullPage: false });
  await browser.close();

  const ok = s0.total === 170 && s0.cards === 170 && s0.seriesOpts === 10 &&
    s1.tag === '定轴' && s1.cls.includes('dz') &&
    s2.cnt.startsWith('匹配 25') && s2.allDz &&
    s3.cnt.startsWith('匹配 47') && s3.allDaily &&
    s4.allSeries && errs.length === 0;
  console.log('JS报错:', errs.length ? errs : '无');
  console.log(ok ? '✅ 花名速查冒烟通过' : '❌ 有断言失败');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('崩溃', e.message); process.exit(1); });
