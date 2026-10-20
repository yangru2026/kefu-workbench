/* 打印新旧项目当前状态：表数、策略数、桶、函数、各表行数 */
const PAT = process.env.SBP_TOKEN;
if (!PAT) { console.error('缺 SBP_TOKEN'); process.exit(1); }
const OLD = 'ienmejlxukhrxjjxvfqf';
const NEW = 'lzmtyqsnxjvyajgswgum';
const W = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const fs = require('fs');

async function api(path, opt = {}) {
  const r = await fetch('https://api.supabase.com' + path, {
    method: opt.method || 'GET',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const txt = await r.text();
  let json = null;
  try { json = JSON.parse(txt); } catch (e) { }
  return { status: r.status, ok: r.ok, json, txt };
}
async function q(ref, sql) {
  return api(`/v1/projects/${ref}/database/query`, { method: 'POST', body: { query: sql } });
}

(async () => {
  const meta = JSON.parse(fs.readFileSync(W + '/outputs/mig/meta.json', 'utf8'));
  console.log('meta 表数:', (meta.tables || meta.cols || []).length, 'keys:', Object.keys(meta).join(','));

  for (const [label, ref] of [['旧', OLD], ['新', NEW]]) {
    const t = await q(ref, `select count(*)::int as tables from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`);
    const p = await q(ref, `select count(*)::int as policies from pg_policies where schemaname in ('public','storage')`);
    console.log(`\n[${label} ${ref}] 表: ${JSON.stringify(t.json)} 策略: ${JSON.stringify(p.json)} ${t.ok ? '' : 'ERR ' + t.txt.slice(0, 200)}`);
  }

  const bk = await api(`/v1/projects/${NEW}/storage/buckets`);
  console.log('\n新项目桶:', bk.status, bk.txt.slice(0, 600));

  const bkOld = await api(`/v1/projects/${OLD}/storage/buckets`);
  console.log('旧项目桶:', bkOld.status, bkOld.txt.slice(0, 600));

  const fn = await api(`/v1/projects/${NEW}/functions`);
  console.log('新项目函数:', fn.status, fn.txt.slice(0, 300));
})();
