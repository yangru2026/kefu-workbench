/* 由题库 JSON 生成在线答题页 quiz.html（单文件、免登录、自动判分、可打印）
 * 用法：node outputs/build-quiz-page.js
 */
const fs = require('fs');
const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const quiz = JSON.parse(fs.readFileSync(ROOT + '/outputs/miyang-quiz.json', 'utf8'));
const DATA = JSON.stringify(quiz);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>弥生 · 花色与价格 考核试卷</title>
<style>
  :root{--primary:#10b981;--primary-dark:#059669;--primary-light:rgba(16,185,129,.1);
        --danger:#e05252;--warn:#c2660a;--text:#1e293b;--muted:#64748b;--border:#e2e8f0;--bg:#f7f9f8;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
       background:var(--bg);color:var(--text);line-height:1.65;}
  .topbar{background:#fff;border-bottom:1px solid var(--border);padding:14px 20px;display:flex;
          align-items:center;gap:12px;flex-wrap:wrap;position:sticky;top:0;z-index:10;}
  .topbar h1{font-size:18px;font-weight:800;letter-spacing:.4px;}
  .topbar .meta{font-size:12.5px;color:var(--muted);}
  .spacer{flex:1;}
  .btn{padding:8px 20px;border:none;border-radius:20px;font-size:13.5px;font-weight:700;cursor:pointer;
       font-family:inherit;transition:all .15s;}
  .btn-primary{background:var(--primary);color:#fff;}
  .btn-primary:hover{background:var(--primary-dark);}
  .btn-ghost{background:#fff;color:var(--primary);border:1.5px solid var(--primary);}
  .btn-ghost:hover{background:var(--primary-light);}
  .wrap{max-width:860px;margin:0 auto;padding:18px 20px 80px;}
  .intro{background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:16px;
         box-shadow:0 2px 12px rgba(31,41,55,.05);}
  .intro h2{font-size:15px;font-weight:800;margin-bottom:8px;}
  .intro p{font-size:13.5px;color:var(--muted);}
  .intro .warn{color:var(--danger);font-weight:700;margin-top:8px;font-size:13.5px;}
  .sec{background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:16px;
       box-shadow:0 2px 12px rgba(31,41,55,.05);}
  .sec > h2{font-size:15px;font-weight:800;color:var(--primary-dark);margin-bottom:4px;
            border-left:4px solid var(--primary);padding-left:10px;}
  .sec > .hint{font-size:12.5px;color:var(--muted);margin:6px 0 14px 14px;}
  .q{padding:12px 0;border-bottom:1px dashed var(--border);}
  .q:last-child{border-bottom:none;}
  .q-head{display:flex;gap:8px;font-size:14.5px;font-weight:700;align-items:flex-start;}
  .q-no{color:var(--primary-dark);flex-shrink:0;}
  .q-pts{font-size:11.5px;color:var(--muted);font-weight:600;flex-shrink:0;margin-top:3px;}
  .opts{margin:8px 0 0 22px;display:flex;flex-direction:column;gap:6px;}
  .opt{display:flex;gap:8px;align-items:flex-start;font-size:14px;cursor:pointer;padding:5px 10px;
       border:1.5px solid var(--border);border-radius:9px;background:#fff;transition:all .12s;}
  .opt:hover{border-color:var(--primary);}
  .opt input{margin-top:4px;accent-color:var(--primary);flex-shrink:0;}
  .opt.sel{background:var(--primary-light);border-color:var(--primary);}
  .ta{width:100%;min-height:64px;margin:8px 0 0 22px;width:calc(100% - 22px);padding:9px 12px;
      border:1.5px solid var(--border);border-radius:9px;font-family:inherit;font-size:13.5px;outline:none;resize:vertical;}
  .ta:focus{border-color:var(--primary);}
  .match-row{display:flex;align-items:center;gap:10px;margin:8px 0 0 22px;flex-wrap:wrap;font-size:14px;}
  .match-row .left{font-weight:700;min-width:130px;}
  .match-row select{padding:7px 10px;border:1.5px solid var(--border);border-radius:9px;font-family:inherit;
                    font-size:13.5px;outline:none;background:#fff;flex:1;min-width:200px;}
  .judge-ok{border-color:var(--primary)!important;background:var(--primary-light)!important;}
  .judge-no{border-color:var(--danger)!important;background:rgba(224,82,82,.08)!important;}
  .res{margin-top:8px;margin-left:22px;font-size:13px;border-radius:9px;padding:8px 12px;display:none;}
  .res.show{display:block;}
  .res.ok{background:var(--primary-light);color:#065f46;}
  .res.bad{background:rgba(224,82,82,.08);color:#9b2c2c;}
  .res .tag{font-weight:800;margin-right:6px;}
  .res .exp{margin-top:4px;color:var(--text);}
  .score{background:#fff;border:2px solid var(--primary);border-radius:14px;padding:18px;margin-bottom:16px;
         text-align:center;display:none;box-shadow:0 4px 18px rgba(16,185,129,.15);}
  .score.show{display:block;}
  .score .big{font-size:40px;font-weight:800;color:var(--primary-dark);line-height:1.2;}
  .score .sub{font-size:13.5px;color:var(--muted);margin-top:4px;}
  .score .detail{margin-top:12px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
  .score .cell{background:var(--primary-light);border-radius:10px;padding:8px 14px;font-size:12.5px;}
  .score .cell b{display:block;font-size:18px;color:var(--primary-dark);}
  .selfscore{margin-left:22px;margin-top:6px;font-size:13px;color:var(--muted);}
  .selfscore select{padding:5px 8px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;}
  .footbar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--border);
           padding:10px 20px;display:flex;gap:12px;align-items:center;justify-content:center;z-index:20;}
  .footbar .tip{font-size:12.5px;color:var(--muted);}
  @media print{
    .topbar,.footbar,.btn{display:none!important;}
    body{background:#fff;}
    .sec{box-shadow:none;break-inside:avoid;}
    .res{display:block!important;}
  }
  @media (max-width:600px){ .wrap{padding:12px 12px 90px;} .q-pts{display:none;} }
</style>
</head>
<body>
<div class="topbar">
  <h1 id="tTitle"></h1>
  <span class="meta" id="tMeta"></span>
  <span class="spacer"></span>
  <button class="btn btn-ghost" onclick="window.print()">🖨 打印</button>
</div>
<div class="wrap">
  <div class="intro">
    <h2>📋 答题说明</h2>
    <p id="introText"></p>
    <div class="warn">⚠️ 易错重点：低价订单备注高价花色 / 同名系列写错抛型 / 把「盒」写成「副」。交卷后可见每题解析。</div>
  </div>
  <div class="score" id="scoreBox"></div>
  <div id="paper"></div>
</div>
<div class="footbar">
  <span class="tip" id="footTip">做完点交卷，系统自动判分</span>
  <button class="btn btn-primary" id="btnSubmit">✅ 交卷判分</button>
  <button class="btn btn-ghost" id="btnReset">↺ 重做</button>
</div>
<script>
const QUIZ = ${DATA};
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LETTER = i => String.fromCharCode(65 + i);

$('tTitle').textContent = QUIZ.meta.title;
$('tMeta').textContent = '共 ' + QUIZ.meta.counts + ' 题 · 满分 ' + QUIZ.meta.total + ' 分 · ' + QUIZ.meta.timeLimit;
$('introText').textContent = QUIZ.meta.subtitle + '。' + QUIZ.meta.dataNote;

/* 按 section 分组渲染 */
let html = '';
const sections = [...new Set(QUIZ.questions.map(q => q.section))];
sections.forEach(sec => {
  const qs = QUIZ.questions.filter(q => q.section === sec);
  html += '<div class="sec"><h2>' + esc(sec) + '</h2><div class="hint">' +
    (sec.indexOf('单选') >= 0 ? '每题只有一个正确答案，2 分/题' :
     sec.indexOf('多选') >= 0 ? '每题有 2 个及以上正确答案，3 分/题，漏选少选不得分' :
     sec.indexOf('判断') >= 0 ? '判断正误，2 分/题' :
     sec.indexOf('配对') >= 0 ? '把左侧花色与右侧正确的价格档配对，10 分' :
     sec.indexOf('纠错') >= 0 ? '写出错在哪里 + 正确写法，每题 4 分，按参考解析自评' :
     '写出你的做法，8 分，按参考解析自评') + '</div>';
  qs.forEach(q => {
    html += '<div class="q" id="q' + q.no + '"><div class="q-head"><span class="q-no">' + q.no + '.</span>' +
      '<span>' + esc(q.stem) + '</span><span class="q-pts">(' + q.points + '分)</span></div>';
    if (q.type === 'single' || q.type === 'judge') {
      html += '<div class="opts">' + q.options.map((o, i) =>
        '<label class="opt" data-no="' + q.no + '" data-i="' + i + '"><input type="radio" name="q' + q.no + '" value="' + i + '">' +
        '<span>' + (q.type === 'judge' ? '' : LETTER(i) + '. ') + esc(o) + '</span></label>').join('') + '</div>';
    } else if (q.type === 'multi') {
      html += '<div class="opts">' + q.options.map((o, i) =>
        '<label class="opt" data-no="' + q.no + '" data-i="' + i + '"><input type="checkbox" name="q' + q.no + '" value="' + i + '">' +
        '<span>' + LETTER(i) + '. ' + esc(o) + '</span></label>').join('') + '</div>';
    } else if (q.type === 'match') {
      html += '<div style="font-size:13px;color:var(--muted);margin:6px 0 2px 22px;">右侧选项：' +
        q.rightOptions.map((o, i) => LETTER(i) + '. ' + esc(o)).join('　') + '</div>';
      html += q.pairs.map((p, i) => '<div class="match-row"><span class="left">' + esc(p.left) + '</span><span>→</span>' +
        '<select data-no="' + q.no + '" data-i="' + i + '"><option value="">请选择字母</option>' +
        q.rightOptions.map((o, j) => '<option value="' + LETTER(j) + '">' + LETTER(j) + '. ' + esc(o) + '</option>').join('') +
        '</select></div>').join('');
    } else if (q.type === 'text') {
      html += '<textarea class="ta" data-no="' + q.no + '" rows="' + (q.points >= 8 ? 5 : 3) + '" placeholder="在这里作答…"></textarea>';
    }
    html += '<div class="res" id="res' + q.no + '"></div></div>';
  });
  html += '</div>';
});
$('paper').innerHTML = html;

/* 选中态视觉 */
document.querySelectorAll('.opt input').forEach(inp => {
  inp.addEventListener('change', () => {
    document.querySelectorAll('.opt input[name="' + inp.name + '"]').forEach(x =>
      x.closest('.opt').classList.toggle('sel', x.checked));
  });
});

/* 判分 */
function grade() {
  window.__qRes = [];
  QUIZ.questions.forEach(q => {
    const el = $('res' + q.no);
    let got = 0, full = q.points, detail = '';
    if (q.type === 'single' || q.type === 'judge') {
      const sel = document.querySelector('input[name="q' + q.no + '"]:checked');
      const chosen = sel ? +sel.value : -1;
      got = (chosen === q.answer) ? full : 0;
      if (chosen >= 0) document.querySelectorAll('.opt[data-no="' + q.no + '"]')[chosen].classList.add(chosen === q.answer ? 'judge-ok' : 'judge-no');
      if (chosen !== q.answer) document.querySelectorAll('.opt[data-no="' + q.no + '"]')[q.answer].classList.add('judge-ok');
      detail = '正确答案：' + (q.type === 'judge' ? q.options[q.answer] : LETTER(q.answer) + '. ' + esc(q.options[q.answer]));
    } else if (q.type === 'multi') {
      const sels = [...document.querySelectorAll('input[name="q' + q.no + '"]:checked')].map(x => +x.value).sort();
      const ans = q.answer.slice().sort();
      const right = sels.length === ans.length && sels.every((v, i) => v === ans[i]);
      got = right ? full : 0;
      ans.forEach(i => document.querySelectorAll('.opt[data-no="' + q.no + '"]')[i].classList.add('judge-ok'));
      sels.filter(i => ans.indexOf(i) < 0).forEach(i => document.querySelectorAll('.opt[data-no="' + q.no + '"]')[i].classList.add('judge-no'));
      detail = '正确答案：' + ans.map(i => LETTER(i) + '. ' + esc(q.options[i])).join('　');
    } else if (q.type === 'match') {
      const sels = [...document.querySelectorAll('select[data-no="' + q.no + '"]')].map(s => s.value);
      const rightCount = q.pairs.filter((p, i) => {
        const li = q.rightOptions.indexOf(p.right);
        return sels[i] === LETTER(li);
      }).length;
      got = Math.round(full * rightCount / q.pairs.length);
      detail = '正确答案：' + q.pairs.map(p => esc(p.left) + '→' + LETTER(q.rightOptions.indexOf(p.right))).join('　') +
        '（右侧：' + q.rightOptions.map((o, i) => LETTER(i) + '.' + esc(o)).join('　') + '）';
    } else if (q.type === 'text') {
      el.innerHTML = '<span class="tag">📖 参考答案</span><div class="exp">' + esc(q.answer).replace(/\\n/g, '<br>') + '</div>' +
        '<div class="selfscore">自评得分：<select data-no="' + q.no + '" class="self">' +
        Array.from({ length: full + 1 }, (_, i) => '<option value="' + i + '">' + i + '</option>').join('') +
        '</select> / ' + full + ' 分</div>';
      el.className = 'res show';
      window.__qRes.push({ no: q.no, section: q.section, got: 0, full: full, kind: 'self' });
      el.querySelector('.self').addEventListener('change', updateScore);
      return;   // 文本题分数由自评决定
    }
    window.__qRes.push({ no: q.no, section: q.section, got: got, full: full, kind: 'auto' });
    el.className = 'res show ' + (got === full ? 'ok' : 'bad');
    el.innerHTML = '<span class="tag">' + (got === full ? '✔ 正确 +' + got : '✘ 错误 +' + got + '/' + full) + '</span>' +
      '<div class="exp">' + detail + '<br>' + esc(q.explain || '') + '</div>';
  });
  updateScore();
}

/* 汇总：客观题按判分结果，主观题按自评下拉实时重算 */
function updateScore() {
  const rows = window.__qRes || [];
  rows.forEach(r => {
    if (r.kind === 'self') {
      const s = document.querySelector('select.self[data-no="' + r.no + '"]');
      r.got = s ? +s.value : 0;
    }
  });
  const got = rows.reduce((n, r) => n + r.got, 0);
  const auto = rows.filter(r => r.kind === 'auto');
  const autoGot = auto.reduce((n, r) => n + r.got, 0);
  const autoFull = auto.reduce((n, r) => n + r.full, 0);
  const selfRows = rows.filter(r => r.kind === 'self');
  const selfGot = selfRows.reduce((n, r) => n + r.got, 0);
  const selfFull = selfRows.reduce((n, r) => n + r.full, 0);
  const total = QUIZ.meta.total;
  const per = {};
  rows.forEach(r => { per[r.section] = per[r.section] || { got: 0, full: 0 }; per[r.section].got += r.got; per[r.section].full += r.full; });
  const pass = got >= Math.ceil(total * 0.8);
  const box = $('scoreBox');
  box.innerHTML = '<div class="big">' + got + ' / ' + total + '</div>' +
    '<div class="sub">' + (pass ? '✅ 合格（80 分以上）' : '⚠️ 未达 80 分，建议复习易错点后重做') +
    '　·　客观题 ' + autoGot + ' / ' + autoFull + '　·　主观题自评 ' + selfGot + ' / ' + selfFull + '</div>' +
    '<div class="detail">' + Object.entries(per).map(([k, v]) =>
      '<div class="cell"><b>' + v.got + '/' + v.full + '</b>' + esc(k) + '</div>').join('') + '</div>';
  box.classList.add('show');
  $('footTip').textContent = '得分 ' + got + ' / ' + total;
}

$('btnSubmit').addEventListener('click', () => {
  const un = QUIZ.questions.filter(q => {
    if (q.type === 'single' || q.type === 'judge') return !document.querySelector('input[name="q' + q.no + '"]:checked');
    if (q.type === 'multi') return document.querySelectorAll('input[name="q' + q.no + '"]:checked').length === 0;
    if (q.type === 'match') return [...document.querySelectorAll('select[data-no="' + q.no + '"]')].some(s => !s.value);
    return false;
  });
  if (un.length) {
    if (!confirm('还有 ' + un.length + ' 题没作答（第 ' + un.map(q => q.no).join('、') + ' 题），确定交卷？')) return;
  }
  grade();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('btnReset').addEventListener('click', () => location.reload());
document.querySelectorAll('select.self').forEach(s => {});
</script>
</body>
</html>`;

fs.writeFileSync(ROOT + '/quiz.html', html, 'utf8');
console.log('quiz.html 生成完成，大小=' + Math.round(html.length / 1024) + 'KB，题量=' + quiz.questions.length + ' 满分=' + quiz.meta.total);
