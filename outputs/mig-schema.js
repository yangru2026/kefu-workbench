/* 从旧项目导出 schema（表/约束/索引/函数/触发器/策略/桶），生成可在新项目重放的 schema.sql */
const PAT = process.env.SBP_TOKEN;
const OLD = 'ienmejlxukhrxjjxvfqf';
const fs = require('fs');
const OUT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/mig';

async function q(sql, ref = OLD) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error('SQL ' + r.status + ': ' + txt.slice(0, 400));
  return JSON.parse(txt);
}

const Q = {
  enums: `select t.typname, string_agg(quote_literal(e.enumlabel), ',' order by e.enumsortorder) as labels
    from pg_type t join pg_enum e on e.enumtypid=t.oid
    join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname;`,

  cols: `select c.relname as tbl,
      json_agg(json_build_object(
        'name', a.attname,
        'type', format_type(a.atttypid, a.atttypmod),
        'notnull', a.attnotnull,
        'def', pg_get_expr(d.adbin, d.adrelid)
      ) order by a.attnum) as cols
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
    where n.nspname='public' and c.relkind='r' and c.relname not like 'pg_%'
    group by c.relname order by c.relname;`,

  cons: `select conrelid::regclass::text as tbl, conname, contype, pg_get_constraintdef(oid) as def
    from pg_constraint
    where connamespace='public'::regnamespace and contype in ('p','u','c','f')
    order by conrelid::regclass::text, contype;`,

  idx: `select tablename, indexname, indexdef from pg_indexes
    where schemaname='public' and indexname not in
      (select conname from pg_constraint where connamespace='public'::regnamespace)
    order by tablename, indexname;`,

  fns: `select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' order by p.proname;`,

  pol: `select schemaname, tablename, policyname, permissive, roles::text as roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public','storage') order by schemaname, tablename, policyname;`,

  trg: `select tgrelid::regclass::text as tbl, tgname, pg_get_triggerdef(oid) as def
    from pg_trigger where not tgisinternal
      and tgrelid in (select oid from pg_class where relnamespace in ('public'::regnamespace,'auth'::regnamespace))
    order by 1,2;`,

  buckets: `select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by name;`,

  counts: `select relname as tbl, n_live_tup as rows from pg_stat_user_tables where schemaname='public' order by n_live_tup desc;`,

  rls: `select c.relname as tbl, c.relrowsecurity as rls from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by 1;`,
};

function qident(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
function qlit(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

(async () => {
  const [enums, cols, cons, idx, fns, pol, trg, buckets, counts, rls] = await Promise.all([
    q(Q.enums), q(Q.cols), q(Q.cons), q(Q.idx), q(Q.fns), q(Q.pol), q(Q.trg), q(Q.buckets), q(Q.counts), q(Q.rls),
  ]);

  const sql = [];
  sql.push('-- 自动导出：旧项目 public schema（' + new Date().toISOString() + '）');
  sql.push('-- @@CHUNK1');
  sql.push('create extension if not exists pgcrypto;');

  for (const e of enums) {
    sql.push(`do $$ begin create type public.${qident(e.typname)} as enum (${e.labels}); exception when duplicate_object then null; end $$;`);
  }

  // 先建序列（默认值里 nextval 引用）
  const seqs = new Set();
  for (const t of cols) for (const c of t.cols) {
    if (c.def) {
      const m = String(c.def).match(/nextval\('([^']+)'::regclass\)/);
      if (m) seqs.add(m[1]);
    }
  }
  for (const s of seqs) sql.push(`create sequence if not exists ${s};`);

  for (const t of cols) {
    const defs = t.cols.map(c => {
      let d = `${qident(c.name)} ${c.type}`;
      if (c.def) d += ` default ${c.def}`;
      if (c.notnull) d += ' not null';
      return d;
    });
    sql.push(`create table if not exists public.${qident(t.tbl)} (\n  ${defs.join(',\n  ')}\n);`);
  }

  for (const c of cons) {
    if (c.contype === 'p') sql.push(`alter table ${c.tbl} add constraint ${qident(c.conname)} ${c.def};`);
  }
  sql.push('-- @@CHUNK2');
  for (const c of cons) {
    if (c.contype !== 'p') sql.push(`alter table ${c.tbl} add constraint ${qident(c.conname)} ${c.def};`);
  }
  for (const i of idx) sql.push(i.indexdef.replace(/^CREATE /, 'CREATE ') + ';');

  for (const f of fns) sql.push(f.def + ';');

  sql.push('-- @@CHUNK3');
  for (const r of rls) if (r.rls) sql.push(`alter table public.${qident(r.tbl)} enable row level security;`);

  for (const p of pol) {
    if (p.schemaname !== 'public') continue;
    const roles = String(p.roles || 'public').replace(/[{}]/g, '');
    let s = `drop policy if exists ${qident(p.policyname)} on public.${qident(p.tablename)};\n`;
    s += `create policy ${qident(p.policyname)} on public.${qident(p.tablename)} as ${p.permissive} for ${p.cmd} to ${roles}`;
    if (p.qual) s += ` using (${p.qual})`;
    if (p.with_check) s += ` with check (${p.with_check})`;
    sql.push(s + ';');
  }

  for (const t of trg) sql.push(t.def + ';');

  sql.push('-- @@CHUNK4');
  fs.writeFileSync(OUT + '/schema.sql', sql.join('\n\n'), 'utf8');
  fs.writeFileSync(OUT + '/meta.json', JSON.stringify({ enums, cols, cons, idx, fns, pol, trg, buckets, counts, rls }, null, 2), 'utf8');

  console.log('表数量:', cols.length, '| 约束:', cons.length, '| 索引:', idx.length,
    '| 函数:', fns.length, '| 策略:', pol.length, '| 触发器:', trg.length, '| 桶:', buckets.length);
  console.log('行数 Top:');
  counts.slice(0, 12).forEach(c => console.log('  ', c.tbl, c.rows));
  console.log('\n桶:', buckets.map(b => b.name + (b.public ? '(public)' : '')).join(', '));
})();
