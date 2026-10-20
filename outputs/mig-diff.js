/* 对比新旧库的 表/策略/函数/触发器/桶 差异 */
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
const key = (o, f) => [f.map(x => o[x]).join('|'), o];

(async () => {
  const defs = {
    策略: `select schemaname||'.'||tablename as t, policyname as p from pg_policies where schemaname in ('public','storage')`,
    函数: `select n.nspname||'.'||p.proname as t, p.proname as p from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`,
    触发器: `select c.relname as t, tg.tgname as p from pg_trigger tg join pg_class c on c.oid=tg.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not tg.tgisinternal`,
    索引: `select tablename as t, indexname as p from pg_indexes where schemaname='public'`,
  };
  for (const [name, sql] of Object.entries(defs)) {
    const a = await q(OLD, sql), b = await q(NEW, sql);
    if (!Array.isArray(a) || !Array.isArray(b)) { console.log(name, '查询失败', JSON.stringify(a).slice(0, 150), JSON.stringify(b).slice(0, 150)); continue; }
    const sa = new Set(a.map(x => x.t + ' :: ' + x.p));
    const sb = new Set(b.map(x => x.t + ' :: ' + x.p));
    const missing = [...sa].filter(x => !sb.has(x));
    const extra = [...sb].filter(x => !sa.has(x));
    console.log(`\n[${name}] 旧 ${sa.size} / 新 ${sb.size}`);
    if (missing.length) console.log('  缺:', missing.join('\n       '));
    if (extra.length) console.log('  多:', extra.join(' | '));
  }
  const buckets = await q(OLD, `select id, name, public from storage.buckets order by id`);
  const nb = await q(NEW, `select id, name, public from storage.buckets order by id`);
  console.log('\n[桶] 旧:', JSON.stringify(buckets), '\n     新:', JSON.stringify(nb));
})();
