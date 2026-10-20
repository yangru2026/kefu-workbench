/* 列出组织与用量，确认额度是否组织级 */
const PAT = process.env.SBP_TOKEN;
async function api(path) {
  const r = await fetch('https://api.supabase.com' + path, {
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
  });
  const txt = await r.text();
  let json = null; try { json = JSON.parse(txt); } catch (e) { }
  return { status: r.status, json, txt };
}
(async () => {
  const orgs = await api('/v1/organizations');
  console.log('组织:', orgs.status);
  (orgs.json || []).forEach(o => console.log(' -', o.id, o.slug, o.name, 'plan=' + o.plan));

  for (const o of (orgs.json || [])) {
    const u = await api(`/v1/organizations/${o.slug}/usage`);
    console.log(`\n[${o.slug}] usage HTTP ${u.status}`);
    if (u.json) {
      const pick = ['egress', 'cached_egress', 'storage', 'db_size', 'monthly_active_users'];
      pick.forEach(k => { if (u.json[k]) console.log('  ', k, JSON.stringify(u.json[k])); });
      if (!pick.some(k => u.json[k])) console.log('  raw:', JSON.stringify(u.json).slice(0, 800));
    } else console.log('  ', u.txt.slice(0, 300));
  }

  // 项目所属组织确认
  for (const ref of ['ienmejlxukhrxjjxvfqf', 'lzmtyqsnxjvyajgswgum']) {
    const p = await api(`/v1/projects/${ref}`);
    if (p.json) console.log(`\n项目 ${ref}: org=${p.json.organization_id} status=${p.json.status} region=${p.json.region}`);
  }

  const plans = await api('/v1/organizations/jqbhbgqopukvvtxpuygs/billing/subscription');
  console.log('\n订阅:', plans.status, plans.txt.slice(0, 300));
})();
