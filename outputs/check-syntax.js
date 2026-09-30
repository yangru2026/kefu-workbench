/* 校验单文件页面里 inline <script> 的语法（跳过带 src 的外链脚本）
 * 用法：node outputs/check-syntax.js quiz.html quiz-results.html index.html
 */
const fs = require('fs');
const files = process.argv.slice(2);
if (!files.length) { console.log('用法：node outputs/check-syntax.js <文件...>'); process.exit(2); }
let bad = 0;
files.forEach(f => {
  const s = fs.readFileSync(f, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, i = 0, ok = true;
  while ((m = re.exec(s))) {
    i++;
    try { new Function(m[1]); }
    catch (e) { ok = false; bad++; console.log('✘ ' + f + ' 第 ' + i + ' 段语法错误: ' + e.message); }
  }
  if (ok) console.log('✔ ' + f + ' 语法通过（' + i + ' 段 inline script）');
});
process.exit(bad ? 1 : 0);
