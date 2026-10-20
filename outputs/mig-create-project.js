// 建新 Supabase 项目（免费）
const PAT = process.env.SBP_TOKEN;
const fs = require('fs');
const ORG = 'jqbhbgqopukvvtxpuygs';
const NAME = 'kefu-workbench-v2';
const REGION = 'ap-northeast-2';   // 与原项目同区（首尔）

const DB_PASS = process.env.NEW_DB_PASS || (() => {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#%';
  let s = ''; for (let i = 0; i < 28; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
})();

(async () => {
  const r = await fetch('https://api.supabase.com/v1/projects', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ organization_id: ORG, name: NAME, db_pass: DB_PASS, region: REGION }),
  });
  const txt = await r.text();
  console.log('HTTP', r.status);
  console.log(txt.slice(0, 600));
  if (r.ok) {
    const j = JSON.parse(txt);
    fs.writeFileSync('C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/mig/new-project.json',
      JSON.stringify({ ref: j.id, name: j.name, region: j.region, db_pass: DB_PASS }, null, 2));
    console.log('\n=> 新项目 ref:', j.id, '| 密码已存 outputs/mig/new-project.json');
  }
})();
