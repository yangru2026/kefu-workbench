// 诊断：缺缩略图的花色，能否用「同 basename → thumb/{base}.webp」确定性补齐
// 只输出清单，不执行任何写操作
// ⚠️ Token 一律走环境变量，禁止硬编码（会被 GitHub Secret Scanning 拦下推送）
// 用法：SBP_TOKEN=sbp_xxx node outputs/diag-thumb-gap.js
const TOKEN = process.env.SBP_TOKEN;
if (!TOKEN) { console.error('缺少环境变量 SBP_TOKEN'); process.exit(1); }
const REF = 'ienmejlxukhrxjjxvfqf';

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  if (!r.ok) throw new Error('SQL ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}

(async () => {
  // 1. 拉 thumb 目录文件名清单
  const r = await fetch('https://api.github.com/repos/yangru2026/kefu-workbench/contents/images/patterns/thumb?per_page=1000', {
    headers: { 'User-Agent': 'diag' }
  });
  const files = (await r.json()).map(f => f.name);
  const thumbSet = new Set(files);
  console.log('thumb 目录文件数:', files.length);

  // 2. 查所有花色
  const rows = await q(`select id, brand, name, thumb_eye_url, thumb_lens_url, eye_img, lens_img from pattern_assets order by brand, name`);
  const usedThumbs = new Set();
  rows.forEach(r => {
    [r.thumb_eye_url, r.thumb_lens_url].forEach(u => { if (u) usedThumbs.add(u.split('/').pop()); });
  });
  const orphan = files.filter(f => !usedThumbs.has(f));
  console.log('数据库已引用的 thumb 文件数:', usedThumbs.size, '| 未被引用的孤儿文件数:', orphan.length);

  // 3. 对缺失项做确定性映射：eye_img = images/patterns/{base}.{ext} => thumb/{base}.webp
  const canFix = [];
  const cantFix = [];
  rows.forEach(r => {
    ['eye', 'lens'].forEach(kind => {
      const thumbField = kind === 'eye' ? 'thumb_eye_url' : 'thumb_lens_url';
      const imgField = kind === 'eye' ? 'eye_img' : 'lens_img';
      if (r[thumbField]) return;                    // 已有缩略图
      const img = r[imgField] || '';
      if (!img) return;                             // 连原图都没有
      const m = img.match(/^images\/patterns\/(.+)\.(jpg|jpeg|png)$/i);
      if (!m) { cantFix.push({ name: r.name, kind, img, why: '原图非标准路径（UUID/脏数据）' }); return; }
      const candidate = 'images/patterns/thumb/' + m[1] + '.webp';
      const fname = m[1] + '.webp';
      if (thumbSet.has(fname)) canFix.push({ id: r.id, name: r.name, field: thumbField, value: candidate });
      else cantFix.push({ name: r.name, kind, img, why: 'thumb 目录无对应文件 ' + fname });
    });
  });

  console.log('\n=== 可确定性补齐（同 basename 命中）===');
  console.log('数量:', canFix.length);
  canFix.forEach(c => console.log('  ' + c.name + '  ' + c.field + ' → ' + c.value));

  console.log('\n=== 无法自动补齐 ===');
  console.log('数量:', cantFix.length);
  const byWhy = {};
  cantFix.forEach(c => { byWhy[c.why] = (byWhy[c.why] || 0) + 1; });
  Object.entries(byWhy).forEach(([k, v]) => console.log('  ' + v + ' 例：' + k));

  // 4. 孤儿文件抽样（可能是"有图但没挂到记录上"）
  console.log('\n=== 孤儿文件抽样（前 20）===');
  orphan.slice(0, 20).forEach(f => console.log('  ' + f));

  if (canFix.length) {
    const sql = canFix.map(c => `update pattern_assets set ${c.field} = '${c.value}' where id = ${c.id};`).join('\n');
    require('fs').writeFileSync('outputs/fix-thumbs.sql', '-- 确定性补齐缩略图字段（同 basename 命中 thumb 目录）\n' + sql + '\n');
    console.log('\n已生成 outputs/fix-thumbs.sql（'+ canFix.length +' 条，未执行）');
  }
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
