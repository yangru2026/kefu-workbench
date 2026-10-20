/* 尝试把空项目 kefu-workbench-v2 转移到新组织（项目内还没有数据，失败无损） */
const PAT = process.env.SBP_TOKEN;
const REF = 'lzmtyqsnxjvyajgswgum';
const TARGET = 'nvfnngdobixbclqiioct';

async function call(method, path, body) {
  const r = await fetch('https://api.supabase.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  return { status: r.status, txt };
}

(async () => {
  const tries = [
    ['POST', `/v1/projects/${REF}/transfer`, { target_organization_slug: TARGET }],
    ['POST', `/v1/projects/${REF}/transfer`, { target_organization_id: TARGET }],
    ['PATCH', `/v1/projects/${REF}`, { organization_id: TARGET }],
  ];
  for (const [m, p, b] of tries) {
    const r = await call(m, p, b);
    console.log(`${m} ${p} ${JSON.stringify(b)} → ${r.status} ${r.txt.slice(0, 250)}`);
    if (r.status < 300) { console.log('✅ 成功'); break; }
  }
  const info = await call('GET', `/v1/projects/${REF}`);
  try { const j = JSON.parse(info.txt); console.log('\n项目当前 org:', j.organization_id); } catch (e) { }
})();
