// 探测：PAT 能管哪些组织/项目；旧项目数据库能否直连查询
const PAT = process.env.SBP_TOKEN;
if (!PAT) { console.log('缺少 SBP_TOKEN'); process.exit(1); }

async function api(path, opts = {}) {
  const r = await fetch('https://api.supabase.com' + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch (e) { j = txt.slice(0, 300); }
  return { status: r.status, body: j };
}

(async () => {
  const orgs = await api('/v1/organizations');
  console.log('== 组织 ==', orgs.status);
  (Array.isArray(orgs.body) ? orgs.body : [orgs.body]).forEach(o =>
    console.log('  ', o.id, '|', o.name, '| plan:', o.plan));

  const prs = await api('/v1/projects');
  console.log('== 项目 ==', prs.status);
  (Array.isArray(prs.body) ? prs.body : [prs.body]).forEach(p =>
    console.log('  ', p.id, '|', p.name, '|', p.region, '|', p.status));

  const q = await api('/v1/projects/ienmejlxukhrxjjxvfqf/database/query', {
    method: 'POST',
    body: JSON.stringify({ query: 'select count(*) as n from public.profiles;' }),
  });
  console.log('== 旧项目 SQL 直连 ==', q.status, JSON.stringify(q.body).slice(0, 300));
})();
