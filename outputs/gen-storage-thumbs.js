// 把「thumb 字段为空但图是 Storage 原图」的花色：预转换缩略图 → 存本地待 push 到 GitHub
// 转换端点 = Supabase render/image（内容 100% 来自原图，无错配风险）
// 用法：SBP_TOKEN=sbp_xxx node outputs/gen-storage-thumbs.js
const fs = require('fs');
const path = require('path');
const TOKEN = process.env.SBP_TOKEN;
if (!TOKEN) { console.error('缺少环境变量 SBP_TOKEN'); process.exit(1); }
const REF = 'ienmejlxukhrxjjxvfqf';
const OUT_DIR = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/images/patterns/thumb';

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  if (!r.ok) throw new Error('SQL ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // 目标：缩略图字段为空、且原图字段/数组里有 Storage URL 的记录
  const rows = await q(`select id, brand, name, thumb_eye_url, thumb_lens_url,
      eye_img, lens_img, eye_imgs, lens_imgs
    from pattern_assets
    where coalesce(thumb_eye_url,'')='' or coalesce(thumb_lens_url,'')=''`);
  const jobs = [];
  rows.forEach(r => {
    const first = a => Array.isArray(a) && a.length ? a[0] : '';
    const eyeSrc = r.eye_img || first(r.eye_imgs);
    const lensSrc = r.lens_img || first(r.lens_imgs);
    if (!r.thumb_eye_url && eyeSrc && eyeSrc.includes('/storage/v1/object/public/'))
      jobs.push({ id: r.id, name: r.name, kind: 'eye', src: eyeSrc, file: `u${r.id}_eye.webp` });
    if (!r.thumb_lens_url && lensSrc && lensSrc.includes('/storage/v1/object/public/'))
      jobs.push({ id: r.id, name: r.name, kind: 'lens', src: lensSrc, file: `u${r.id}_lens.webp` });
  });
  console.log('待转换图数:', jobs.length, '（涉及', new Set(jobs.map(j => j.id)).size, '款花色）');

  const sqlLines = [];
  let ok = 0, fail = 0;
  for (const j of jobs) {
    const renderUrl = j.src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
      + '?width=400&quality=72&format=webp';
    try {
      const res = await fetch(renderUrl);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error('体积异常 ' + buf.length + 'B');
      fs.writeFileSync(path.join(OUT_DIR, j.file), buf);
      ok++;
      console.log(`  ✅ ${j.name} [${j.kind}] ${(buf.length / 1024).toFixed(1)}KB → ${j.file}`);
      const field = j.kind === 'eye' ? 'thumb_eye_url' : 'thumb_lens_url';
      sqlLines.push(`update pattern_assets set ${field} = 'images/patterns/thumb/${j.file}' where id = ${j.id};`);
    } catch (e) {
      fail++;
      console.log(`  ❌ ${j.name} [${j.kind}] ${e.message}`);
    }
  }
  console.log(`\n完成：成功 ${ok} / 失败 ${fail}`);
  if (sqlLines.length) {
    fs.writeFileSync('outputs/fix-storage-thumbs.sql',
      '-- 预转换缩略图字段回填（图片已 push 到 images/patterns/thumb/u{id}_*.webp）\n' + sqlLines.join('\n') + '\n');
    console.log('已生成 outputs/fix-storage-thumbs.sql（', sqlLines.length, '条 UPDATE，待执行）');
  }
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
