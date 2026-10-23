// 对比新旧 exam_papers.json：各卷行数、题目变化
const fs = require('fs');
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const prev = load(__dirname + '/feishu/exam_papers_prev.json');
const curr = load(__dirname + '/feishu/exam_papers.json');

function rowsOf(dump) {
  const m = {};
  dump.sheets.forEach((s) => { m[s.title] = s.values || []; });
  return m;
}
const P = rowsOf(prev), C = rowsOf(curr);
const titles = new Set([...Object.keys(P), ...Object.keys(C)]);
titles.forEach((t) => {
  const a = P[t] || [], b = C[t] || [];
  const fill = (arr) => arr.filter((r) => r && (r[0] != null || r[2] != null));
  const fa = fill(a), fb = fill(b);
  console.log(`\n== ${t}: 旧${fa.length}行 -> 新${fb.length}行`);
  const n = Math.max(fa.length, fb.length);
  for (let i = 0; i < n; i++) {
    const ja = JSON.stringify(fa[i] || null), jb = JSON.stringify(fb[i] || null);
    if (ja !== jb) {
      console.log(`  行${i + 1} 变化:`);
      if (ja) console.log('    旧=' + ja.slice(0, 260));
      if (jb) console.log('    新=' + jb.slice(0, 260));
    }
  }
  if (fa.length === fb.length && !fa.some((r, i) => JSON.stringify(r) !== JSON.stringify(fb[i]))) console.log('  （无变化）');
});
