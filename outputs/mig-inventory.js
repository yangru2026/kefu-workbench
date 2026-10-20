/* 统计旧库各表行数 + 各存储桶文件数与体积（只读，走 SQL，不受 402 影响） */
const PAT = process.env.SBP_TOKEN;
const OLD = 'ienmejlxukhrxjjxvfqf';
const NEW = 'lzmtyqsnxjvyajgswgum';
async function q(ref, sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { ok: r.ok, status: r.status, json: j, txt: t };
}

(async () => {
  const rows = await q(OLD, `
    select c.relname as t, c.reltuples::bigint as approx
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by 1`);
  console.log('表数', rows.json && rows.json.length);

  const counts = await q(OLD, `
    select 'diversion_transfers' t, count(*) from diversion_transfers
    union all select 'ranking_daily', count(*) from ranking_daily
    union all select 'cross_sales', count(*) from cross_sales
    union all select 'qc_images', count(*) from qc_images
    union all select 'qc_records', count(*) from qc_records
    union all select 'daily_reports', count(*) from daily_reports
    union all select 'notifications', count(*) from notifications`);
  console.log('关键表行数:', JSON.stringify(counts.json));

  const buckets = await q(OLD, `
    select bucket_id, count(*)::int as files, pg_size_pretty(coalesce(sum((metadata->>'size')::bigint),0)) as size,
           coalesce(sum((metadata->>'size')::bigint),0) as bytes
    from storage.objects group by bucket_id order by bytes desc`);
  console.log('存储桶:', JSON.stringify(buckets.json));
  const total = (buckets.json || []).reduce((s, b) => s + Number(b.bytes || 0), 0);
  console.log('合计:', (total / 1048576).toFixed(1), 'MB');

  const db = await q(OLD, `select pg_size_pretty(pg_database_size(current_database())) as db`);
  console.log('数据库体积:', JSON.stringify(db.json));

  const users = await q(OLD, `select count(*)::int as users from auth.users`);
  console.log('auth 用户:', JSON.stringify(users.json));
  const nusers = await q(NEW, `select count(*)::int as users from auth.users`);
  console.log('新库 auth 用户:', JSON.stringify(nusers.json));
})();
