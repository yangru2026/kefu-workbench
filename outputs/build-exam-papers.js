/* 把飞书试卷表（outputs/feishu/exam_papers.json）转成 quiz.html 用的 PAPERS 常量 */
const fs = require('fs');
const SRC = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/feishu/exam_papers.json';
const OUT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/exam-papers.js';
const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const clean = v => (v === null || v === undefined) ? '' : String(v).trim();
const LETTER = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function build(sheet) {
  const rows = (sheet.values || []).map(r => r || []);
  const title = clean(rows[0] && rows[0][0]);
  const intro = clean(rows[1] && rows[1][0]);
  const qs = [];
  rows.slice(3).forEach(r => {
    const type = clean(r[1]);
    const stem = clean(r[2]);
    if (!stem) return;
    const points = Number(r[8]) || 0;
    const answer = clean(r[7]);
    const explain = clean(r[9]);
    if (type === '简答') {
      qs.push({ type: 'text', section: '简答题', stem: stem, answer: explain, points: points });
    } else if (type === '判断') {
      qs.push({ type: 'judge', section: '判断题', stem: stem, options: ['正确', '错误'],
        answer: answer === '错误' ? 1 : 0, explain: explain, points: points });
    } else {
      const opts = [r[3], r[4], r[5], r[6]].map(clean).filter(Boolean);
      qs.push({ type: 'single', section: '单选题', stem: stem, options: opts,
        answer: LETTER[answer] !== undefined ? LETTER[answer] : 0, explain: explain, points: points });
    }
  });
  qs.forEach((q, i) => { q.no = i + 1; });
  const total = qs.reduce((n, q) => n + q.points, 0);
  const m = String(title).match(/试卷(.)/);
  // ⚠️ key 必须保持中文（exam-一…），quiz_results.quiz_key 历史记录全存的中文，换数字会导致成绩页映射失配
  const key = m ? m[1] : 'x';
  const meta = {
    key: 'exam-' + key,
    title: title,
    subtitle: '客服考试 · ' + title,
    intro: intro,
    counts: qs.length,
    total: total,
    dataNote: '题目同步自飞书《客服考试》试卷表，改表格后重新导入即可更新',
    timeLimit: '满分 ' + total + ' 分（合格率 80%）'
  };
  return { meta: meta, questions: qs };
}

const papers = j.sheets.filter(s => /^试卷/.test(s.title)).map(build);
fs.writeFileSync(OUT, 'const PAPERS = ' + JSON.stringify(papers) + ';', 'utf8');
papers.forEach(p => {
  const t = {};
  p.questions.forEach(q => { t[q.type] = (t[q.type] || 0) + 1; });
  console.log(p.meta.title, '| key=' + p.meta.key, '| 题数=' + p.meta.counts, '| 总分=' + p.meta.total,
    '| 单选' + (t.single || 0), '判断' + (t.judge || 0), '简答' + (t.text || 0));
});
console.log('已生成', OUT);
