/* 配置 Supabase Edge Function Secrets（ARK_API_KEY / ARK_MODEL）
 * 令牌与 Key 全部从环境变量读取，不落盘、不进文件
 * 用法：SUPABASE_PAT=sbp_xxx ARK_KEY=ark-xxx ARK_MODEL=xxx node outputs/set-ark-secrets.js [--dry]
 */
const https = require('https');

const PAT = process.env.SUPABASE_PAT || '';
const ARK_KEY = process.env.ARK_KEY || '';
const ARK_MODEL = process.env.ARK_MODEL || '';
const REF = 'ienmejlxukhrxjjxvfqf';
const DRY = process.argv.includes('--dry');

if (!PAT) { console.log('缺少 SUPABASE_PAT'); process.exit(1); }

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      host: 'api.supabase.com', path, method,
      headers: Object.assign({
        Authorization: 'Bearer ' + PAT,
        'Content-Type': 'application/json'
      }, payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('=== 1) 现有 secrets ===');
  const cur = await api('GET', `/v1/projects/${REF}/secrets`);
  console.log('status:', cur.status);
  let names = [];
  try {
    const arr = JSON.parse(cur.body);
    names = arr.map(s => s.name);
    console.log('已有:', names.join(', ') || '(空)');
  } catch (e) { console.log('body:', cur.body.slice(0, 300)); }

  if (DRY) { console.log('\n[DRY RUN] 不写入'); return; }

  console.log('\n=== 2) 写入 ARK_API_KEY / ARK_MODEL ===');
  const r = await api('POST', `/v1/projects/${REF}/secrets`, [
    { name: 'ARK_API_KEY', value: ARK_KEY },
    { name: 'ARK_MODEL', value: ARK_MODEL }
  ]);
  console.log('status:', r.status, r.status < 300 ? '✅ 写入成功' : '❌ 失败');
  if (r.status >= 300) console.log('body:', r.body.slice(0, 400));

  console.log('\n=== 3) 复核 ===');
  const after = await api('GET', `/v1/projects/${REF}/secrets`);
  try {
    const arr = JSON.parse(after.body);
    const got = arr.map(s => s.name);
    console.log('现在已有:', got.join(', '));
    console.log('ARK_API_KEY :', got.includes('ARK_API_KEY') ? '✅' : '❌');
    console.log('ARK_MODEL   :', got.includes('ARK_MODEL') ? '✅' : '❌');
    const m = arr.find(s => s.name === 'ARK_MODEL');
    if (m) console.log('ARK_MODEL 值 =', m.value);
  } catch (e) { console.log(after.body.slice(0, 300)); }
})();
