/* quiz-results.html 人工评分改造：
   - 明细里主观题（review/self）给 admin 评分输入
   - 「保存人工评分」一次性回写 detail/score/auto_score/self_score/self_total
   - 记录卡加「⏳ 待评分」徽章 */
const fs = require('fs');
const base = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/';
let s = fs.readFileSync(base + 'quiz-results.html', 'utf8').replace(/\r\n/g, '\n');

function must(oldStr, newStr, tag) {
  if (s.indexOf(oldStr) < 0) { console.error('❌ 未找到锚点[' + tag + ']：' + String(oldStr).slice(0, 80)); process.exit(1); }
  s = s.split(oldStr).join(newStr);
}

/* 1) CSS */
must(
  '  .qd.selfkind{border-left-color:#cbd5e1;background:#fbfcfd;}',
  `  .qd.selfkind{border-left-color:#cbd5e1;background:#fbfcfd;}
  .grade-line{margin-top:8px;padding:9px 12px;border-radius:10px;background:#f0fdf4;border:1px dashed #86efac;font-size:13.5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
  .grade-line input.grad{width:76px;padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-weight:700;font-family:inherit;text-align:center;}
  .save-bar{margin-top:16px;padding:12px 14px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  .save-bar .saveBtn{border:none;background:var(--primary);color:#fff;font-weight:800;font-size:14px;padding:10px 18px;border-radius:10px;cursor:pointer;font-family:inherit;}
  .save-bar .saveBtn:hover{background:var(--primary-dark);}
  .save-bar .saveBtn[disabled]{opacity:.6;}
  .save-bar .hint{font-size:12.5px;color:var(--muted);}
  .rec-tag.pending{background:#fef3c7;color:#92400e;}`,
  'css'
);

/* 2) 明细题块：review 徽章 + 评分输入 */
must(
  `      const ok = x.got >= x.full;
      const isSelf = x.kind === 'self';
      html += '<div class="qd' + (ok ? '' : ' wrong') + (isSelf ? ' selfkind' : '') + '">' +
        '<div class="qd-h"><span class="num">' + x.no + '.</span><span>' + esc(stem) + '</span>' +
          '<span class="pt">' + (isSelf ? '自评 ' : '') + x.got + '/' + x.full + '</span></div>' +
        '<div class="qd-sec">' + esc(b.sec || x.sec || '') + '</div>' +
        '<div class="qd-line"><span class="k">正确答案</span><span class="right">' +
          esc(b.ans || '—').replace(/\\n/g, '<br>') + '</span></div>' +
        '<div class="qd-line"><span class="k">她的' + (isSelf ? '作答' : '选择') + '</span><span class="mine' + (ok ? '' : ' bad') + '">' +
          esc(x.ans || '未作答') + '</span></div>' +
        (exp ? '<div class="qd-exp">💡 ' + esc(exp).replace(/\\n/g, '<br>') + '</div>' : '') +
      '</div>';`,
  `      const ok = x.got >= x.full;
      const isSelf = x.kind === 'self';
      const isReview = x.kind === 'review';
      const canGrade = isAdmin && (isReview || isSelf);
      html += '<div class="qd' + (ok ? '' : ' wrong') + ((isSelf || isReview) ? ' selfkind' : '') + '">' +
        '<div class="qd-h"><span class="num">' + x.no + '.</span><span>' + esc(stem) + '</span>' +
          '<span class="pt">' + (isSelf ? '自评 ' : isReview ? (x.reviewed ? '人工评 ' : '待评 ') : '') + x.got + '/' + x.full + '</span></div>' +
        '<div class="qd-sec">' + esc(b.sec || x.sec || '') + '</div>' +
        '<div class="qd-line"><span class="k">正确答案</span><span class="right">' +
          esc(b.ans || '—').replace(/\\n/g, '<br>') + '</span></div>' +
        '<div class="qd-line"><span class="k">她的' + (isSelf || isReview ? '作答' : '选择') + '</span><span class="mine' + (ok ? '' : ' bad') + '">' +
          esc(x.ans || '未作答') + '</span></div>' +
        (exp ? '<div class="qd-exp">💡 ' + esc(exp).replace(/\\n/g, '<br>') + '</div>' : '') +
        (canGrade
          ? '<div class="grade-line">✍️ 人工评分：<input type="number" class="grad" data-no="' + x.no +
            '" min="0" max="' + x.full + '" value="' + (x.reviewed ? x.got : 0) + '"> / ' + x.full +
            ' 分　<b style="color:' + (x.reviewed ? 'var(--primary-dark)' : '#92400e') + ';">' + (x.reviewed ? '已评' : '未评') + '</b></div>'
          : '') +
      '</div>';`,
  'detail-block'
);

/* 3) modal 底部保存条 */
must(
  `  html += '<div style="margin-top:14px;font-size:12.5px;color:var(--muted);">' +
    '想对照原题：<span class="link" onclick="window.open(\\'' + QUIZ_FILE + '\\',\\'_blank\\')">打开试卷 ↗</span>' +
    '　·　主观题（纠错 / 简答）是考生自评，可打印卷面复核。</div>';`,
  `  html += '<div style="margin-top:14px;font-size:12.5px;color:var(--muted);">' +
    '想对照原题：<span class="link" onclick="window.open(\\'' + QUIZ_FILE + '\\',\\'_blank\\')">打开试卷 ↗</span>' +
    '　·　简答题可在此人工评分（自评卷仍是考生自评，可打印卷面复核）。</div>';
  const gradable = isAdmin && d.some(x => x.kind === 'review' || x.kind === 'self');
  if (gradable) html += '<div class="save-bar"><button class="saveBtn" id="btnSaveGrades">💾 保存人工评分</button>' +
    '<span class="hint">按评分要点给分，改完点一次保存，总分自动重算</span></div>';`,
  'save-bar'
);

/* 4) 绑定保存按钮 + saveGrades 函数 */
must(
  `  const cb = $('qdWrong');
  if(cb) cb.addEventListener('change', () => { onlyWrong = cb.checked; renderDetail(); });
}`,
  `  const cb = $('qdWrong');
  if(cb) cb.addEventListener('change', () => { onlyWrong = cb.checked; renderDetail(); });
  const sbtn = $('btnSaveGrades');
  if(sbtn) sbtn.addEventListener('click', saveGrades);
}

/* ==================== 人工评分：回写主观题分数并重算总分 ==================== */
async function saveGrades(){
  const r = curDetail; if(!r) return;
  const d = Array.isArray(r.detail) ? r.detail : [];
  const byNo = {};
  document.querySelectorAll('#mBody input.grad').forEach(i => {
    const no = +i.dataset.no, max = +i.max || 0;
    let v = Math.round(+i.value || 0);
    if (v < 0) v = 0; if (v > max) v = max;
    byNo[no] = v;
  });
  const newDetail = d.map(x => ((x.kind === 'review' || x.kind === 'self') && byNo[x.no] != null)
    ? Object.assign({}, x, { got: byNo[x.no], reviewed: true }) : x);
  const sum = a => a.reduce((n, x) => n + (x.got || 0), 0);
  const subj = newDetail.filter(x => x.kind === 'self' || x.kind === 'review');
  const patch = {
    detail: newDetail,
    score: sum(newDetail),
    auto_score: sum(newDetail.filter(x => x.kind === 'auto')),
    self_score: sum(subj),
    self_total: subj.reduce((n, x) => n + (x.full || 0), 0)
  };
  const btn = $('btnSaveGrades');
  btn.disabled = true; btn.textContent = '💾 保存中…';
  const { error } = await sb.from('quiz_results').update(patch).eq('id', r.id);
  btn.disabled = false; btn.textContent = '💾 保存人工评分';
  if (error) { alert('保存失败：' + error.message); return; }
  Object.assign(r, patch);
  toast('✅ 评分已保存，总分 ' + patch.score + ' / ' + (r.total || 100));
  renderDetail();
  render();
}`,
  'save-fn'
);

/* 5) 记录卡：待评分徽章（person 视图） */
must(
  `      return '<div class="rec">' +
        '<span class="rec-name">' + esc(p.name) + '</span>' +
        '<span class="rec-score ' + cls + '">' + r.score + '<small> / ' + (r.total||100) + '</small></span>' +
        '<span class="rec-tag ' + (pass ? 'pass' : 'fail') + '">' + (pass ? '✅ 合格' : '⚠️ 未合格') + '</span>' +`,
  `      const pending = (Array.isArray(r.detail) ? r.detail : []).some(x => x.kind === 'review' && !x.reviewed);
      return '<div class="rec">' +
        '<span class="rec-name">' + esc(p.name) + '</span>' +
        '<span class="rec-score ' + cls + '">' + r.score + '<small> / ' + (r.total||100) + '</small></span>' +
        (pending ? '<span class="rec-tag pending">⏳ 待评分</span>' : '') +
        '<span class="rec-tag ' + (pass ? 'pass' : 'fail') + '">' + (pass ? '✅ 合格' : '⚠️ 未合格') + '</span>' +`,
  'card-person'
);

/* 6) 记录卡：待评分徽章（全部记录视图） */
must(
  `      return '<div class="rec">' +
        '<span class="rec-name">' + esc(r.examinee) + '</span>' +
        '<span class="rec-score ' + cls + '">' + r.score + '<small> / ' + (r.total||100) + '</small></span>' +
        '<span class="rec-tag ' + (pass ? 'pass' : 'fail') + '">' + (pass ? '合格' : '未合格') + '</span>' +`,
  `      const pending = (Array.isArray(r.detail) ? r.detail : []).some(x => x.kind === 'review' && !x.reviewed);
      return '<div class="rec">' +
        '<span class="rec-name">' + esc(r.examinee) + '</span>' +
        '<span class="rec-score ' + cls + '">' + r.score + '<small> / ' + (r.total||100) + '</small></span>' +
        (pending ? '<span class="rec-tag pending">⏳ 待评分</span>' : '') +
        '<span class="rec-tag ' + (pass ? 'pass' : 'fail') + '">' + (pass ? '合格' : '未合格') + '</span>' +`,
  'card-all'
);

/* 7) meta 文案：主观自评 → 主观（兼容人工评分） */
must(
  "(r.self_total ? ' · 主观自评 <b>' + (r.self_score||0) + '/' + r.self_total + '</b>' : '') +",
  "(r.self_total ? ' · 主观 <b>' + (r.self_score||0) + '/' + r.self_total + '</b>' : '') +",
  'meta-subj'
);

fs.writeFileSync(base + 'quiz-results.html', s, 'utf8');
console.log('✅ quiz-results.html 人工评分改造完成，长度', s.length);
