// 校验 quiz.html 里的 PAPERS：试卷数、题数、答案索引合法性
const fs = require('fs');
const s = fs.readFileSync('C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/quiz.html', 'utf8');
const m = s.match(/const PAPERS = (\[[\s\S]*?\]);\nlet curPaper/);
if (!m) { console.error('未找到 PAPERS'); process.exit(1); }
const papers = JSON.parse(m[1]);
console.log('试卷数 =', papers.length);
let bad = 0;
papers.forEach(p => {
  const t = {};
  p.questions.forEach(q => { t[q.type] = (t[q.type] || 0) + 1; });
  const sum = p.questions.reduce((n, q) => n + q.points, 0);
  console.log(' -', p.meta.title, '| key=' + p.meta.key, '| 题数=' + p.meta.counts,
    '| 总分=' + p.meta.total, '| 实际合计=' + sum, '|', JSON.stringify(t));
  p.questions.forEach(q => {
    if (q.type === 'single' || q.type === 'judge') {
      if (!(q.answer >= 0 && q.answer < q.options.length)) { console.error('❌ 答案越界', p.meta.title, q.no); bad++; }
    }
    if (!q.stem) { console.error('❌ 空题干', p.meta.title, q.no); bad++; }
  });
  if (sum !== p.meta.total) { console.error('❌ 总分不一致', p.meta.title); bad++; }
});
console.log(bad ? ('❌ 问题 ' + bad + ' 处') : '✅ 全部校验通过');
