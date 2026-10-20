/* 查看项目 API keys 结构（只打印名字/类型/前缀，不泄露完整 key） */
const PAT = process.env.SBP_TOKEN;
const REF = process.env.REF || 'lzmtyqsnxjvyajgswgum';
(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, {
    headers: { Authorization: 'Bearer ' + PAT },
  });
  const arr = await r.json();
  console.log('HTTP', r.status, 'count', Array.isArray(arr) ? arr.length : '?');
  (arr || []).forEach(k => {
    const v = k.api_key || k.key || '';
    console.log(`- name=${k.name} type=${k.type} id=${k.id} prefix=${String(v).slice(0, 12)}… len=${String(v).length}`);
  });
})();
