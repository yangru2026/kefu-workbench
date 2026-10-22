/* 把 exam_papers.json 里的有效行以 UTF-8 明文落地，便于阅读 */
const fs = require('fs');
const p = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/feishu/exam_papers.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const lines = [];
j.sheets.forEach(sh => {
  const vals = (sh.values || []).filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));
  lines.push('===== 工作表: ' + sh.title + ' (' + sh.id + ') 有效行 ' + vals.length + ' =====');
  vals.forEach(r => lines.push(JSON.stringify(r)));
  lines.push('');
});
fs.writeFileSync('C:/temp/exam_dump.txt', lines.join('\n'), 'utf8');
console.log('sheets=', j.sheets.length, 'lines=', lines.length);
