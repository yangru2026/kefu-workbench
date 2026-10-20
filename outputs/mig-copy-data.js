/* 跨项目搬数据：旧库 → 新库（走 Management API SQL，绕过被限的数据面）
   用法：SBP_TOKEN=xxx [NEW_REF=...] node mig-copy-data.js
   顺序：auth.users → auth.identities → public 各表（按外键拓扑序）
*/
const PAT = process.env.SBP_TOKEN;
const OLD = process.env.OLD_REF || 'ienmejlxukhrxjjxvfqf';
const NEW = process.env.NEW_REF || 'lzmtyqsnxjvyajgswgum';
const ONLY = process.env.ONLY || '';          // 只搬这些表，逗号分隔
const SKIP_AUTH = process.env.SKIP_AUTH === '1';

async function exec(ref, sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const txt = await r.text();
  let json = null; try { json = JSON.parse(txt); } catch (e) { }
  return { ok: r.ok, status: r.status, json, txt };
}

// 取可插入的列（排除生成列）
async function getCols(ref, schema, table) {
  const r = await exec(ref, `
    select a.attname, format_type(a.atttypid,a.atttypmod) as type, a.attnotnull,
           pg_get_expr(d.adbin,d.adrelid) as def,
           (a.attidentity <> '') as is_identity,
           (a.attgenerated <> '') as is_generated
    from pg_attribute a
    join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
    where n.nspname='${schema}' and c.relname='${table}' and a.attnum>0 and not a.attisdropped
    order by a.attnum`);
  return r.json || [];
}

function lit(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

async function copyTable(schema, table, where = '', limit = 400) {
  const cols = await getCols(OLD, schema, table);
  const insCols = cols.filter(c => !c.is_generated).map(c => c.attname);
  const selCols = insCols.map(c => '"' + c + '"').join(', ');
  const qname = `${schema}."${table}"`;

  // 行数
  const c = await exec(OLD, `select count(*)::int as n from ${qname} ${where}`);
  const total = (c.json && c.json[0] && c.json[0].n) || 0;
  if (!total) { console.log(`  ${schema}.${table}: 0 行，跳过`); return { total: 0, ok: 0 }; }

  // 找主键用于稳定分页
  const pk = await exec(OLD, `
    select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
    where i.indrelid='${qname}'::regclass and i.indisprimary`);
  const pkCol = (pk.json && pk.json[0] && pk.json[0].attname) || null;

  let ok = 0, offset = 0, rounds = 0;
  while (offset < total && rounds < 400) {
    rounds++;
    const order = pkCol ? `order by "${pkCol}"` : '';
    const sel = await exec(OLD, `select ${selCols} from ${qname} ${where} ${order} limit ${limit} offset ${offset}`);
    if (!sel.ok) { console.log(`  ❌ 读失败 ${table}: ${sel.txt.slice(0, 200)}`); return { total, ok, err: 1 }; }
    const rows = sel.json || [];
    if (!rows.length) break;

    const json = JSON.stringify(rows);
    const sql = `set session_replication_role = replica;
      insert into ${qname} (${insCols.map(c => '"' + c + '"').join(',')})
      select ${insCols.map(c => '"' + c + '"').join(',')} from jsonb_populate_recordset(null::${qname}, $j$${json}$j$::jsonb)
      on conflict do nothing`;
    const w = await exec(NEW, sql);
    if (!w.ok) {
      console.log(`  ❌ 写失败 ${table} @${offset}: HTTP ${w.status} ${w.txt.slice(0, 300)}`);
      return { total, ok, err: 1 };
    }
    ok += rows.length; offset += rows.length;
  }
  console.log(`  ${schema}.${table}: ${ok}/${total} ✅`);
  return { total, ok };
}

// 按外键拓扑排序 public 表
async function topoOrder() {
  const t = await exec(OLD, `
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by 1`);
  const tables = (t.json || []).map(x => x.relname);
  const fk = await exec(OLD, `
    select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace
    where c.contype='f' and n.nspname='public'`);
  const deps = {}; tables.forEach(x => deps[x] = new Set());
  (fk.json || []).forEach(r => {
    const child = String(r.child).replace(/^public\.|"/g, '');
    const parent = String(r.parent).replace(/^public\.|"/g, '');
    if (deps[child] && parent !== child && deps[parent]) deps[child].add(parent);
  });
  const out = [], seen = new Set(), tmp = new Set();
  function visit(x) {
    if (seen.has(x) || tmp.has(x)) return;
    tmp.add(x);
    (deps[x] || []).forEach(visit);
    tmp.delete(x); seen.add(x); out.push(x);
  }
  tables.forEach(visit);
  return out;
}

(async () => {
  console.log(`旧 ${OLD} → 新 ${NEW}`);

  if (!SKIP_AUTH) {
    console.log('\n== auth 用户 ==');
    // 关掉触发器/约束再灌，避免外键与签名问题
    const pre = await exec(NEW, `set session_replication_role = replica; select 1 as ok`);
    console.log('  replica 模式:', pre.ok ? '可用' : '不可用（' + pre.txt.slice(0, 150) + '）');
    for (const t of ['users', 'identities']) {
      await copyTable('auth', t, '', 200);
    }
  }

  console.log('\n== public 表 ==');
  let list = await topoOrder();
  if (ONLY) { const s = new Set(ONLY.split(',')); list = list.filter(x => s.has(x)); }
  console.log('顺序:', list.join(' → '));

  const report = [];
  for (const t of list) {
    const r = await copyTable('public', t);
    report.push({ t, ...r });
  }
  const bad = report.filter(r => r.err || (r.ok !== r.total));
  console.log('\n=== 结果 ===');
  console.log('表数:', report.length, '总行数:', report.reduce((s, r) => s + r.ok, 0));
  if (bad.length) { console.log('异常表:', bad.map(b => `${b.t}(${b.ok}/${b.total})`).join(', ')); }
  else console.log('全部对齐 ✅');
})();
