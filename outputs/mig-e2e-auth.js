/* 端到端验证：造一个临时账号 → 密码登录 → 读 profiles → 删除临时账号 */
const PAT = process.env.SBP_TOKEN;
const REF = process.env.NEW_REF || 'icfgireprowcqwdodfqx';
(async () => {
  const k = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: 'Bearer ' + PAT } })).json();
  const svc = (k.find(x => x.name === 'service_role') || {}).api_key || (k.find(x => x.type === 'secret') || {}).api_key || (k.find(x => x.type === 'secret') || {}).key;
  const pub = (k.find(x => x.type === 'publishable') || {}).api_key;
  const base = `https://${REF}.supabase.co`;
  const email = `mig-test-${Date.now()}@example.com`, pw = 'Test#2026mig';

  let r = await fetch(base + '/auth/v1/admin/users', {
    method: 'POST',
    headers: { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw, email_confirm: true }),
  });
  const u = await r.json();
  console.log('建临时用户:', r.status, u.id || JSON.stringify(u).slice(0, 150));
  if (!r.ok) return;

  r = await fetch(base + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: pub, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw }),
  });
  const tok = await r.json();
  console.log('密码登录:', r.status, tok.access_token ? '✅ 拿到 token' : '❌ ' + JSON.stringify(tok).slice(0, 200));

  if (tok.access_token) {
    const rr = await fetch(`${base}/rest/v1/profiles?select=id,role&id=eq.${u.id}`, {
      headers: { apikey: pub, Authorization: 'Bearer ' + tok.access_token },
    });
    console.log('触发器建 profile:', rr.status, (await rr.text()).slice(0, 120));
  }

  // 真实数据抽样（service role 绕过 RLS）
  const cnt = await fetch(`${base}/rest/v1/diversion_transfers?select=id&limit=1`, {
    headers: { apikey: svc, Authorization: 'Bearer ' + svc, Prefer: 'count=exact' },
  });
  console.log('diversion_transfers 抽样:', cnt.status, cnt.headers.get('content-range'));

  const del = await fetch(`${base}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: { apikey: svc, Authorization: 'Bearer ' + svc } });
  console.log('删除临时用户:', del.status);
})();
