/* 全量查询并落盘，绕开 2000 字符截断 */
const fs = require('fs');
const sql = process.argv[2] || fs.readFileSync(process.env.SQLFILE || 'outputs/sql-check-schedule-state.sql', 'utf8');
const PAT = process.env.SBP_TOKEN;
const REF = 'icfgireprowcqwdodfqx';
(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  fs.writeFileSync('outputs/_q_out.json', t, 'utf8');
  console.log('HTTP', r.status, '→ outputs/_q_out.json,', t.length, 'chars');
})();
