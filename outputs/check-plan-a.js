/* 从 GitHub API 拉 429769b（09-04 方案B）前后所有提交的 index.html，
 * 检查是否存在过「单排 + 弥生价/极氧价两列」的方案A版本 */
const https = require('https');

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({ host: 'api.github.com', path, headers: {
      'User-Agent': 'nav-debug', Accept: 'application/vnd.github+json'
    } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('bad json: ' + d.slice(0, 200))); } });
    }).on('error', reject);
  });
}
function getRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'nav-debug' } }, res => {
      if (res.statusCode !== 200) { resolve(null); return; }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(null));
  });
}

function analyze(html) {
  const sidebarNavFlex = /\.sidebar-nav[^{]*\{[^}]*display:\s*flex/.test(html);
  const navItem50 = html.includes('flex: 0 0 calc(50% - 3px)');
  const shortMi = html.includes('弥生价</span>');
  const fullMi = html.includes('弥生价格速查</span>');
  // 找 price-miyang 那行的完整 HTML
  const m = html.match(/<div class="nav-item"[^>]*price-miyang[\s\S]{0,180}/);
  const miRow = m ? m[0].replace(/\s+/g, ' ').slice(0, 160) : '(无)';
  const toolsIcon = (html.match(/data-page="tools"[^>]*><span class="icon">([^<]+)</) || [])[1] || '?';
  return { sidebarNavFlex, navItem50, shortMi, fullMi, miRow, toolsIcon };
}

(async () => {
  const commits = await get('/repos/yangru2026/kefu-workbench/commits?path=index.html&per_page=100');
  console.log('index.html 最近提交数:', commits.length);
  // 只看 09-01 ~ 09-08 窗口（双列上线前后）
  const win = commits.filter(c => {
    const t = new Date(c.commit.author.date);
    const day = c.commit.author.date.slice(0, 10);
    return day >= '2026-09-01' && day <= '2026-09-08';
  });
  console.log('09-01~09-08 窗口提交:');
  win.forEach(c => console.log(' ', c.sha.slice(0, 7), c.commit.author.date.slice(5, 16), c.commit.message.split('\n')[0].slice(0, 50)));

  for (const c of win.reverse()) {
    const raw = await getRaw(`https://raw.githubusercontent.com/yangru2026/kefu-workbench/${c.sha}/index.html`);
    if (!raw) { console.log(c.sha.slice(0, 7), ': raw 拉取失败'); continue; }
    const a = analyze(raw);
    console.log('\n>>', c.sha.slice(0, 7), c.commit.author.date.slice(5, 16));
    console.log('   sidebar-nav flex:', a.sidebarNavFlex, '| nav-item 50%:', a.navItem50, '| 弥生价缩写:', a.shortMi, '| 弥生全称:', a.fullMi, '| tools图标:', a.toolsIcon);
    console.log('   miyang 行:', a.miRow);
  }
})().catch(e => { console.log('ERR:' + e.message); process.exit(1); });
