/* quiz.html：管理员(role=admin)不锁卷——从同域 localStorage 的登录态查 role，解锁全部试卷 */
const fs = require('fs');
const base = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/';
let s = fs.readFileSync(base + 'quiz.html', 'utf8').replace(/\r\n/g, '\n');

function must(oldStr, newStr, tag) {
  if (s.indexOf(oldStr) < 0) { console.error('❌ 未找到锚点[' + tag + ']：' + String(oldStr).slice(0, 80)); process.exit(1); }
  s = s.split(oldStr).join(newStr);
}

/* 1) calcUnlock：admin 全解锁 */
must(
  `function calcUnlock() {
  unlockMax = 0;
  while (unlockMax < PAPERS.length - 1 && doneKeys.has(PAPERS[unlockMax].meta.key)) unlockMax++;`,
  `let isExamAdmin = false;    // 管理员不锁卷（页面加载时自动检测）
function calcUnlock() {
  unlockMax = 0;
  while (unlockMax < PAPERS.length - 1 && doneKeys.has(PAPERS[unlockMax].meta.key)) unlockMax++;
  if (isExamAdmin) unlockMax = PAPERS.length - 1;   // 管理员可看全部试卷`,
  'calc-unlock'
);

/* 2) 页面尾：检测登录态 role */
must(
  `$('btnReset').addEventListener('click', () => location.reload());
renderTabs(); renderMeta(); buildPaper();`,
  `$('btnReset').addEventListener('click', () => location.reload());
renderTabs(); renderMeta(); buildPaper();

/* 管理员不锁卷：主工作台与本页同域，登录态存在 localStorage，读 role=admin 即解锁全部试卷 */
(async function detectExamAdmin() {
  try {
    const raw = localStorage.getItem('sb-icfgireprowcqwdodfqx-auth-token');
    if (!raw) return;
    const ses = JSON.parse(raw);
    const at = ses && ses.access_token;
    const uid = ses && ses.user && ses.user.id;
    if (!at || !uid) return;
    const res = await fetch(SUPA_URL + '/rest/v1/profiles?select=role&id=eq.' + uid, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + at }
    });
    const arr = await res.json();
    if (Array.isArray(arr) && arr[0] && arr[0].role === 'admin') {
      isExamAdmin = true;
      calcUnlock();
      renderTabs();
      console.log('管理员身份：全部试卷已解锁');
    }
  } catch (e) { console.warn('管理员检测跳过', e); }
})();`,
  'detect-admin'
);

fs.writeFileSync(base + 'quiz.html', s, 'utf8');
console.log('✅ quiz.html 管理员免锁改造完成，长度', s.length);
