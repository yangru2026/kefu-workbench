/* 部署质检两个 Edge Function 到新项目 youhe-workbench（Management API，免 CLI）
 * 用法：
 *   SUPABASE_PAT=sbp_xxx node outputs/deploy-qc-fns.js            # 只部署代码
 *   SUPABASE_PAT=sbp_xxx SET_SECRETS=1 node outputs/deploy-qc-fns.js   # 部署 + 写飞书凭据
 *   （写 secrets 需要环境变量 FEISHU_APP_ID / FEISHU_APP_SECRET；QC_SYNC_KEY 可留空自动生成）
 * 说明：
 *   - verify_jwt 一律 false：qc-sync 自己在代码里校验（x-sync-key 或管理员 JWT）；
 *     qc-evidence 的 token 走查询参数 ?t=（浏览器直接导航带不了 header），网关校验会误拦。
 *   - entrypoint_path 必须填 index.ts（上传后文件落在源码根目录）。
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PAT = process.env.SUPABASE_PAT || process.env.SBP_TOKEN || '';
const REF = 'icfgireprowcqwdodfqx';
const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';

const FNS = [
  { slug: 'qc-sync', file: path.join(ROOT, 'outputs/edge-qc-sync/index.ts') },
  { slug: 'qc-evidence', file: path.join(ROOT, 'outputs/edge-qc-evidence/index.ts') },
];

if (!PAT) { console.log('缺少 SUPABASE_PAT（或 SBP_TOKEN）'); process.exit(1); }

function api(method, apiPath, body, contentType) {
  return new Promise((resolve, reject) => {
    const headers = { Authorization: 'Bearer ' + PAT };
    if (contentType) headers['Content-Type'] = contentType;
    if (body) headers['Content-Length'] = body.length;
    const req = https.request({ host: 'api.supabase.com', path: apiPath, method, headers }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function deployOne(slug, file) {
  const src = fs.readFileSync(file, 'utf8');
  const BOUNDARY = '----qcdeploy' + Date.now();
  const metadata = JSON.stringify({ entrypoint_path: 'index.ts', name: slug, verify_jwt: false });
  const parts = [
    `--${BOUNDARY}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`,
    `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="index.ts"\r\nContent-Type: application/typescript\r\n\r\n${src}\r\n`,
    `--${BOUNDARY}--\r\n`,
  ];
  const buf = Buffer.from(parts.join(''), 'utf8');
  const r = await api('POST', `/v1/projects/${REF}/functions/deploy?slug=${slug}`, buf,
    `multipart/form-data; boundary=${BOUNDARY}`);
  console.log(`\n[${slug}] 源码 ${src.length} 字符 → HTTP ${r.status}`);
  if (r.status >= 300) { console.log('  ❌ ' + r.body.slice(0, 500)); return false; }
  try {
    const j = JSON.parse(r.body);
    console.log(`  ✅ version=${j.version} status=${j.status} entry=${j.entrypoint_path} verify_jwt=${j.verify_jwt}`);
    return true;
  } catch (e) { console.log('  ' + r.body.slice(0, 300)); return true; }
}

async function setSecrets() {
  const appId = process.env.FEISHU_APP_ID || '';
  const appSecret = process.env.FEISHU_APP_SECRET || '';
  if (!appId || !appSecret) { console.log('\n⚠️ 跳过 secrets：没给 FEISHU_APP_ID / FEISHU_APP_SECRET'); return; }
  const syncKey = process.env.QC_SYNC_KEY || crypto.randomBytes(16).toString('hex');

  // 先列一遍，确认不会误伤别的 secret
  const cur = await api('GET', `/v1/projects/${REF}/secrets`);
  console.log('\n现有 secrets:', (() => { try { return JSON.parse(cur.body).map((s) => s.name).join(', '); } catch (e) { return cur.body.slice(0, 200); } })());

  const payload = JSON.stringify([
    { name: 'FEISHU_APP_ID', value: appId },
    { name: 'FEISHU_APP_SECRET', value: appSecret },
    { name: 'QC_SYNC_KEY', value: syncKey },
    { name: 'FEISHU_QC_APP_TOKEN', value: 'GIlpb2g4JaAdC4sjcgPcnBtSnbh' },
    { name: 'FEISHU_QC_TABLE_ID', value: 'tblMHaYX5PoPFigD' },
    { name: 'FEISHU_QC_ATTACH_FIELD', value: '问题截图' },
  ]);
  const r = await api('POST', `/v1/projects/${REF}/secrets`, Buffer.from(payload, 'utf8'), 'application/json');
  console.log('写 secrets → HTTP', r.status, r.status === 201 ? '✅' : r.body.slice(0, 400));
  if (r.status < 300) {
    console.log('QC_SYNC_KEY =', syncKey, '（同步脚本用这个头：x-sync-key）');
    fs.writeFileSync(path.join(ROOT, 'outputs/.qc-sync-key'), syncKey);
  }
}

(async () => {
  let ok = true;
  for (const f of FNS) ok = (await deployOne(f.slug, f.file)) && ok;
  if (process.env.SET_SECRETS === '1') await setSecrets();
  console.log(ok ? '\n=> ✅ 全部部署完成' : '\n=> ❌ 有函数部署失败');
  process.exit(ok ? 0 : 1);
})();
