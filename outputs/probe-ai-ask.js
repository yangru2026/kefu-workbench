/* 探测 ai-ask Edge Function 的真实返回（anon 身份，发一条测试问题） */
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
    apikey: KEY,
    Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('status:', res.statusCode);
    console.log('body:', d.slice(0, 800));
  });
});
req.on('error', e => console.log('ERR:', e.message));
req.write(payload);
req.end();
