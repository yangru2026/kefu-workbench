// 成绩页修复：按 quiz_key 注入新卷题库映射 PAPER_ANS（题干/大项/正确答案/解析），
// 渲染与导出优先提交自带字段 → PAPER_ANS[quiz_key][题号] → 旧版 BANK（老价格卷回落）
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'quiz-results.html');
const PAPERS_FILE = path.resolve(__dirname, 'exam-papers.js');

// ---- 1) 读 PAPERS ----
const code = fs.readFileSync(PAPERS_FILE, 'utf8');
const PAPERS = new Function(code + '\nreturn PAPERS;')();

const LETTER = (i) => String.fromCharCode(65 + i);
function ansOf(q) {
  try {
    if (q.type === 'single' || q.type === 'judge')
      return (q.type === 'judge' ? '' : LETTER(q.answer) + '. ') + (q.options[q.answer] || '');
    if (q.type === 'multi')
      return q.answer.slice().sort((a, b) => a - b).map((i) => LETTER(i) + '. ' + q.options[i]).join('　');
    if (q.type === 'match')
      return (q.pairs || []).map((p) => p.left + '→' + LETTER(q.rightOptions.indexOf(p.right))).join('　');
    if (q.type === 'text') return q.answer || '';
  } catch (e) { console.log('ansOf ERR no=' + q.no, e.message); }
  return '';
}

const PAPER_ANS = {};
PAPERS.forEach((p) => {
  const m = {};
  (p.questions || []).forEach((q) => {
    m[q.no] = { stem: q.stem || '', sec: q.section || '', ans: ansOf(q), explain: q.explain || '' };
  });
  PAPER_ANS[p.meta.key] = m;
});

// 自检：找到「客户问这款大不大」那道题，打印其正确答案
PAPERS.forEach((p) => (p.questions || []).forEach((q) => {
  if (q.stem && q.stem.includes('这款大不大')) {
    console.log('定位: 卷=' + p.meta.key + ' 题号=' + q.no + ' type=' + q.type);
    console.log('正确答案=' + PAPER_ANS[p.meta.key][q.no].ans);
  }
}));

// ---- 2) 注入 quiz-results.html ----
let html = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');

// 移除旧注入（幂等）
html = html.replace(/\/\* ==PAPER_ANS== \*\/\nconst PAPER_ANS = \{[\s\S]*?\};\n/, '');

const inject = '/* ==PAPER_ANS== */\nconst PAPER_ANS = ' + JSON.stringify(PAPER_ANS) + ';\n';
const anchor = 'const BANK = ';
const i = html.indexOf(anchor);
if (i < 0) throw new Error('找不到 BANK 定义行');
// 插到 BANK 行末尾（该行以 ;\n 结束）
const lineEnd = html.indexOf('\n', i);
html = html.slice(0, lineEnd + 1) + inject + html.slice(lineEnd + 1);

// 3) 加 bankOf 函数（放在 BANK/PAPER_ANS 之后）
if (!html.includes('function bankOf(')) {
  const fn = '\n/* 每题内容：优先 PAPER_ANS[quiz_key][题号]（当前题库），老价格卷回落 BANK */\n' +
    'function bankOf(r, x){\n' +
    '  const m = (PAPER_ANS || {})[r && r.quiz_key];\n' +
    '  const q = m && m[x && x.no];\n' +
    '  if (q) return q;\n' +
    '  return BANK[x && x.no] || {};\n' +
    '}\n';
  // 插在 const $ = id => 之前
  html = html.replace('const $ = id => document.getElementById(id);', fn + 'const $ = id => document.getElementById(id);');
}

// 4) renderDetail：b 改用 bankOf(r, x)
html = html.replace(
  "      const b = BANK[x.no] || {};\n      const stem = x.stem || b.stem || ('第 ' + x.no + ' 题');\n      const exp = x.explain || b.explain || '';",
  "      const b = Object.assign({}, bankOf(r, x), { stem: x.stem || (bankOf(r, x) || {}).stem || '', explain: x.explain || (bankOf(r, x) || {}).explain || '' });\n      const stem = b.stem || ('第 ' + x.no + ' 题');\n      const exp = b.explain || '';"
);

// 5) quizDetailRows：b 改用 bankOf(r, x)
html = html.replace(
  "      const b = BANK[x.no] || {};\n      out.push({",
  "      const b = Object.assign({}, bankOf(r, x), { stem: x.stem || (bankOf(r, x) || {}).stem || '', explain: x.explain || (bankOf(r, x) || {}).explain || '' });\n      out.push({"
);

// 6) wrongRankRows：b 改用 bankOf(r, x)
html = html.replace(
  "      const b = BANK[x.no] || {};\n      return {",
  "      const b = bankOf(r, x) || {};\n      return {"
);

fs.writeFileSync(SRC, html, 'utf8');
console.log('quiz-results.html 注入完成，长度', html.length);
console.log('bankOf 出现次数:', (html.match(/bankOf\(/g) || []).length);
console.log('残留 BANK[x.no] 引用:', (html.match(/BANK\[x\.no\]/g) || []).length);
