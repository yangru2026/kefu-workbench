/* 触发质检同步（部署完 qc-sync 后跑）
 * 用法：
 *   node outputs/sync-qc.js dry      # 只看飞书表解析结果，不写库
 *   node outputs/sync-qc.js          # 正式同步（upsert 进 qc_records）
 *   QC_SYNC_KEY=xxx node outputs/sync-qc.js   # 也可显式给 key
 * key 来源：优先环境变量，其次 outputs/.qc-sync-key（部署脚本会写）
 */
const fs = require('fs');
const path = require('path');

const REF = 'icfgireprowcqwdodfqx';
const BASE = `https://${REF}.supabase.co`;
const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const ANON = 'sb_publishable_LF-obMSRD7DFsY0AcjYZuQ_53P6UlQ8';

let KEY = process.env.QC_SYNC_KEY || '';
if (!KEY) {
  try { KEY = fs.readFileSync(path.join(ROOT, 'outputs/.qc-sync-key'), 'utf8').trim(); } catch (e) {}
}
if (!KEY) { console.log('缺少 QC_SYNC_KEY（或 outputs/.qc-sync-key）'); process.exit(1); }

const dry = process.argv[2] === 'dry';

(async () => {
  const url = `${BASE}/functions/v1/qc-sync${dry ? '?dry=1' : ''}`;
  console.log('→', url);
  const r = await fetch(url, { method: 'POST', headers: { 'x-sync-key': KEY } });
  const t = await r.text();
  console.log('HTTP', r.status);
  console.log(t.slice(0, 2500));

  if (!dry && r.ok) {
    // 回读确认
    const c = await fetch(`${BASE}/rest/v1/qc_records?select=id`, {
      method: 'HEAD',
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, Prefer: 'count=exact', Range: '0-0' },
    });
    console.log('\nqc_records 当前行数:', (c.headers.get('content-range') || '').split('/')[1]);
    const s = await fetch(`${BASE}/rest/v1/qc_records?select=qc_date,staff_name,qc_name,severity,amount,guidance,evidence&order=qc_date.desc&limit=5`, {
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
    });
    console.log('最近 5 条:', JSON.stringify(await s.json(), null, 1).slice(0, 1200));
  }
})();
