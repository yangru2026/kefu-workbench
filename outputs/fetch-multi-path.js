/* 抓多个可能的访问路径，比对它们是不是同一份/哪一版 */
const https = require('https');

function get(url) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'node' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, len: d.length, body: d, headers: res.headers }));
    }).on('error', e => resolve({ status: 0, err: e.message }));
  });
}

const PATHS = [
  'https://yangru2026.github.io/kefu-workbench/',
  'https://yangru2026.github.io/kefu-workbench/index.html',
  'https://yangru2026.github.io/',
];

(async () => {
  for (const u of PATHS) {
    const r = await get(u + '?t=' + Date.now());
    if (r.status !== 200) { console.log(u, '->', r.status, r.err || ''); continue; }
    const twoCol = r.body.includes('flex: 0 0 calc(50% - 3px)');
    const fixed = r.body.includes('没改上：当前账号没有修改该成员');
    const navFlex = r.body.includes('.sidebar-nav { padding: 4px 10px 10px; flex: 1; display: flex;');
    console.log(u);
    console.log('  status:', r.status, '| size:', r.len, '| cache-control:', r.headers['cache-control']);
    console.log('  双列CSS:', twoCol, '| 成员修复:', fixed, '| 新nav容器:', navFlex);
    // 找 tools 图标
    const m = r.body.match(/data-page="tools"[^>]*><span class="icon">([^<]+)</);
    console.log('  tools 图标:', m ? m[1] : '(未找到)');
  }
})();
