/* 新建一个组织，绕开原组织被占满的免费额度 */
const PAT = process.env.SBP_TOKEN;
const NAME = process.argv[2] || 'kefu-v2';

async function api(path, opt = {}) {
  const r = await fetch('https://api.supabase.com' + path, {
    method: opt.method || 'GET',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const txt = await r.text();
  let json = null; try { json = JSON.parse(txt); } catch (e) { }
  return { status: r.status, json, txt };
}

(async () => {
  const r = await api('/v1/organizations', { method: 'POST', body: { name: NAME } });
  console.log('POST /v1/organizations →', r.status, r.txt.slice(0, 500));
  if (!r.ok) process.exit(1);
  const list = await api('/v1/organizations');
  (list.json || []).forEach(o => console.log(' -', o.id, o.slug, o.name));
})();
