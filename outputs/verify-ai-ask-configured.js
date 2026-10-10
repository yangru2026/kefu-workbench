/* 配置完成后验证：ai-ask 是否已读到 ARK 配置
 * 判据：
 *   配置前 → 500 {"error":"AI 服务尚未配置..."}
 *   配置后 → 401 {"error":"登录状态已失效..."}  ← 说明已过配置检查，只差真实用户 JWT
 */
const https = require('https');
const fs = require('fs');
const html = fs.readFileSync('C:/temp/kefu_src/index.html', 'utf8');
const KEY = html.match(/SUPABASE_KEY\s*=\s*'([^']+)'/)[1];

const payload = JSON.stringify({ question: '透氧量达标吗', scene: '测试' });
const req = https.request({
  host: 'ienmejlxukhrxjjxvfqf.supabase.co',
  path: '/functions/v1/ai-ask',
  method: 'POST',
  headers: {
    apikey: KEY, Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('status:', res.statusCode);
    console.log('body  :', d.slice(0, 300));
    if (res.statusCode === 500 && d.includes('尚未配置')) {
      console.log('\n=> ❌ 密钥仍未配置（Secrets 里还没有 ARK_API_KEY / ARK_MODEL）');
    } else if (res.statusCode === 401) {
      console.log('\n=> ✅ 配置已生效！函数已读到 ARK_API_KEY / ARK_MODEL（401 只是因为本次探测没带真实登录态）');
    } else {
      console.log('\n=> 其他返回，需人工判断');
    }
  });
});
req.on('error', e => console.log('ERR:', e.message));
req.write(payload);
req.end();
