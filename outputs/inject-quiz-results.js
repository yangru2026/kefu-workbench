/* 把 anon key 与题库注入 quiz.html / quiz-results.html 的占位符
 * 用法：node outputs/inject-quiz-results.js
 * 说明：anon key 从 diversion.html 里提取（不落日志、不打印），题库从 quiz.html 提取
 */
const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';

function extractJson(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('未找到标记：' + marker);
  const j = src.indexOf('{', i);
  let depth = 0, inStr = false, esc = false;
  for (let k = j; k < src.length; k++) {
    const ch = src[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(j, k + 1); }
  }
  throw new Error('JSON 不完整');
}

// 1) anon key（从已有页面提取）
const div = fs.readFileSync(path.join(ROOT, 'diversion.html'), 'utf8');
const km = div.match(/const\s+SUPABASE_KEY\s*=\s*['"]([^'"]+)['"]/);
if (!km) throw new Error('diversion.html 里没找到 SUPABASE_KEY');
const KEY = km[1];
console.log('anon key 提取成功（长度 ' + KEY.length + '，前缀 ' + KEY.slice(0, 4) + '…）');

// 2) 题库（题号 -> 题干/大项/分值/正确答案/解析），用于成绩详情里显示题目与对照答案
const LETTER = i => String.fromCharCode(65 + i);
const quiz = fs.readFileSync(path.join(ROOT, 'quiz.html'), 'utf8');
const quizObj = JSON.parse(extractJson(quiz, 'const QUIZ ='));
const bank = {};
quizObj.questions.forEach(q => {
  let right = '';
  if (q.type === 'single') right = LETTER(q.answer) + '. ' + q.options[q.answer];
  else if (q.type === 'judge') right = q.options[q.answer];
  else if (q.type === 'multi') right = q.answer.map(i => LETTER(i) + '. ' + q.options[i]).join('　');
  else if (q.type === 'match') right = q.pairs.map(p => p.left + '→' + LETTER(q.rightOptions.indexOf(p.right))).join('　');
  else right = q.answer || '';   // 主观题：参考答案全文
  bank[q.no] = { stem: q.stem, sec: q.section, points: q.points, type: q.type, ans: right, explain: q.explain || '' };
});
console.log('题库提取成功：' + Object.keys(bank).length + ' 题（含正确答案与解析）');

// 3) 注入
let changed = 0;
['quiz.html', 'quiz-results.html'].forEach(f => {
  const p = path.join(ROOT, f);
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  s = s.split('__SUPABASE_ANON_KEY__').join(KEY);
  const bankJson = JSON.stringify(bank);
  if (/const BANK = \{[\s\S]*?\};/.test(s)) {
    // 已注入过 → 整体替换（幂等，方便以后改题库后重新跑）
    s = s.replace(/const BANK = \{[\s\S]*?\};/, 'const BANK = ' + bankJson + ';');
  } else {
    s = s.split('__QUIZ_BANK__').join(bankJson);
  }
  if (s !== before) { fs.writeFileSync(p, s); changed++; console.log('✔ ' + f + ' 已注入'); }
  else console.log('· ' + f + ' 无变化');
});
console.log('完成，共更新 ' + changed + ' 个文件');
