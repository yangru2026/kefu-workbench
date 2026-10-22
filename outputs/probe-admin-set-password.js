// 探测 admin-set-password：不带 JWT 应返回 401（=函数已部署且鉴权生效）
const REF = 'icfgireprowcqwdodfqx';
const ANON = 'sb_publishable_LF-obMSRD7DFsY0AcjYZuQ_53P6UlQ8';
fetch(`https://${REF}.supabase.co/functions/v1/admin-set-password`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${ANON}`, 'apikey': ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000000', password: 'test123' }),
})
  .then(async (r) => { console.log('HTTP', r.status); console.log(await r.text()); })
  .catch((e) => console.error('请求失败:', e.message));
