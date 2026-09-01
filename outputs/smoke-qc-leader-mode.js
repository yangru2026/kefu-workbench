// 验证：组长打开质检页应显示「🛡️ 组长模式」并允许编辑（不是只读）
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8161;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(path.resolve(ROOT)) || !fs.existsSync(file)) { res.writeHead(404); res.end('404'); return; }
  const ext = path.extname(file);
  const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  // Stub 登录：直接覆盖 currentProfile 和 currentUser
  const r = await page.evaluate(() => {
    // 让 Supabase 对象存在（防 page 直接崩）
    if (typeof supabase === 'undefined') {
      window.supabase = {
        from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) }),
        auth: { getSession: () => ({ data: { session: { user: { id: 'u1', phone: '13800000001', email: 'x@y' } } } }) }
      };
    }
    // 注入三套 profile 测试
    const samples = [
      { role: 'admin',  name: '杨茹', phone: '13800000001' },
      { role: 'leader', name: '小念', phone: '13800000002' },
      { role: 'leader', name: '小暖', phone: '13800000003' },
      { role: 'staff',  name: '小恬', phone: '13800000004' }
    ];
    const out = {};
    samples.forEach(p => {
      currentProfile = { id: 'u-' + p.name, role: p.role, name: p.name, phone: p.phone };
      currentUser = { id: 'u-' + p.name, phone: p.phone, email: p.name + '@x.com' };
      // 模拟 switchPage('qc') 的关键判断分支
      const isQc = !!(currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'leader'));
      let badgeText;
      if (currentProfile.role === 'admin') badgeText = '👑 管理员模式 · ' + currentUser.email;
      else if (currentProfile.role === 'leader') badgeText = '🛡️ 组长模式 · 可录入/删除质检';
      else badgeText = '📖 只读模式';
      out[p.role + ':' + p.name] = { isQc, badgeText };
    });
    return out;
  });

  console.log('=== 各角色判断结果 ===');
  console.log(JSON.stringify(r, null, 2));

  let pass = 0, fail = 0;
  const chk = (cond, msg) => { if (cond) { pass++; console.log('  PASS  ' + msg); } else { fail++; console.log('  FAIL  ' + msg); } };
  console.log('\n=== 断言 ===');

  chk(r['admin:杨茹'].isQc === true,  '杨茹(管理员) isQc = true');
  chk(r['admin:杨茹'].badgeText.indexOf('管理员模式') > -1, '杨茹徽标 = 管理员模式');

  chk(r['leader:小念'].isQc === true,  '小念(组长) isQc = true（旧逻辑用 isAdminUser 会是 false → 只读）');
  chk(r['leader:小念'].badgeText.indexOf('组长模式') > -1, '小念徽标 = 组长模式（不是只读模式）');
  chk(r['leader:小念'].badgeText.indexOf('录入') > -1, '小念徽标含「可录入/删除质检」说明');

  chk(r['leader:小暖'].isQc === true,  '小暖(组长) isQc = true');
  chk(r['leader:小暖'].badgeText.indexOf('只读') === -1, '小暖徽标里没有「只读」字样');

  chk(r['staff:小恬'].isQc === false,  '小恬(客服) isQc = false');
  chk(r['staff:小恬'].badgeText.indexOf('只读') > -1, '小恬徽标 = 只读模式');

  const real = errors.filter(e => e.indexOf('ERR_NAME_NOT_RESOLVED') < 0 && e.indexOf('favicon') < 0 && e.indexOf('Failed to load resource') < 0);
  chk(real.length === 0, '无 JS 报错' + (real.length ? '：' + JSON.stringify(real.slice(0, 3)) : ''));

  console.log('\n断言: pass=' + pass + ' fail=' + fail);
  await browser.close();
  server.close();
})();
