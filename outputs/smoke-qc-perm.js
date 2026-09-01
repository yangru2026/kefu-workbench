const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PORT = 8141;
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
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1200'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  // 注意：currentUser / currentProfile 是顶层 let，必须直接赋值，window.x = 无效
  const result = await page.evaluate(() => {
    const out = {};
    ['admin', 'leader', 'staff'].forEach(role => {
      currentUser = { id: 'test-user' };
      currentProfile = { name: '测试用户', role: role, group_name: 'A组' };
      updateAuthUI();
      const vis = el => el && getComputedStyle(el).display !== 'none';
      const qcNav = document.querySelector('.qc-admin-nav');
      const adminNavs = Array.from(document.querySelectorAll('.admin-only-nav'));
      out[role] = {
        qcReportVisible: vis(qcNav),
        adminNavVisible: adminNavs.filter(vis).length,
        adminNavTotal: adminNavs.length,
        canEditTraining: canEdit('training'),
        canEditPatterns: canEdit('patterns'),
        canEditCrossSales: canEdit('cross-sales'),
        canEditRanking: canEdit('ranking'),
        isFullAdmin: isFullAdmin(),
        isQcRole: isQcRole()
      };
    });
    return out;
  });

  console.log('=== 三种角色权限实测 ===');
  console.log(JSON.stringify(result, null, 2));

  let pass = 0, fail = 0;
  const chk = (cond, msg) => { if (cond) { pass++; console.log('  PASS  ' + msg); } else { fail++; console.log('  FAIL  ' + msg); } };

  const admin = result.admin, leader = result.leader, staff = result.staff;

  console.log('\n--- 管理员(admin) ---');
  chk(admin.qcReportVisible === true, '能看到质检报告');
  chk(admin.adminNavVisible === admin.adminNavTotal && admin.adminNavTotal > 0,
    '能看到全部 ' + admin.adminNavTotal + ' 个管理导航项（实际 ' + admin.adminNavVisible + '）');
  chk(admin.canEditTraining && admin.canEditPatterns && admin.canEditRanking, '各模块可编辑');

  console.log('\n--- 组长(leader) ---');
  chk(leader.qcReportVisible === true, '能看到质检报告 ✅（保留）');
  chk(leader.adminNavVisible === 0, '看不到任何管理导航项（成员管理/客服信息/模板管理）实际可见 ' + leader.adminNavVisible);
  chk(leader.canEditTraining === false, '培训资料不可新增/编辑');
  chk(leader.canEditPatterns === false, '花色素材不可管理');
  chk(leader.canEditCrossSales === false, '连带成交不可编辑');
  chk(leader.canEditRanking === false, '客服排名不可导入/编辑');
  chk(leader.isQcRole === true && leader.isFullAdmin === false, '质检权限=是，管理员权限=否');

  console.log('\n--- 普通客服(staff) ---');
  chk(staff.qcReportVisible === false, '看不到质检报告');
  chk(staff.adminNavVisible === 0, '看不到任何管理导航项');
  chk(staff.canEditTraining === false && staff.isQcRole === false, '无编辑权、无质检权');

  console.log('\n=== JS 错误 ===');
  const real = errors.filter(e => e.indexOf('ERR_NAME_NOT_RESOLVED') < 0 && e.indexOf('favicon') < 0);
  console.log(real.length ? JSON.stringify(real, null, 2) : 'none');
  console.log('\n断言: pass=' + pass + ' fail=' + fail);

  await browser.close();
  server.close();
})();
