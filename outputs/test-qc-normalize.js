/* 验证「质检报告页口径归一化」：新表列（qc_date/staff_name/qc_name/amount/staff_confirmed_at）
 * 能被正确映射成本页下游渲染用的老字段名（date/staff/created_by/penalty_amount/status）。
 * 用法：node outputs/test-qc-normalize.js
 */
const fs = require('fs');
const src = fs.readFileSync('C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/index.html', 'utf8');

const m = src.match(/function qcNormalizeRow\(r\) \{[\s\S]*?\n\}/);
if (!m) { console.log('❌ 没找到 qcNormalizeRow'); process.exit(1); }
eval(m[0]);

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ ' + name + (extra ? '  → ' + extra : '')); }
};

console.log('用例 1：飞书同步进来的新口径行');
const a = qcNormalizeRow({
  id: 'recuabc123', qc_date: '2026-11-01', staff_name: '小柚', qc_name: '小念',
  issue_type: '回复超时', severity: '严重问题', amount: 50, detail: '…', guidance: '先安抚再给方案',
  evidence: '附件×2', staff_confirmed_at: null,
});
t('date ← qc_date', a.date === '2026-11-01', a.date);
t('staff ← staff_name', a.staff === '小柚', a.staff);
t('created_by ← qc_name', a.created_by === '小念', a.created_by);
t('penalty_amount ← amount', a.penalty_amount === 50, a.penalty_amount);
t('未确认 → status=pending', a.status === 'pending', a.status);
t('原字段保留（guidance/evidence）', a.guidance === '先安抚再给方案' && a.evidence === '附件×2');

console.log('用例 2：已确认 + 金额为 0（组长只报问题没填钱）');
const b = qcNormalizeRow({ id: 'rec2', qc_date: '2026-11-01', staff_name: '小弥', qc_name: '小暖', amount: 0, staff_confirmed_at: '2026-11-01T10:00:00Z' });
t('已确认 → status=done', b.status === 'done', b.status);
t('金额 0 不被写成 NaN', b.penalty_amount === 0, b.penalty_amount);

console.log('用例 3：amount 是字符串 / null 时不炸');
const c = qcNormalizeRow({ id: 'rec3', amount: '30', staff_confirmed_at: null });
t("amount='30' → 30", c.penalty_amount === 30, c.penalty_amount);
const d = qcNormalizeRow({ id: 'rec4', amount: null });
t('amount=null → 0', d.penalty_amount === 0, d.penalty_amount);

console.log('用例 4：空行兜底');
const e = qcNormalizeRow({ id: 'rec5' });
t('date/staff/created_by 为空串而不是 undefined', e.date === '' && e.staff === '' && e.created_by === '');

console.log('用例 5：老口径行（万一表又变回去）也能读');
const f = qcNormalizeRow({ id: 123, date: '2026-10-01', staff: '小柚', created_by: '13800000000', penalty_amount: 20, status: 'done' });
t('老行 date 保留', f.date === '2026-10-01', f.date);
t('老行 status 保留', f.status === 'done', f.status);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
