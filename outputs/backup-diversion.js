/* 备份 diversion_transfers 全表到本地（JSON + SQL INSERT），确认落盘后再清空 */
const fs = require('fs');
const PAT = process.env.SBP_TOKEN;
const REF = 'icfgireprowcqwdodfqx';
const OUT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/backup';
const CLEAR = process.argv.includes('--clear');

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const cnt = await q(`select count(*)::int n from diversion_transfers`);
  console.log('当前行数:', cnt[0].n);
  if (!cnt[0].n) { console.log('表已空，无需备份'); return; }

  const cols = (await q(`select column_name from information_schema.columns where table_name='diversion_transfers' order by ordinal_position`)).map(x => x.column_name);
  console.log('列:', cols.join(','));

  const PAGE = 500;
  let offset = 0, all = [];
  while (offset < cnt[0].n) {
    const rows = await q(`select * from diversion_transfers order by created_at nulls last limit ${PAGE} offset ${offset}`);
    if (!rows.length) break;
    all = all.concat(rows); offset += rows.length;
    process.stdout.write(`\r已导出 ${all.length}/${cnt[0].n}`);
  }
  console.log('');

  const jsonPath = `${OUT}/diversion_transfers_${stamp}.json`;
  fs.writeFileSync(jsonPath, JSON.stringify(all, null, 1), 'utf8');

  // 生成可回灌的 SQL（jsonb_populate_recordset）
  const sqlPath = `${OUT}/diversion_transfers_${stamp}.sql`;
  const chunk = 200;
  const lines = [`-- diversion_transfers 备份 ${all.length} 行 (${new Date().toISOString()})`, `-- 回灌：在目标库执行本文件即可`, ''];
  for (let i = 0; i < all.length; i += chunk) {
    const part = all.slice(i, i + chunk);
    lines.push(`insert into diversion_transfers (${cols.map(c => '"' + c + '"').join(',')})
  select ${cols.map(c => '"' + c + '"').join(',')}
  from jsonb_populate_recordset(null::diversion_transfers, $j$${JSON.stringify(part)}$j$::jsonb)
  on conflict do nothing;`);
  }
  fs.writeFileSync(sqlPath, lines.join('\n'), 'utf8');
  console.log('备份完成:', jsonPath, (fs.statSync(jsonPath).size / 1048576).toFixed(1) + 'MB');
  console.log('           ', sqlPath, (fs.statSync(sqlPath).size / 1048576).toFixed(1) + 'MB');

  if (CLEAR) {
    const chk = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (chk.length !== cnt[0].n) { console.error('❌ 备份行数与库不一致，拒绝清空'); process.exit(1); }
    const r = await q(`delete from diversion_transfers where true`);
    const after = await q(`select count(*)::int n from diversion_transfers`);
    console.log('清空后剩余:', after[0].n);
  } else {
    console.log('\n（未清空，加 --clear 才删）');
  }
})();
