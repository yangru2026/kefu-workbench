/* 部署 Edge Functions 到新项目（multipart 手工拼，entrypoint_path 必须是 index.ts）
   用法：SBP_TOKEN=xxx NEW_REF=xxx node mig-deploy-fns.js [slug...]
*/
const fs = require('fs');
const path = require('path');
const PAT = process.env.SBP_TOKEN;
const REF = process.env.NEW_REF;
const REPO = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ['ai-ask', 'feishu-sync'];

(async () => {
  for (const slug of slugs) {
    const src = path.join(REPO, 'supabase/functions', slug, 'index.ts');
    if (!fs.existsSync(src)) { console.log('缺源码', slug); continue; }
    const code = fs.readFileSync(src, 'utf8');
    const boundary = '----kefu' + Date.now();
    const meta = JSON.stringify({ entrypoint_path: 'index.ts', name: slug, verify_jwt: false });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n${meta}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="index.ts"\r\nContent-Type: application/typescript\r\n\r\n`),
      Buffer.from(code, 'utf8'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=${slug}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + PAT,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    });
    const t = await r.text();
    console.log(`${slug}: HTTP ${r.status} ${r.ok ? '✅ ' + t.slice(0, 160) : '❌ ' + t.slice(0, 300)}`);
  }
})();
