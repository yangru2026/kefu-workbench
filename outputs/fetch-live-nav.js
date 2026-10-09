/* 抓线上 index.html，核对 nav 双列 CSS 与最新修复标记 */
const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node' } }, res => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

(async () => {
  const html = await get('https://yangru2026.github.io/kefu-workbench/?t=' + Date.now());
  fs.writeFileSync('C:/temp/live_nav_check.html', html);
  console.log('size:', html.length);

  const i = html.indexOf('.sidebar-nav {');
  console.log('\n== .sidebar-nav 定义 ==');
  console.log(i > -1 ? html.slice(i, i + 200) : '(未找到)');

  const j = html.indexOf('.nav-item {');
  console.log('\n== .nav-item 定义 ==');
  console.log(j > -1 ? html.slice(j, j + 300) : '(未找到)');

  console.log('\n== 修复标记 ==');
  console.log('bindMaskSafeClose:', (html.match(/bindMaskSafeClose/g) || []).length);
  console.log('成员管理修复(没改上):', html.includes('没改上：当前账号没有修改该成员'));
  console.log('双列 flex-basis 50%:', html.includes('flex: 0 0 calc(50% - 3px)'));
})().catch(e => { console.log('ERR:' + e.message); process.exit(1); });
