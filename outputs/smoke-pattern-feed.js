const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8131;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 90000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
  try {
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('not found'); }
});

const json = (obj) => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(obj) });
const now = new Date().toISOString();
const rows = [
  { id: 'a1', brand: '弥生', type: '日抛', name: '奶茶棕', series: '倾慕系列', color: '棕色系', diameter: '14.2', color_diameter: '13.5', material: '硅水凝胶', oxygen: '', water: '', spec: '', base_curve: '8.6', fixed_axis: '', price_tier: '29.9元/副', diam_group: '小直径', lens_img: '', eye_img: '', lens_imgs: ['https://picsum.photos/seed/l1/300/300', 'https://picsum.photos/seed/l2/300/300'], eye_imgs: ['https://picsum.photos/seed/e1/300/300', 'https://picsum.photos/seed/e2/300/300', 'https://picsum.photos/seed/e3/300/300', 'https://picsum.photos/seed/e4/300/300', 'https://picsum.photos/seed/e5/300/300'], thumb_eye_url: '', thumb_lens_url: '', description: '奶茶棕是一款超温柔日抛，日常通勤约会都合适，戴上眼睛显得很有神又不会夸张，敏感眼也可以放心戴哦。这句话特意写得长一点来测试全文收起功能的展开效果，超过七十个字符就会出现全文按钮。', sort_order: 10, is_discontinued: false, created_at: now },
  { id: 'a2', brand: '弥生', type: '月抛', name: '沙漠玫瑰', series: '', color: '粉色系', diameter: '14.0', color_diameter: '13.0', material: '', oxygen: '', water: '', spec: '', base_curve: '8.6', fixed_axis: '', price_tier: '', diam_group: '', lens_imgs: [], eye_imgs: [], thumb_eye_url: '', thumb_lens_url: '', description: '', sort_order: 5, is_discontinued: false, created_at: '2026-07-01T00:00:00Z' }
];

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (req.method() === 'OPTIONS' && u.includes('supabase')) {
      return req.respond({ status: 200, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' }});
    }
    if (u.includes('/rest/v1/pattern_assets')) return req.respond(json(rows));
    if (u.includes('/rest/v1/pattern_categories')) return req.respond(json([
      { id: 'c1', category_type: 'color', name: '棕色系', sort_order: 1 },
      { id: 'c2', category_type: 'color', name: '粉色系', sort_order: 2 }
    ]));
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.evaluate(() => { try { switchPage('patterns'); } catch (e) {} });
  await sleep(3000);

  const out1 = await page.evaluate(() => ({
    chips: [...document.querySelectorAll('#pattern-chips .pf-chip')].map(c => c.textContent.trim()),
    feedCards: document.querySelectorAll('#pattern-grid .pfeed-card').length,
    oldCards: document.querySelectorAll('#pattern-grid .pattern-card').length,
    advCardHidden: document.getElementById('pattern-adv-filters').style.display === 'none',
    imgs: document.querySelectorAll('#pattern-grid .pfeed-img').length,
    hasDownload: !!document.querySelector('.pfeed-btn'),
    downloadLabels: [...document.querySelectorAll('.pfeed-actions .pfeed-btn')].map(b => b.textContent.trim()).slice(0, 4),
    descToggle: !!document.querySelector('.pfeed-desc-toggle'),
    avatar: document.querySelector('.pfeed-avatar') ? document.querySelector('.pfeed-avatar').textContent : null
  }));

  // 点「更多筛选」展开
  await page.evaluate(() => togglePatternAdvFilters());
  await sleep(300);
  const advOpen = await page.evaluate(() => document.getElementById('pattern-adv-filters').style.display === 'block');

  // 点「棕色系」chip
  await page.evaluate(() => { const c = [...document.querySelectorAll('#pattern-chips .pf-chip')].find(x => x.textContent.includes('棕色系')); if (c) c.click(); });
  await sleep(800);
  const out2 = await page.evaluate(() => ({
    activeChip: document.querySelector('#pattern-chips .pf-chip.active') ? document.querySelector('#pattern-chips .pf-chip.active').textContent.trim() : null,
    cardsAfter: document.querySelectorAll('#pattern-grid .pfeed-card').length
  }));

  // 点「最新」chip（a1 是今天上新，a2 是 7 月 → 只剩 1 条）
  await page.evaluate(() => setPatternLatest());
  await sleep(800);
  const out3 = await page.evaluate(() => ({
    activeChip: document.querySelector('#pattern-chips .pf-chip.active') ? document.querySelector('#pattern-chips .pf-chip.active').textContent.trim() : null,
    cardsAfter: document.querySelectorAll('#pattern-grid .pfeed-card').length
  }));

  console.log(JSON.stringify({ out1, advOpen, out2, out3 }, null, 2));
  await page.screenshot({ path: 'outputs/pattern-feed.png' });
  const ok = out1.feedCards === 2 && out1.oldCards === 0 && out1.imgs > 0 && out1.hasDownload && out1.descToggle && advOpen && out2.cardsAfter === 1 && out3.cardsAfter === 1;
  console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
  console.log(ok ? 'FEED_SMOKE_PASS' : 'FEED_SMOKE_FAIL');
  await browser.close(); server.close(); clearTimeout(wd); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
