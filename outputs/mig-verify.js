/* 新旧库逐表行数对账 + 结构核对 */
const PAT = process.env.SBP_TOKEN;
const OLD = 'ienmejlxukhrxjjxvfqf';
const NEW = process.env.NEW_REF || 'lzmtyqsnxjvyajgswgum';
async function q(ref, sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return { err: t.slice(0, 300) }; }
}
const COUNT_SQL = (schema) => `
  select c.relname as t, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::int as n
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='${schema}' and c.relkind='r' order by 1`;

(async () => {
  for (const schema of ['public', 'auth']) {
    const a = await q(OLD, COUNT_SQL(schema));
    const b = await q(NEW, COUNT_SQL(schema));
    if (!Array.isArray(a) || !Array.isArray(b)) { console.log(schema, '查询失败', JSON.stringify(a).slice(0, 120)); continue; }
    const bm = new Map(b.map(x => [x.t, x.n]));
    const diff = a.filter(x => (bm.get(x.t) ?? -1) !== x.n);
    console.log(`\n[${schema}] 旧 ${a.length} 表 / 新 ${b.length} 表，差异 ${diff.length} 张`);
    diff.forEach(d => console.log(`  ${d.t}: 旧 ${d.n} 新 ${bm.get(d.t)}`));
    const onlyNew = b.filter(x => !a.some(y => y.t === x.t));
    if (onlyNew.length) console.log('  仅新库有:', onlyNew.map(x => x.t).join(', '));
  }
  const s = await q(NEW, `select
    (select count(*) from pg_policies where schemaname='public')::int pub_pol,
    (select count(*) from pg_policies where schemaname='storage')::int sto_pol,
    (select count(*) from storage.buckets)::int buckets,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')::int fns,
    (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal)::int trg`);
  console.log('\n新库汇总:', JSON.stringify(s));
})();
