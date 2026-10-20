/* 补齐新库：storage 桶 + storage.objects 策略（从旧库读取定义生成 DDL） */
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
  let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { ok: r.ok, status: r.status, json: j, txt: t };
}

(async () => {
  // 1) 桶
  const buckets = await q(OLD, `select id, name, public, file_size_limit, allowed_mime_types from storage.buckets`);
  console.log('旧桶:', JSON.stringify(buckets.json));
  const vals = (buckets.json || []).map(b =>
    `('${b.id}','${b.name}',${b.public},${b.file_size_limit ?? 'null'},${b.allowed_mime_types ? "'{" + b.allowed_mime_types.join(',') + "}'" : 'null'})`
  ).join(',');
  if (vals) {
    const r = await q(NEW, `insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
      values ${vals} on conflict (id) do nothing`);
    console.log('建桶:', r.status, r.ok ? '✅' : r.txt.slice(0, 200));
  }

  // 2) storage.objects 策略
  const pols = await q(OLD, `select policyname, permissive, roles::text[] as roles, cmd, qual, with_check
     from pg_policies where schemaname='storage' and tablename='objects' order by policyname`);
  const exist = await q(NEW, `select policyname from pg_policies where schemaname='storage' and tablename='objects'`);
  const have = new Set((exist.json || []).map(x => x.policyname));
  console.log(`\n旧 storage 策略 ${(pols.json || []).length} 条，新库已有 ${have.size} 条`);

  const stmts = [];
  for (const p of (pols.json || [])) {
    if (have.has(p.policyname)) continue;
    const roles = (p.roles || ['public']).map(r => r === 'public' ? 'public' : `"${r}"`).join(', ');
    let s = `create policy "${p.policyname}" on storage.objects as ${p.permissive || 'PERMISSIVE'} for ${p.cmd} to ${roles}`;
    if (p.qual) s += ` using (${p.qual})`;
    if (p.with_check) s += ` with check (${p.with_check})`;
    stmts.push(s + ';');
  }
  console.log('待补策略:', stmts.length);
  if (stmts.length) {
    const r = await q(NEW, stmts.join('\n'));
    console.log('补策略:', r.status, r.ok ? '✅' : r.txt.slice(0, 400));
  }

  const chk = await q(NEW, `select count(*)::int as n from pg_policies where schemaname='storage'`);
  const bk = await q(NEW, `select count(*)::int as n from storage.buckets`);
  console.log('新库 storage 策略数:', JSON.stringify(chk.json), '桶数:', JSON.stringify(bk.json));
})();
