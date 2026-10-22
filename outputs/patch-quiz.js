/* 把飞书同步来的试卷注入 quiz.html：旧题库整段替换 + 多试卷切换 */
const fs = require('fs');
const base = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/';
let s = fs.readFileSync(base + 'quiz.html', 'utf8');
const papers = fs.readFileSync(base + 'outputs/exam-papers.js', 'utf8').trim();

function must(oldStr, newStr) {
  if (s.indexOf(oldStr) < 0) { console.error('❌ 未找到锚点：' + oldStr.slice(0, 90)); process.exit(1); }
  s = s.split(oldStr).join(newStr);
}

// 1) 旧题库整段替换（从 const QUIZ = { 到该行结尾）
const start = s.indexOf('const QUIZ = {');
const end = s.indexOf('\n', start);
if (start < 0 || end < 0) { console.error('❌ 未找到 QUIZ 常量'); process.exit(1); }
s = s.slice(0, start) + papers + '\nlet curPaper = 0;\nlet QUIZ = PAPERS[0];' + s.slice(end);

// 2) 页面标题
must('<title>弥生 · 花色与价格 考核试卷</title>', '<title>客服考试</title>');

// 3) 试卷切换 Tab 的样式
must('  .intro{background:#fff;',
`  .papers{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
  .ptab{padding:7px 15px;border-radius:20px;border:1.5px solid var(--border);background:#fff;
        font-family:inherit;font-size:13.5px;font-weight:700;color:var(--muted);cursor:pointer;transition:all .15s;}
  .ptab:hover{border-color:var(--primary);color:var(--primary-dark);}
  .ptab.on{background:var(--primary);border-color:var(--primary);color:#fff;}
  .intro{background:#fff;`);

// 4) 说明区加试卷切换条 + 换掉旧提示语
must('    <h2>📋 答题说明</h2>',
     '    <h2>📋 答题说明</h2>\n    <div class="papers" id="paperTabs"></div>');
must('    <div class="warn">⚠️ 易错重点：低价订单备注高价花色 / 同名系列写错抛型 / 把「盒」写成「副」。交卷后可见每题解析。</div>',
     '    <div class="warn">⚠️ 先选试卷 → 填姓名 → 答题 → 交卷。交卷后自动判分并显示每题解析，成绩同步到「考核成绩」页（主管按姓名查）。</div>');

// 5) 每份卷用各自的 key，成绩页才能区分
must("const QUIZ_KEY = 'miyang-color-price';", 'const QUIZ_KEY = () => QUIZ.meta.key;');
must('quiz_key: QUIZ_KEY,', 'quiz_key: QUIZ_KEY(),');

// 6) 顶部信息 + 切卷逻辑
must(`$('tTitle').textContent = QUIZ.meta.title;
$('tMeta').textContent = '共 ' + QUIZ.meta.counts + ' 题 · 满分 ' + QUIZ.meta.total + ' 分 · ' + QUIZ.meta.timeLimit;
$('introText').textContent = QUIZ.meta.subtitle + '。' + QUIZ.meta.dataNote;`,
`function renderTabs(){
  $('paperTabs').innerHTML = PAPERS.map((p, i) =>
    '<button class="ptab' + (i === curPaper ? ' on' : '') + '" onclick="switchPaper(' + i + ')">'
    + esc(p.meta.title) + '</button>').join('');
}
function renderMeta(){
  QUIZ = PAPERS[curPaper];
  $('tTitle').textContent = QUIZ.meta.title;
  $('tMeta').textContent = '共 ' + QUIZ.meta.counts + ' 题 · 满分 ' + QUIZ.meta.total + ' 分 · ' + QUIZ.meta.timeLimit;
  $('introText').textContent = (QUIZ.meta.subtitle || '') + '。' + (QUIZ.meta.dataNote || '');
}
function switchPaper(i){
  if (i === curPaper) return;
  if (window.__qRes && window.__qRes.length && !confirm('切换试卷会清空当前作答，确定吗？')) return;
  curPaper = i;
  submitted = false;
  window.__qRes = [];
  $('scoreBox').classList.remove('show');
  $('submitNote').className = 'submit-note';
  $('btnSubmit').disabled = false;
  $('btnSubmit').textContent = '✅ 交卷判分';
  renderTabs(); renderMeta(); buildPaper();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}`);

// 7) 渲染主体包成函数，切卷时重建
must("/* 按 section 分组渲染 */\nlet html = '';", "/* 按 section 分组渲染 */\nfunction buildPaper(){\nlet html = '';");
must("$('paper').innerHTML = html;", "$('paper').innerHTML = html;\n  bindOpts();\n}");
must(`/* 选中态视觉 */
document.querySelectorAll('.opt input').forEach(inp => {
  inp.addEventListener('change', () => {
    document.querySelectorAll('.opt input[name="' + inp.name + '"]').forEach(x =>
      x.closest('.opt').classList.toggle('sel', x.checked));
  });
});`,
`/* 选中态视觉（切卷重绘后要重新绑定） */
function bindOpts() {
  document.querySelectorAll('.opt input').forEach(inp => {
    inp.addEventListener('change', () => {
      document.querySelectorAll('.opt input[name="' + inp.name + '"]').forEach(x =>
        x.closest('.opt').classList.toggle('sel', x.checked));
    });
  });
}`);

// 8) 启动时渲染
must("$('btnReset').addEventListener('click', () => location.reload());",
`$('btnReset').addEventListener('click', () => location.reload());
renderTabs(); renderMeta(); buildPaper();`);

fs.writeFileSync(base + 'quiz.html', s, 'utf8');
console.log('✅ quiz.html 已注入 ' + papers.length + ' 字节题库并完成多试卷改造');
