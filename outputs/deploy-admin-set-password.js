// 部署 admin-set-password Edge Function（免 CLI，走 Management API multipart）
// 用法: SBP_TOKEN=sbp_xxx node outputs/deploy-admin-set-password.js
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.SBP_TOKEN;
if (!TOKEN) { console.error('缺少环境变量 SBP_TOKEN'); process.exit(1); }
const REF = 'icfgireprowcqwdodfqx';
const SLUG = 'admin-set-password';

const code = fs.readFileSync(path.join(__dirname, 'edge-fn-admin-set-password', 'index.ts'), 'utf8');

const boundary = '----FormBoundary' + Date.now();
const meta = JSON.stringify({ entrypoint_path: 'index.ts', name: SLUG, verify_jwt: true });

const parts = [];
parts.push(
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="metadata"\r\n` +
  `Content-Type: application/json\r\n\r\n` +
  meta + `\r\n`
);
parts.push(
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="file"; filename="index.ts"\r\n` +
  `Content-Type: application/typescript\r\n\r\n` +
  code + `\r\n`
);
parts.push(`--${boundary}--\r\n`);
const body = parts.join('');

fetch(`https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=${SLUG}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  },
  body,
})
  .then(async (r) => {
    const text = await r.text();
    console.log('HTTP', r.status);
    console.log(text.slice(0, 1500));
  })
  .catch((e) => { console.error('请求失败:', e.message); process.exit(1); });
