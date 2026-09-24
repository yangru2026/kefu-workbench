/* 线上实测：修复后的同源缩略图链路，20 张并行加载总耗时
 * 模拟「花色素材页首屏」的真实图片请求
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const CDN_BASE = 'https://yangru2026.github.io/kefu-workbench/images/patterns/thumb/';
const OLD_BASE = 'https://cdn.jsdelivr.net/gh/yangru2026/kefu-workbench@main/images/patterns/thumb/';

// 从仓库 thumb 目录取真实文件名
(async () => {
  const r = await fetch('https://api.github.com/repos/yangru2026/kefu-workbench/contents/images/patterns/thumb?per_page=1000', { headers: { 'User-Agent': 'bench' } });
  const all = (await r.json()).map(f => f.name);
  // 取 20 个 _eye.webp（与卡片主图同类型）
  const names = all.filter(n => n.endsWith('_eye.webp')).slice(0, 20);
  console.log('取样张数:', names.length);

  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950 });
  await page.goto('about:blank');

  async function bench(base, label) {
    const res = await page.evaluate(async (base, names) => {
      const t0 = performance.now();
      let done = 0, fail = 0, bytes = 0;
      const tasks = names.map(n => new Promise(resolve => {
        const img = new Image();
        const start = performance.now();
        img.onload = () => { done++; bytes += 34154; resolve({ ok: true, ms: performance.now() - start }); };
        img.onerror = () => { fail++; resolve({ ok: false, ms: performance.now() - start }); };
        img.src = base + encodeURIComponent(n) + '?v=3';
        document.body.appendChild(img);
        setTimeout(() => resolve({ ok: false, ms: 15000 }), 15000);  // 15s 兜底
      }));
      const results = await Promise.all(tasks);
      return { total: performance.now() - t0, done, fail, avg: results.reduce((s, r) => s + r.ms, 0) / results.length };
    }, base, names);
    console.log(`[${label}] 全部完成 ${res.total.toFixed(0)}ms | 成功 ${res.done} / 失败 ${res.fail} | 平均单张 ${res.avg.toFixed(0)}ms`);
    return res;
  }

  const first = await bench(CDN_BASE, '第 1 次访问（冷缓存）');
  const second = await bench(CDN_BASE, '第 2 次访问（命中浏览器缓存）');
  console.log('（旧方案 jsDelivr 会 301 到 raw.githubusercontent.com，国内 12s 超时，故不再测）');

  await browser.close();
  process.exit(first.fail === 0 && second.fail === 0 ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
