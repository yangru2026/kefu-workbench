// 通过 Supabase Management API 执行 SQL 文件
// 用法: SBP_TOKEN=sbp_xxx [SBP_REF=<项目ref>] node outputs/exec-sql.js <sql文件路径>
// ⚠️ Token 走环境变量，禁止硬编码（GitHub Secret Scanning 会拦下推送）
// ⚠️ 2026-10-31：默认项目改成新项目 youhe-workbench（icfgirep…）。
//    原来这里写死旧项目 ienmejlx…，曾把 11 月班表误插进已停用的旧库（REST 查不到、白折腾半小时）。
//    要操作旧库请显式 SBP_REF=ienmejlxukhrxjjxvfqf。
const fs = require('fs');

const TOKEN = process.env.SBP_TOKEN;
if (!TOKEN) { console.error('缺少环境变量 SBP_TOKEN'); process.exit(1); }
const REF = process.env.SBP_REF || 'icfgireprowcqwdodfqx';
const file = process.argv[2];
if (!file) { console.error('缺少 SQL 文件参数'); process.exit(1); }

const sql = fs.readFileSync(file, 'utf8');
console.log('项目:', REF, '| 执行文件:', file, '| 长度:', sql.length);

fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})
  .then(async (r) => {
    const text = await r.text();
    console.log('HTTP', r.status);
    console.log(text.slice(0, 2000) || '(空响应=成功)');
  })
  .catch((e) => { console.error('请求失败:', e.message); process.exit(1); });
