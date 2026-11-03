/* 列出「弥生售前班表」所有工作表 + 打印某张表前几行 */
const APP_ID = process.env.FEISHU_APP_ID || 'cli_aafc447873a1dbc3';
const APP_SECRET = process.env.FEISHU_APP_SECRET || '';
if (!APP_SECRET) { console.log('缺少环境变量 FEISHU_APP_SECRET'); process.exit(1); }
const SS = 'SwHcw0zKai3o4gk1pzLcu7MAnVb';

(async () => {
  const tr = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const t = (await tr.json()).tenant_access_token;

  const meta = await (await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SS}/metainfo`, {
    headers: { Authorization: 'Bearer ' + t },
  })).json();
  console.log('标题:', meta.data?.properties?.title, '| 工作表数:', meta.data?.sheets?.length);
  const list = (meta.data?.sheets || []).map((s, i) => `${i}:${s.sheetId}「${s.title}」${s.rowCount}x${s.columnCount}`);
  console.log(list.join('\n'));

  const target = process.argv[2] || '';
  const sheet = (meta.data?.sheets || []).find((s) => String(s.title).includes(target)) || (meta.data?.sheets || [])[0];
  console.log('\n读取:', sheet.title, sheet.sheetId);
  const range = `${sheet.sheetId}!A1:AO12`;
  const vr = await (await fetch(
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SS}/values/${encodeURI(range)}?valueRenderOption=ToString`,
    { headers: { Authorization: 'Bearer ' + t } },
  )).json();
  const values = vr.data?.valueRange?.values || [];
  values.forEach((row, i) => {
    console.log(`r${i}: ` + row.map((c) => String(c ?? '')).join(' | ').slice(0, 300));
  });
})();
