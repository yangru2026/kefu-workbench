/* 把 schema.sql 按 @@CHUNKn 标记分批灌进新项目 */
const PAT = process.env.SBP_TOKEN;
const NEW = process.env.NEW_REF || 'lzmtyqsnxjvyajgswgum';
const fs = require('fs');
const SRC = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/mig/schema.sql';

async function exec(ref, sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const txt = await r.text();
  return { ok: r.ok, status: r.status, txt };
}

(async () => {
  const raw = fs.readFileSync(SRC, 'utf8');
  const parts = raw.split(/-- @@CHUNK\d/).map(s => s.trim()).filter(Boolean);
  console.log('分块数:', parts.length, parts.map(p => p.length + '字符').join(' / '));
  for (let i = 0; i < parts.length; i++) {
    const res = await exec(NEW, parts[i]);
    console.log(`CHUNK${i + 1}: HTTP ${res.status} ${res.ok ? '✅' : '❌ ' + res.txt.slice(0, 400)}`);
    if (!res.ok) process.exit(1);
  }
  const chk = await exec(NEW, `select count(*) as tables from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and c.relname not like 'pg_%';
   select count(*) as policies from pg_policies where schemaname='public';`);
  console.log('校验:', chk.txt.slice(0, 200));
})();
