/* quiz.html 两件事：
   1) 用最新 outputs/exam-papers.js 单点替换 PAPERS（不动其他改造）
   2) 试卷五（exam-五）的简答题改为「主管人工评分」：kind='review'，不自评；
      其他卷的简答题保持原自评逻辑 */
const fs = require('fs');
const base = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/';
let s = fs.readFileSync(base + 'quiz.html', 'utf8').replace(/\r\n/g, '\n');
const papers = fs.readFileSync(base + 'outputs/exam-papers.js', 'utf8').trim();

function must(oldStr, newStr, tag) {
  if (s.indexOf(oldStr) < 0) { console.error('❌ 未找到锚点[' + tag + ']：' + oldStr.slice(0, 80)); process.exit(1); }
  s = s.split(oldStr).join(newStr);
}

/* ---- 1) PAPERS 单点替换（从 const PAPERS 到该行结束） ---- */
{
  const a = s.indexOf('const PAPERS = ');
  if (a < 0) { console.error('❌ 未找到 PAPERS'); process.exit(1); }
  const b = s.indexOf('\n', a);
  s = s.slice(0, a) + papers + s.slice(b);
}

/* ---- 2) 人工评分开关：试卷五走 review ---- */
must(
  "let submitted = false;",
  "let submitted = false;\n" +
  "// 人工评分卷：该卷简答题交卷后由主管在「考核成绩」页打分，客服不自评\n" +
  "const MANUAL_GRADE = () => QUIZ.meta.key === 'exam-五';",
  'manual-flag'
);

/* ---- 3) 简答题渲染：人工评分卷不给自评提示 ---- */
must(
  `    } else if (q.type === 'text') {
      html += '<textarea class="ta" data-no="' + q.no + '" rows="' + (q.points >= 8 ? 5 : 3) + '" placeholder="在这里作答…"></textarea>' +
        '<div style="font-size:12.5px;color:var(--muted);margin:4px 0 0 22px;">交卷后显示参考答案，需自评打分（' + q.points + ' 分）</div>';
    }`,
  `    } else if (q.type === 'text') {
      html += '<textarea class="ta" data-no="' + q.no + '" rows="' + (q.points >= 8 ? 5 : 3) + '" placeholder="在这里作答…"></textarea>' +
        '<div style="font-size:12.5px;color:var(--muted);margin:4px 0 0 22px;">' +
        (MANUAL_GRADE()
          ? '简答题由主管人工评分（本题 ' + q.points + ' 分），交卷即可，无需自评。'
          : '交卷后显示参考答案，需自评打分（' + q.points + ' 分）') + '</div>';
    }`,
  'text-render'
);

/* ---- 4) 判分：人工评分卷的简答题 kind='review'、got=0 ---- */
must(
  `    } else if (q.type === 'text') {
      const ta = document.querySelector('textarea[data-no="' + q.no + '"]');
      myAns = (ta && ta.value.trim()) ? ta.value.trim().slice(0, 500) : '未作答';
      // 重新交卷时要保住考生已选的自评分，否则自评会被重置为 0
      const prevSel = document.querySelector('select.self[data-no="' + q.no + '"]');
      const prevVal = prevSel ? prevSel.value : '0';
      el.innerHTML = '<span class="tag">📖 参考答案</span><div class="exp">' + esc(q.answer).replace(/\\n/g, '<br>') + '</div>' +
        '<div class="selfscore">自评得分：<select data-no="' + q.no + '" class="self">' +
        Array.from({ length: full + 1 }, (_, i) => '<option value="' + i + '">' + i + '</option>').join('') +
        '</select> / ' + full + ' 分</div>';
      el.className = 'res show';
      window.__qRes.push({ no: q.no, section: q.section, ans: myAns, got: +prevVal, full: full, kind: 'self' });
      const newSel = el.querySelector('.self');
      newSel.value = prevVal;
      newSel.addEventListener('change', updateScore);
      return;   // 文本题分数由自评决定
    }`,
  `    } else if (q.type === 'text') {
      const ta = document.querySelector('textarea[data-no="' + q.no + '"]');
      myAns = (ta && ta.value.trim()) ? ta.value.trim().slice(0, 500) : '未作答';
      if (MANUAL_GRADE()) {
        el.innerHTML = '<span class="tag">⏳ 待主管人工评分</span>' +
          '<div class="exp">评分要点：' + esc(q.answer).replace(/\\n/g, '<br>') + '</div>';
        el.className = 'res show';
        window.__qRes.push({ no: q.no, section: q.section, ans: myAns, got: 0, full: full, kind: 'review' });
        return;
      }
      // 重新交卷时要保住考生已选的自评分，否则自评会被重置为 0
      const prevSel = document.querySelector('select.self[data-no="' + q.no + '"]');
      const prevVal = prevSel ? prevSel.value : '0';
      el.innerHTML = '<span class="tag">📖 参考答案</span><div class="exp">' + esc(q.answer).replace(/\\n/g, '<br>') + '</div>' +
        '<div class="selfscore">自评得分：<select data-no="' + q.no + '" class="self">' +
        Array.from({ length: full + 1 }, (_, i) => '<option value="' + i + '">' + i + '</option>').join('') +
        '</select> / ' + full + ' 分</div>';
      el.className = 'res show';
      window.__qRes.push({ no: q.no, section: q.section, ans: myAns, got: +prevVal, full: full, kind: 'self' });
      const newSel = el.querySelector('.self');
      newSel.value = prevVal;
      newSel.addEventListener('change', updateScore);
      return;   // 文本题分数由自评决定
    }`,
  'text-grade'
);

/* ---- 5) 分数汇总：review 题不计入合格判断，单独提示 ---- */
must(
  `  const selfRows = rows.filter(r => r.kind === 'self');
  const selfGot = selfRows.reduce((n, r) => n + r.got, 0);
  const selfFull = selfRows.reduce((n, r) => n + r.full, 0);
  const total = QUIZ.meta.total;
  const per = {};
  rows.forEach(r => { per[r.section] = per[r.section] || { got: 0, full: 0 }; per[r.section].got += r.got; per[r.section].full += r.full; });
  const pass = got >= Math.ceil(total * 0.8);
  const box = $('scoreBox');
  box.innerHTML = '<div class="big">' + got + ' / ' + total + '</div>' +
    '<div class="sub">' + (pass ? '✅ 合格（80 分以上）' : '⚠️ 未达 80 分，建议复习易错点后重做') +
    '　·　客观题 ' + autoGot + ' / ' + autoFull + '　·　主观题自评 ' + selfGot + ' / ' + selfFull + '</div>' +`,
  `  const selfRows = rows.filter(r => r.kind === 'self');
  const selfGot = selfRows.reduce((n, r) => n + r.got, 0);
  const selfFull = selfRows.reduce((n, r) => n + r.full, 0);
  const reviewRows = rows.filter(r => r.kind === 'review');
  const reviewFull = reviewRows.reduce((n, r) => n + r.full, 0);
  const total = QUIZ.meta.total;
  const per = {};
  rows.forEach(r => { if (r.kind === 'review') return; per[r.section] = per[r.section] || { got: 0, full: 0 }; per[r.section].got += r.got; per[r.section].full += r.full; });
  const hasReview = reviewRows.length > 0;
  const pass = got >= Math.ceil(total * 0.8);
  const box = $('scoreBox');
  box.innerHTML = '<div class="big">' + got + (hasReview ? ' <span style="font-size:15px;color:var(--muted);">+ 待评</span>' : ' / ' + total) + '</div>' +
    '<div class="sub">' + (hasReview
      ? '⏳ 简答题 ' + reviewRows.length + ' 题（' + reviewFull + ' 分）由主管人工评分，下方为已判得分'
      : (pass ? '✅ 合格（80 分以上）' : '⚠️ 未达 80 分，建议复习易错点后重做')) +
    '　·　客观题 ' + autoGot + ' / ' + autoFull + (selfFull ? '　·　主观题自评 ' + selfGot + ' / ' + selfFull : '') + '</div>' +`,
  'score-box'
);

must(
  "$('footTip').textContent = '得分 ' + got + ' / ' + total;",
  "$('footTip').textContent = '得分 ' + got + (hasReview ? ' + 待评' : ' / ' + total);",
  'foot-tip'
);

/* ---- 6) 提交：主观题合计含 review；提示语区分 ---- */
must(
  "  const autoRows = rows.filter(r => r.kind === 'auto');\n  const selfRows = rows.filter(r => r.kind === 'self');",
  "  const autoRows = rows.filter(r => r.kind === 'auto');\n  const selfRows = rows.filter(r => r.kind === 'self');\n  const reviewRows = rows.filter(r => r.kind === 'review');\n  const reviewFull = reviewRows.reduce((n, r) => n + r.full, 0);",
  'report-rows'
);
must(
  "    self_score: sum(selfRows),\n    self_total: selfRows.reduce((n, r) => n + r.full, 0),",
  "    self_score: sum(selfRows) + sum(reviewRows),\n    self_total: selfRows.reduce((n, r) => n + r.full, 0) + reviewFull,",
  'report-self'
);
must(
  `    const hasSelf = (payload.self_total || 0) > 0;
    const selfDone = (payload.self_score || 0) > 0;
    const needSelf = hasSelf && !selfDone;
    btn.disabled = false;
    btn.textContent = needSelf ? '📤 提交自评后的成绩' : '🔄 重新交卷';
    setNote('✅ <b>已提交</b>：' + name + ' 的成绩 <b>' + payload.score + ' / ' + payload.total +
      '</b> 已交给主管。' +
      (needSelf`,
  `    const hasReview = reviewRows.length > 0;
    const hasSelf = (payload.self_total || 0) > 0 && !hasReview;
    const selfDone = (payload.self_score || 0) > 0;
    const needSelf = hasSelf && !selfDone;
    btn.disabled = false;
    btn.textContent = needSelf ? '📤 提交自评后的成绩' : '🔄 重新交卷';
    setNote('✅ <b>已提交</b>：' + name +
      (hasReview
        ? ' 的答卷已交给主管。简答题 ' + reviewRows.length + ' 题（' + reviewFull + ' 分）由主管人工评分，<b>无需自评</b>；出分前已判部分 <b>' + payload.score + '</b> 分。'
        : ' 的成绩 <b>' + payload.score + ' / ' + payload.total + '</b> 已交给主管。') +
      (needSelf`,
  'report-note'
);

fs.writeFileSync(base + 'quiz.html', s, 'utf8');
console.log('✅ quiz.html 完成：新题库注入 + 试卷五人工评分改造，长度', s.length);
