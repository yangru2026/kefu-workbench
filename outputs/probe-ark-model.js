/* 用真实 Key 探火山方舟：找出可直接调用的模型 ID
 * Key 从环境变量 ARK_KEY 读，不落盘、不进文件 */
const https = require('https');

const KEY = process.env.ARK_KEY || '';
if (!KEY) { console.log('NO_KEY'); process.exit(1); }

const CANDIDATES = [
  'Doubao-Seed-2.1-lite',
  'doubao-seed-2-1-lite',
  'doubao-seed-1-6-250615',
  'doubao-seed-2-1-lite-251015',
];

function tryModel(model) {
  return new Promise(resolve => {
    const payload = JSON.stringify({
      model,
      messages: [{ role: 'user', content: '只回答两个字：收到' }],
      max_tokens: 20
    });
    const req = https.request({
      host: 'ark.cn-beijing.volces.com',
      path: '/api/v3/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ model, status: res.statusCode, body: d.slice(0, 400) }));
    });
    req.on('error', e => resolve({ model, status: 0, body: 'ERR:' + e.message }));
    req.write(payload);
    req.end();
  });
}

(async () => {
  // 1) 先试着列模型（部分账号支持）
  await new Promise(resolve => {
    https.get({
      host: 'ark.cn-beijing.volces.com', path: '/api/v3/models',
      headers: { Authorization: 'Bearer ' + KEY }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { console.log('GET /api/v3/models ->', res.statusCode, d.slice(0, 500)); resolve(); });
    }).on('error', e => { console.log('GET models ERR:', e.message); resolve(); });
  });

  console.log('\n=== 逐个试模型 ID ===');
  for (const m of CANDIDATES) {
    const r = await tryModel(m);
    console.log('\n[' + m + '] status=' + r.status);
    console.log('  ', r.body.replace(/\s+/g, ' ').slice(0, 300));
  }
})();
