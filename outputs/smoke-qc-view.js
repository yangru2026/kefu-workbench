/**
 * qc-view.html 无头冒烟（2026-11-03）
 * mock qc-evidence?json=1 + 一张 1080x6000 的长图（本地 canvas 生成不了，用 1px 拉伸 PNG 即可——
 * 用 data URL 生成 via canvas.toDataURL 太麻烦，直接用 SVG data URL 当图）
 * 断言：无页面异常、图加载、qvSet/qvZoomIn/qvReadMode/qvToggleMg 可调、
 *       放大镜 mousemove 后镜片显示、按钮 onclick 不再 ReferenceError
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = { '.html': 'text/html; charset=utf-8' };

// 1080x6000 的 SVG 长图（浏览器可解码，naturalWidth/Height 真实）
const IMG = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="6000"><rect width="1080" height="6000" fill="#f3f4f6"/><text x="100" y="200" font-size="40" fill="#111">测试文字 ABC 123</text></svg>'
).toString('base64');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const out = { assertions: [] };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e && e.message || e)));
    await page.setRequestInterception(true);
    // 1x1 真 PNG（给「✨ 增强清晰」的原图字节链路用）
    const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    page.on('request', req => {
      const u = req.url();
      try {
        if (u.includes('/functions/v1/qc-evidence')) {
          if (u.includes('json=1')) {
            return req.respond({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ ok: true, url: IMG, name: '长图测试' }) });
          }
          // 不带 json=1 = 原图字节代理（增强清晰用）
          return req.respond({ status: 200, headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' }, body: PNG1 });
        }
        req.continue().catch(() => {});
      } catch (e) { req.continue().catch(() => {}); }
    });

    await page.goto('file:///' + path.join(ROOT, 'qc-view.html').replace(/\\/g, '/') + '?id=rec1&t=tok', { waitUntil: 'domcontentloaded' });
    await sleep(1800);

    const ev = (fn, t) => Promise.race([page.evaluate(fn).catch(e => ({ err: String(e && e.message || e) })), new Promise(r => setTimeout(() => r({ timeout: true }), t || 6000))]);
    const ok = (name, cond, extra) => out.assertions.push({ name, pass: !!cond, extra: extra || '' });

    const s1 = await ev(() => ({
      loaded: !!document.getElementById('im') && document.getElementById('im').naturalWidth > 0,
      nw: document.getElementById('im') ? document.getElementById('im').naturalWidth : 0,
      nh: document.getElementById('im') ? document.getElementById('im').naturalHeight : 0,
      pct: document.getElementById('pct').textContent
    }));
    ok('图已加载（1080x6000）', s1.loaded && s1.nw === 1080 && s1.nh === 6000, JSON.stringify(s1));
    ok('默认原图 100%', s1.pct === '100%');

    // 按钮链路：qv* 全局存在 + 调用不抛错（⚠️ 别用索引点 #bar button——
    // 按钮顺序会变，2026-11-03 就曾误触「增强清晰」导致后面断言全乱）
    const s2 = await ev(() => {
      const has = ['qvSet','qvFitW','qvFit','qvZoomIn','qvZoomOut','qvToggleMg','qvReadMode','qvSharpen'].every(k => typeof window[k] === 'function');
      window.qvZoomIn();
      window.qvZoomOut();
      return { has, pct: document.getElementById('pct').textContent };
    });
    ok('qv* 全局函数齐 + 调用无异常', s2.has && typeof s2.pct === 'string', JSON.stringify(s2));

    // 放大镜：开（第一次=2x）→ mousemove → 镜片显示且背景按 2x 缩放
    const s3 = await ev(() => {
      window.qvSet(0.5);   // 缩到 50%，模拟长图缩略态
      window.qvToggleMg(); // 关→2x
      const im = document.getElementById('im');
      const r = im.getBoundingClientRect();
      const ev2 = new MouseEvent('mousemove', { clientX: r.left + r.width / 2, clientY: r.top + 300, bubbles: true });
      document.getElementById('wrap').dispatchEvent(ev2);
      const lens = document.getElementById('lens');
      return { shown: lens.style.display === 'block', size: lens.style.backgroundSize, label: document.getElementById('mgbtn').textContent };
    });
    ok('放大镜镜片出现', s3.shown === true, JSON.stringify(s3));
    ok('镜片按 2x 原图缩放（1080*2=2160）', /2160px/.test(s3.size), s3.size);
    ok('按钮显示 2x', /2x/.test(s3.label));
    // 再切一次 → 3x
    const s3b = await ev(() => {
      window.qvToggleMg();
      const im = document.getElementById('im');
      const r = im.getBoundingClientRect();
      document.getElementById('wrap').dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 50, clientY: r.top + 100, bubbles: true }));
      return { size: document.getElementById('lens').style.backgroundSize, label: document.getElementById('mgbtn').textContent };
    });
    ok('再点切到 3x（1080*3=3240）', /3240px/.test(s3b.size), JSON.stringify(s3b));

    // 阅读模式：z 封顶 100%，显示宽度=原图宽
    const s4 = await ev(() => {
      window.qvReadMode();
      const im = document.getElementById('im');
      return { w: im.clientWidth, pct: document.getElementById('pct').textContent };
    });
    ok('阅读模式 = 原始清晰度（宽 1080）', s4.w === 1080 && s4.pct === '100%', JSON.stringify(s4));

    // ✨ 增强清晰：走代理拉原图字节 → canvas 锐化 → im.src 换成增强版；再点还原
    const s5 = await ev(async () => {
      const before = document.getElementById('im').src.slice(0, 30);
      await window.qvSharpen();
      const im = document.getElementById('im');
      const after = im.src.slice(0, 22);
      const btnText = document.getElementById('shbtn').textContent;
      await window.qvSharpen();   // 还原
      const restored = document.getElementById('im').src.slice(0, 30);
      return { before, after, btnText, restored };
    }, 12000);
    ok('增强清晰：src 换成锐化 dataURL', /data:image\/png/.test(s5.after || ''), JSON.stringify(s5));
    ok('增强按钮显示「已增强」', /已增强/.test(s5.btnText || ''));
    ok('再点一次还原原图', (s5.restored || '') === (s5.before || ''));

    ok('无未捕获页面异常', errs.length === 0, errs.slice(0, 3).join(' | '));
    out.pageErrors = errs.slice(0, 5);
  } catch (e) {
    out.fatal = String(e && e.stack || e);
  } finally {
    await browser.close().catch(() => {});
  }
  const pass = out.assertions.filter(a => a.pass).length;
  const fail = out.assertions.filter(a => !a.pass);
  console.log('=== qc-view 冒烟 ===');
  out.assertions.forEach(a => console.log((a.pass ? 'PASS ' : 'FAIL ') + a.name + (a.extra && !a.pass ? '  [' + a.extra + ']' : '')));
  console.log('--- ' + pass + ' / ' + out.assertions.length + ' 通过');
  if (out.fatal) console.log('FATAL: ' + out.fatal);
  if (out.pageErrors && out.pageErrors.length) console.log('pageErrors: ' + JSON.stringify(out.pageErrors));
  process.exit(fail.length ? 1 : 0);
})();
