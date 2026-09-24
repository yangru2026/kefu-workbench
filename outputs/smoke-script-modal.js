/* 话术编辑弹窗防误关 + 草稿恢复 冒烟
 * 场景1：mousedown 在输入框 + click 在遮罩（模拟拖动选文字拖出弹窗松手）→ 弹窗必须仍打开
 * 场景2：mousedown+click 都在遮罩同位置（真点空白）→ 弹窗应关闭
 * 场景3：输入内容 → 自动存草稿 → 关闭重开 → 自动恢复
 */
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8141;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wd = setTimeout(() => { console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 90000);

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
  try {
    const data = fs.readFileSync(file);
    const mime = p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('nf'); }
});
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--proxy-bypass-list=*']
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR:' + e.message));
  page.on('dialog', d => d.accept());
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (req.method() === 'OPTIONS' && u.includes('supabase')) return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (u.includes('/rest/v1/')) return req.respond(json([]));
    if (u.includes('/auth/v1/')) return req.respond(json({}));
    req.continue();
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await sleep(4500);

  // ── 场景1：拖动选文字拖出弹窗松手 → 不应关闭
  await page.evaluate(() => { try { openScriptEditor(null); } catch (e) { console.log('open fail', e.message); } });
  await sleep(300);
  const s1 = await page.evaluate(() => {
    const mask = document.getElementById('mod-script');
    const ta = document.getElementById('sf-style-标准');
    if (!ta) return { err: 'no textarea' };
    ta.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 300 }));
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 20 }));
    return { stillOpen: mask.classList.contains('show') };
  });

  // ── 场景2：真点遮罩空白 → 应关闭
  const s2 = await page.evaluate(() => {
    const mask = document.getElementById('mod-script');
    mask.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 15, clientY: 15 }));
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 15, clientY: 15 }));
    return { closed: !mask.classList.contains('show') };
  });

  // ── 场景3：草稿自动保存 + 重开恢复
  await page.evaluate(() => { try { localStorage.removeItem('kefu_script_draft_v1'); } catch (e) {} });
  await page.evaluate(() => { try { openScriptEditor(null); } catch (e) {} });
  await sleep(200);
  await page.evaluate(() => {
    document.getElementById('sf-title').value = '测试场景标题ABC';
    document.getElementById('sf-style-标准').value = '您好亲，这款美瞳是……（测试草稿）';
    document.getElementById('mod-script-body').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(600);   // 防抖 300ms
  await page.evaluate(() => { try { closeModal('mod-script'); } catch (e) {} });
  await sleep(200);
  await page.evaluate(() => { try { openScriptEditor(null); } catch (e) {} });
  await sleep(300);
  const s3 = await page.evaluate(() => ({
    titleRestored: document.getElementById('sf-title').value === '测试场景标题ABC',
    styleRestored: document.getElementById('sf-style-标准').value.indexOf('测试草稿') > -1,
  }));
  // 保存后草稿应清除（模拟 saveScript 的清理路径）
  const s4 = await page.evaluate(() => { try { clearScriptDraft('new'); } catch (e) {} return localStorage.getItem('kefu_script_draft_v1') === null; });

  console.log(JSON.stringify({ s1, s2, s3, draftCleared: s4 }, null, 2));
  console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
  const ok = s1.stillOpen === true && s2.closed === true && s3.titleRestored && s3.styleRestored && s4
    && errs.filter(e => !e.includes('supabase')).length === 0;
  console.log(ok ? 'SCRIPT_MODAL_SMOKE_PASS' : 'SCRIPT_MODAL_SMOKE_FAIL');
  await browser.close(); server.close(); clearTimeout(wd); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH:' + e.message); process.exit(2); });
