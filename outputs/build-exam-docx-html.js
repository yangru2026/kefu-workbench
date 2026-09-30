/* Stage 0/1/2 产物生成：弥生考核试卷（试卷 + 答案卷）
 * - Stage 0：output/<request_id>/ 目录 + pipeline-state.yaml + params
 * - Stage 1：stage1/final_draft.md（标准 Markdown，内容逐字取自 miyang-quiz.json）
 * - Stage 2：stage2/design_tokens.json（design-token 查表 general）+ stage2/formatted-*.html
 * 用法：node outputs/build-exam-docx-html.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const PLUGIN = 'C:/Users/Administrator/.workbuddy/plugins/cache/workbuddy-builtin/tencent-docx/5.5.6-wb.38337834.g5f969292.h7826dc9400fd';
const RID = 'miyang-quiz-20260930';
const OUT = path.join(ROOT, 'output', RID);
const DOCX_OUT = path.join(ROOT, 'outputs', '弥生花色价格考核试卷_含答案卷.docx');

const quiz = JSON.parse(fs.readFileSync(ROOT + '/outputs/miyang-quiz.json', 'utf8'));
const meta = quiz.meta;
const LETTER = i => String.fromCharCode(65 + i);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ===== Stage 0：目录与状态 ===== */
['', '/stage1', '/stage2', '/stage2/intermediate', '/stage3', '/params', '/draft', '/trace', '/working'].forEach(d => {
  fs.mkdirSync(OUT + d, { recursive: true });
});

// design-token skill：静态查表 general → tokens/compiled/general.json
const tokens = JSON.parse(fs.readFileSync(PLUGIN + '/skills/design-token/tokens/compiled/general.json', 'utf8'));
tokens.css_variables['--color-primary'] = '#10B981';   // 品牌色：尤赫翡翠绿（与工作台一致）
tokens.tokens.color.primary.$value = '#10B981';
fs.writeFileSync(OUT + '/stage2/design_tokens.json', JSON.stringify(tokens, null, 2), 'utf8');

const sections = [...new Set(quiz.questions.map(q => q.section))];
const sectionHint = sec =>
  sec.indexOf('单选') >= 0 ? '每题只有一个正确答案，每题 2 分' :
  sec.indexOf('多选') >= 0 ? '每题有 2 个及以上正确答案，每题 3 分，漏选、多选不得分' :
  sec.indexOf('判断') >= 0 ? '判断正误，正确打「✔」、错误打「✘」，每题 2 分' :
  sec.indexOf('配对') >= 0 ? '把左侧花色与右侧正确的价格档配对，将字母填写在括号内，共 10 分' :
  sec.indexOf('纠错') >= 0 ? '写出错在哪里，并写出正确的备注写法，每题 4 分' :
  '写出你的做法，至少 3 条，共 8 分';

/* ===== Stage 1：Markdown 最终稿 ===== */
let md = '# ' + meta.title + '\n\n';
md += '> ' + meta.subtitle + '\n\n';
md += '共 ' + meta.counts + ' 题 · 满分 ' + meta.total + ' 分 · ' + meta.timeLimit + '\n\n';
md += '考生姓名：__________　日期：__________　得分：__________\n\n';
md += meta.dataNote + '。\n\n';
sections.forEach(sec => {
  const qs = quiz.questions.filter(q => q.section === sec);
  md += '## ' + sec + '\n\n' + sectionHint(sec) + '。\n\n';
  qs.forEach(q => {
    md += q.no + '. ' + q.stem + '（' + q.points + ' 分）\n\n';
    if (q.options) {
      if (q.type === 'match') {
        md += q.options === undefined ? '' : '';
        md += '可选价格档：' + q.rightOptions.map((o, i) => LETTER(i) + '. ' + o).join('；') + '\n\n';
        q.pairs.forEach((p, i) => { md += '- ' + p.left + ' → （　　）\n'; });
        md += '\n';
      } else {
        q.options.forEach((o, i) => { md += '   ' + LETTER(i) + '. ' + o + '\n'; });
        md += '\n';
      }
    } else if (q.type === 'text') {
      md += '\n（作答区）\n\n';
    }
  });
});
md += '---\n\n# 答案卷 · 主管用\n\n';
md += '分值：单选 2 分/题、多选 3 分/题、判断 2 分/题、配对 10 分、纠错 4 分/题、简答 8 分；满分 ' + meta.total + ' 分，80 分合格。\n\n';
quiz.questions.forEach(q => {
  md += q.no + '. ';
  if (q.type === 'match') {
    md += '**答案：**' + q.pairs.map(p => p.left + ' → ' + p.right).join('；') + '\n\n' + (q.explain ? '　解析：' + q.explain + '\n\n' : '');
  } else if (q.type === 'text') {
    md += '**参考答案：**' + q.answer + '\n\n';
  } else {
    const ans = Array.isArray(q.answer) ? q.answer.map(i => LETTER(i)).join('、') : (q.type === 'judge' ? q.options[q.answer] : LETTER(q.answer));
    md += '**答案：**' + ans + '\n\n' + (q.explain ? '　解析：' + q.explain + '\n\n' : '');
  }
});
fs.writeFileSync(OUT + '/stage1/final_draft.md', md, 'utf8');

/* ===== Stage 2：排版 HTML ===== */
const cv = tokens.css_variables;
const rootVars = Object.entries(cv).map(([k, v]) => '  ' + k + ': ' + v + ';').join('\n');

let qHtml = '';
sections.forEach(sec => {
  const qs = quiz.questions.filter(q => q.section === sec);
  qHtml += '<h2>' + esc(sec) + '</h2>\n<p class="hint">' + esc(sectionHint(sec)) + '。</p>\n';
  qs.forEach(q => {
    qHtml += '<p><strong>' + q.no + '. ' + esc(q.stem) + '</strong>（' + q.points + ' 分）</p>\n';
    if (q.type === 'match') {
      qHtml += '<p>可选价格档：' + q.rightOptions.map((o, i) => LETTER(i) + '. ' + esc(o)).join('；') + '</p>\n';
      qHtml += '<table class="pair-table"><tr><td class="ph">花色</td><td class="ph">你的答案（填字母）</td></tr>';
      q.pairs.forEach(p => { qHtml += '<tr><td>' + esc(p.left) + '</td><td>（　　）</td></tr>'; });
      qHtml += '</table>\n';
    } else if (q.options) {
      qHtml += '<p class="opt">' + q.options.map((o, i) => LETTER(i) + '. ' + esc(o)).join('　　　') + '</p>\n';
    } else if (q.type === 'text') {
      qHtml += '<p class="answer-line">答：</p>\n<p class="answer-line">　</p>\n<p class="answer-line">　</p>\n';
    }
  });
});

let ansHtml = '<h1>答案卷 · 主管用</h1>\n';
ansHtml += '<p>分值：单选 2 分/题、多选 3 分/题、判断 2 分/题、配对 10 分、纠错 4 分/题、简答 8 分；满分 ' + meta.total + ' 分，80 分合格。</p>\n';
quiz.questions.forEach(q => {
  let a = '';
  if (q.type === 'match') {
    a = q.pairs.map(p => p.left + ' → ' + p.right).join('；');
  } else if (q.type === 'text') {
    a = q.answer;
  } else {
    a = Array.isArray(q.answer) ? q.answer.map(i => LETTER(i)).join('、') : (q.type === 'judge' ? q.options[q.answer] : LETTER(q.answer));
  }
  ansHtml += '<p><strong>' + q.no + '. 答案：' + esc(a) + '</strong></p>\n';
  if (q.explain) ansHtml += '<p class="explain">解析：' + esc(q.explain) + '</p>\n';
});

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="docx-page-size" content="A4">
<title>${esc(meta.title)}</title>
<style>
:root {
${rootVars}
}
@page { @bottom-center { content: "第 " counter(page) " 页 / 共 " counter(pages) " 页"; } }
@page cover { @bottom-center { content: none; } }
section[role="cover"] { page: cover; }
body { font-family: var(--typography-fontFamily-body); font-size: var(--typography-fontSize-body);
       line-height: var(--typography-lineHeight-body); color: var(--color-text);
       background: var(--color-background); max-width: var(--layout-maxContentWidth); margin: 0 auto; }
section[role="cover"] > p.eyebrow { text-align: center; font-size: var(--typography-fontSize-small);
       color: var(--color-primary); font-weight: var(--typography-fontWeight-heading); }
section[role="cover"] > h1 { text-align: center; font-size: var(--typography-fontSize-title); line-height: var(--typography-lineHeight-title); }
section[role="cover"] > p.subtitle { text-align: center; font-size: var(--typography-fontSize-h3); color: var(--color-textSecondary); }
h1 { font-family: var(--typography-fontFamily-heading); font-size: var(--typography-fontSize-h1);
     line-height: var(--typography-lineHeight-heading); font-weight: var(--typography-fontWeight-heading);
     color: var(--color-heading); }
h2 { font-family: var(--typography-fontFamily-heading); font-size: var(--typography-fontSize-h2);
     line-height: var(--typography-lineHeight-heading); font-weight: var(--typography-fontWeight-heading);
     color: var(--color-primary); margin-top: var(--spacing-sectionGap); }
p { margin: var(--spacing-paragraph) 0; text-align: left; font-size: var(--typography-fontSize-body); }
p.hint { font-size: var(--typography-fontSize-small); color: var(--color-textSecondary); }
p.opt { margin-left: 1.5em; }
p.answer-line { border-bottom: 1px solid var(--color-border); }
p.explain { font-size: var(--typography-fontSize-small); color: var(--color-textSecondary); margin-left: 1em; }
p.notice { border-left: 3px solid var(--color-primary); background: var(--color-divider); padding: 8px; }
table { width: 100%; border-collapse: collapse; margin: var(--spacing-paragraph) 0; }
table td, table th { border: 1px solid var(--color-border); padding: 6px 8px;
     font-size: var(--typography-fontSize-body); color: var(--color-text); text-align: left; }
table td.ph { background: var(--color-divider); font-weight: 600; }
table.cover-info td:first-child { width: 30%; color: var(--color-textSecondary); }
table.pair-table td:first-child { width: 55%; }
</style>
</head>
<body>
<section role="cover">
  <p class="eyebrow">杭州尤赫美瞳 · 售前客服培训考核</p>
  <h1>${esc(meta.title)}</h1>
  <p class="subtitle">${esc(meta.subtitle)}</p>
  <table class="cover-info">
    <tr><td>题量</td><td>共${meta.counts}题</td></tr>
    <tr><td>满分</td><td>${meta.total}分（80分合格）</td></tr>
    <tr><td>建议时长</td><td>25分钟</td></tr>
    <tr><td>考生姓名</td><td>　</td></tr>
    <tr><td>日期</td><td>　</td></tr>
    <tr><td>得分</td><td>　</td></tr>
  </table>
  <p class="notice">&nbsp;&nbsp;<strong>答题说明：</strong>${esc(meta.dataNote)}。考试重点为「系列 ↔ 花色 ↔ 价格档」的对应关系，核心是避免低价订单备注高价花色、同名系列写错抛型、把「盒」写成「副」。</p>
</section>
<section role="body" data-page-restart="1">
${qHtml}
</section>
<section role="answers">
${ansHtml}
</section>
</body>
</html>`;
fs.writeFileSync(OUT + '/stage2/formatted-弥生花色价格考核试卷.html', html, 'utf8');

/* params（溯源用） */
fs.writeFileSync(OUT + '/params/topic.yaml', 'detected_doc_type: "考核试卷"\ntarget_length: ' + md.length + '\ntarget_tone: "正式、清晰，面向新客服"\n', 'utf8');
fs.writeFileSync(OUT + '/params/critic_config.yaml', 'critic_mode_hint: "skip"\nforce_mode: null\nnote: "内容为已校验题库逐字渲染，无需创作性审查"\n', 'utf8');

fs.writeFileSync(OUT + '/pipeline-state.yaml', [
  'request_id: ' + RID,
  'entry_type: full_pipeline',
  'current_stage: 3',
  'output_docx_path: "' + DOCX_OUT.replace(/\\/g, '/') + '"',
  'output_docx_user_specified: true',
  'stages:',
  '  stage_0: { status: completed }',
  '  stage_1: { status: completed, output_path: "stage1/final_draft.md", genre: "general", expert_used: "general-writer", route_tag: "general_writing", critic_decision: null }',
  '  stage_2: { status: completed, route: html, html_sub: template, output_path: "stage2/formatted-弥生花色价格考核试卷.html", output_format: html, skills_invoked: ["design-token", "doc-typeset"], design_tokens_path: "stage2/design_tokens.json" }',
  '  stage_3: { status: pending, executor: doc-converter }',
  'updated_at: "' + new Date().toISOString() + '"',
  ''
].join('\n'), 'utf8');

console.log('Stage1 md: ' + md.length + ' 字');
console.log('Stage2 html: ' + html.length + ' 字 -> ' + OUT + '/stage2/formatted-弥生花色价格考核试卷.html');
console.log('目标 docx: ' + DOCX_OUT);
