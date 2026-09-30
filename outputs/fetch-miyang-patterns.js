/* 拉取弥生真实花色数据（从 index.html 提取连接配置，不打印任何密钥）
 * 用法：node outputs/fetch-miyang-patterns.js
 * 输出：outputs/miyang-patterns.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const url = (html.match(/const\s+SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
const key = (html.match(/const\s+SUPABASE_KEY\s*=\s*'([^']+)'/) || [])[1];
if (!url || !key) { console.error('未提取到连接配置'); process.exit(1); }
console.log('config ok, url=' + url.replace(/^https:\/\/([a-z0-9]+)\..*/, '$1.***'));

(async () => {
  const sel = 'id,brand,type,name,series,color,price_tier,diam_group,is_discontinued,sort_order';
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(url + '/rest/v1/pattern_assets?select=' + sel + '&order=sort_order.asc&limit=1000&offset=' + from, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!r.ok) { console.error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(2); }
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  fs.writeFileSync(path.join(ROOT, 'outputs/miyang-patterns.json'), JSON.stringify(out, null, 1), 'utf8');
  const my = out.filter(p => p.brand === '弥生');
  console.log('total=' + out.length + ' 弥生=' + my.length);
  const series = {};
  my.forEach(p => { series[p.series || '(未填)'] = (series[p.series || '(未填)'] || 0) + 1; });
  console.log('弥生系列数=' + Object.keys(series).length);
  Object.entries(series).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k + ' : ' + v));
  const tiers = {};
  my.forEach(p => { tiers[p.price_tier || '(未标)'] = (tiers[p.price_tier || '(未标)'] || 0) + 1; });
  console.log('弥生价格档：');
  Object.entries(tiers).forEach(([k, v]) => console.log('  ' + k + ' : ' + v));
})();
