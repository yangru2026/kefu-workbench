/* 读取「客服考试」试卷表格：feishu.doubao.com/sheets/LatPsgRz1hFMhXt00SMcFRQInKb */
const fs = require('fs');
const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const BASE = 'https://open.feishu.cn/open-apis';
const TOKEN = 'LatPsgRz1hFMhXt00SMcFRQInKb';
const OUT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/feishu';

async function call(path, token, method = 'GET', body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { status: r.status, json: j, txt: t };
}
const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

(async () => {
  if (!APP_ID || !APP_SECRET) { console.error('缺少凭据'); process.exit(1); }
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const auth = await call('/auth/v3/tenant_access_token/internal', null, 'POST', { app_id: APP_ID, app_secret: APP_SECRET });
  const tk = auth.json && auth.json.tenant_access_token;
  if (!tk) { console.log('取 token 失败', auth.status, auth.txt.slice(0, 300)); return; }
  console.log('token ok');

  const q = await call(`/sheets/v3/spreadsheets/${TOKEN}/sheets/query`, tk);
  const sheets = (q.json && q.json.data && q.json.data.sheets) || [];
  console.log('工作表数:', sheets.length, 'HTTP', q.status, q.json ? '' : q.txt.slice(0, 200));
  const dump = { token: TOKEN, sheets: [] };
  for (const s of sheets) {
    const rows = s.grid_properties && s.grid_properties.row_count;
    const cols = s.grid_properties && s.grid_properties.column_count;
    const range = `${s.sheet_id}!A1:${colLetter(Math.min(cols || 20, 30))}${Math.min(rows || 500, 500)}`;
    const v = await call(`/sheets/v2/spreadsheets/${TOKEN}/values/${encodeURIComponent(range)}?valueRenderOption=ToString`, tk);
    const values = (v.json && v.json.data && v.json.data.valueRange && v.json.data.valueRange.values) || [];
    console.log(`\n== ${s.title} (${s.sheet_id}) 读到 ${values.length} 行 HTTP${v.status}`);
    dump.sheets.push({ id: s.sheet_id, title: s.title, rows, cols, values });
    values.slice(0, 200).forEach((r, i) => console.log(String(i + 1).padStart(3) + ': ' + JSON.stringify(r)));
  }
  fs.writeFileSync(`${OUT}/exam_papers.json`, JSON.stringify(dump, null, 1), 'utf8');
  console.log('\n已落地 outputs/feishu/exam_papers.json');
})();
