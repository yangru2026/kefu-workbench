const https = require('https');
const KEY = process.env.ARK_KEY || '';
const MODEL = 'doubao-seed-2-1-lite-260915';
const payload = JSON.stringify({
  model: MODEL,
  messages: [
    { role: 'system', content: '你是美瞳售前客服专家。' },
    { role: 'user', content: '客户问"透氧量达标吗"，给一句可以直接发给客户的回复。' }
  ],
  temperature: 0.4, max_tokens: 300
});
const t0 = Date.now();
const req = https.request({
  host: 'ark.cn-beijing.volces.com', path: '/api/v3/chat/completions', method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY,
    'Content-Length': Buffer.byteLength(payload) }
}, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    console.log('status:', res.statusCode, '| 耗时:', ((Date.now()-t0)/1000).toFixed(2)+'s');
    try {
      const j = JSON.parse(d);
      console.log('模型:', j.model);
      console.log('用量:', JSON.stringify(j.usage));
      console.log('回答:\n', j.choices?.[0]?.message?.content);
    } catch (e) { console.log(d.slice(0, 600)); }
  });
});
req.on('error', e => console.log('ERR:', e.message));
req.write(payload); req.end();
