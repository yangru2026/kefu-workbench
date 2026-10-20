/* 测试旧项目公共图片 URL 是否仍可访问（判断图片能否搬出） */
const PAT = process.env.SBP_TOKEN;
const OLD = 'ienmejlxukhrxjjxvfqf';
(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${OLD}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `select bucket_id, name, (metadata->>'size')::bigint as sz from storage.objects
              where bucket_id in ('diversion-images','pattern-images','qc-images') order by created_at desc limit 4`,
    }),
  });
  const rows = await r.json();
  console.log('样本:', JSON.stringify(rows));
  for (const o of rows) {
    const u = `https://${OLD}.supabase.co/storage/v1/object/public/${o.bucket_id}/${o.name.split('/').map(encodeURIComponent).join('/')}`;
    try {
      const x = await fetch(u);
      const buf = x.ok ? (await x.arrayBuffer()).byteLength : 0;
      console.log(`${o.bucket_id}/${o.name.slice(0, 30)} → ${x.status} ${x.headers.get('content-type')} ${buf}B`);
    } catch (e) { console.log(o.bucket_id, '异常', e.message); }
  }
})();
