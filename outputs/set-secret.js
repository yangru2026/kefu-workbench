/* 写单个 Secret（Management API） */
const PAT = process.env.SBP_TOKEN;
const REF = 'icfgireprowcqwdodfqx';
const name = process.env.SECRET_NAME;
const value = process.env.SECRET_VALUE;
if (!PAT || !name || !value) { console.log('缺少 SBP_TOKEN / SECRET_NAME / SECRET_VALUE'); process.exit(1); }
(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ name, value }]),
  });
  console.log(name, '→ HTTP', r.status, r.status < 300 ? '✅' : (await r.text()).slice(0, 400));
})();
