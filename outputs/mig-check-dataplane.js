/* 验证新项目数据面是否可用：api-keys / REST / Auth / Storage 直连 */
const PAT = process.env.SBP_TOKEN;
const NEW = 'lzmtyqsnxjvyajgswgum';
const OLD = 'ienmejlxukhrxjjxvfqf';

async function api(path, opt = {}) {
  const r = await fetch('https://api.supabase.com' + path, {
    method: opt.method || 'GET',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const txt = await r.text();
  return { status: r.status, ok: r.ok, txt };
}

(async () => {
  for (const [label, ref] of [['新', NEW], ['旧', OLD]]) {
    const k = await api(`/v1/projects/${ref}/api-keys`);
    let anon = null;
    try {
      const arr = JSON.parse(k.txt);
      const a = arr.find(x => x.name === 'anon' || x.type === 'publishable' || /anon/.test(x.name || ''));
      anon = (a && (a.api_key || a.key)) || (arr[0] && (arr[0].api_key || arr[0].key));
      console.log(`[${label}] api-keys HTTP ${k.status} 数量=${arr.length} names=${arr.map(x => x.name).join('|')}`);
    } catch (e) { console.log(`[${label}] api-keys 解析失败`, k.status, k.txt.slice(0, 200)); }

    if (anon) {
      for (const p of ['/auth/v1/health', '/rest/v1/', '/storage/v1/bucket']) {
        try {
          const r = await fetch(`https://${ref}.supabase.co${p}`, {
            headers: { apikey: anon, Authorization: 'Bearer ' + anon },
          });
          const t = await r.text();
          console.log(`  ${p} → ${r.status} ${t.slice(0, 180)}`);
        } catch (e) { console.log(`  ${p} → 异常 ${e.message}`); }
      }
    }
  }
})();
