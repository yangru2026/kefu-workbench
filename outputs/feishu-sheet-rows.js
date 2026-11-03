/* 打印 26-11月 第 N 行起的数据（看尾部统计行/杂行） */
const APP_ID = process.env.FEISHU_APP_ID || 'cli_aafc447873a1dbc3';
const APP_SECRET = process.env.FEISHU_APP_SECRET || '';
if (!APP_SECRET) { console.log('缺少环境变量 FEISHU_APP_SECRET'); process.exit(1); }
const SS = 'SwHcw0zKai3o4gk1pzLcu7MAnVb';
const SHEET = process.argv[2] || 'F2E4o9';
const FROM = parseInt(process.argv[3] || '20', 10);
const TO = parseInt(process.argv[4] || '50', 10);

(async () => {
  const tr = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const t = (await tr.json()).tenant_access_token;
  const range = `${SHEET}!A${FROM}:H${TO}`;
  const vr = await (await fetch(
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SS}/values/${encodeURI(range)}?valueRenderOption=ToString`,
    { headers: { Authorization: 'Bearer ' + t } },
  )).json();
  const values = vr.data?.valueRange?.values || [];
  values.forEach((row, i) => {
    console.log(`r${FROM + i}: ` + row.map((c) => String(c ?? '')).join(' | '));
  });
})();
