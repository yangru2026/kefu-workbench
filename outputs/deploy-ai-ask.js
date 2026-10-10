/* 部署 ai-ask Edge Function（走 Supabase Management API 的 multipart 部署端点，
 * 不需要本地装 supabase CLI）
 * 用法：SUPABASE_PAT=sbp_xxx node outputs/deploy-ai-ask.js
 */
const https = require('https');
const fs = require('fs');

const PAT = process.env.SUPABASE_PAT || '';
const REF = 'ienmejlxukhrxjjxvfqf';
const SLUG = 'ai-ask';
// Management API 上传时文件落在源码根目录（不是 CLI 的 supabase/functions/ 层级）
const ENTRY = 'index.ts';
const FILE_PATH = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/supabase/functions/ai-ask/index.ts';

if (!PAT) { console.log('缺少 SUPABASE_PAT'); process.exit(1); }

const src = fs.readFileSync(FILE_PATH, 'utf8');
console.log('待部署源码:', src.length, '字符 | 含 thinking 关闭:', src.includes("thinking: { type: 'disabled' }"));

// 手工拼 multipart/form-data
const BOUNDARY = '----kefuDeploy' + Date.now();
const parts = [];

const metadata = JSON.stringify({
  entrypoint_path: ENTRY,
  name: SLUG,
  verify_jwt: false,
});

parts.push(
  `--${BOUNDARY}\r\n` +
  `Content-Disposition: form-data; name="metadata"\r\n` +
  `Content-Type: application/json\r\n\r\n` +
  metadata + `\r\n`
);
parts.push(
  `--${BOUNDARY}\r\n` +
  `Content-Disposition: form-data; name="file"; filename="index.ts"\r\n` +
  `Content-Type: application/typescript\r\n\r\n` +
  src + `\r\n`
);
parts.push(`--${BOUNDARY}--\r\n`);

const bodyBuf = Buffer.from(parts.join(''), 'utf8');

const req = https.request({
  host: 'api.supabase.com',
  path: `/v1/projects/${REF}/functions/deploy?slug=${SLUG}`,
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + PAT,
    'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`,
    'Content-Length': bodyBuf.length,
  },
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('\n部署返回 status:', res.statusCode);
    if (res.statusCode >= 300) { console.log(d.slice(0, 600)); process.exit(1); }
    try {
      const j = JSON.parse(d);
      console.log('  slug    :', j.slug);
      console.log('  version :', j.version);
      console.log('  status  :', j.status);
      console.log('  entry   :', j.entrypoint_path);
      console.log('  verify  :', j.verify_jwt);
    } catch (e) { console.log(d.slice(0, 400)); }
    console.log('\n=> ✅ 部署完成');
  });
});
req.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
req.write(bodyBuf);
req.end();
