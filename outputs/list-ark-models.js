const https = require('https');
const KEY = process.env.ARK_KEY || '';
https.get({ host: 'ark.cn-beijing.volces.com', path: '/api/v3/models',
  headers: { Authorization: 'Bearer ' + KEY } }, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    const rows = j.data || [];
    console.log('总模型数:', rows.length);
    console.log('\n=== 含 seed 且 2-1 / 2.1 的条目（原始）===');
    rows.filter(r => /seed/i.test(String(r.id)) && /2-1|2\.1/.test(String(r.id)))
        .forEach(r => console.log(JSON.stringify(r)));
    console.log('\n=== 含 "2-1" 的所有条目 ===');
    rows.filter(r => /2-1/.test(String(r.id))).forEach(r => console.log(r.id, '|', r.name, '|', r.status));
  });
});
