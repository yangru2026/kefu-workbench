const PAT = process.env.SBP_TOKEN;
const REF = 'icfgireprowcqwdodfqx';
(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
    headers: { Authorization: 'Bearer ' + PAT },
  });
  const t = await r.text();
  console.log('HTTP', r.status);
  try {
    const arr = JSON.parse(t);
    arr.forEach((s) => console.log(' -', s.name, '=', String(s.value).slice(0, 6) + '…' + String(s.value).slice(-4), `(len ${String(s.value).length})`));
  } catch (e) { console.log(t.slice(0, 800)); }
})();
