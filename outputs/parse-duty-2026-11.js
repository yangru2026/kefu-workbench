/* 解析 11 月班表 CSV → schedule_data 行（month_key/staff_name/group_name/schedule）
 * 输出：outputs/data/duty-2026-11.json  +  SQL 语句文件 duty-2026-11.sql
 * 校验：每人必须 30 个班次值；值只能是 早/中/晚/休/调
 */
const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const MONTH = '2026-11';
const DAYS = 30;   // 11 月 30 天
const OK = new Set(['早', '中', '晚', '休', '调']);

const raw = fs.readFileSync(path.join(ROOT, 'outputs/data/duty-2026-11.csv'), 'utf8').replace(/\r/g, '');
const lines = raw.split('\n').filter(l => l.trim());
const rows = [];
let lastGroup = null;
const problems = [];

lines.forEach((line, i) => {
  if (i < 2) return;                                   // 表头两行
  const c = line.split(',').map(s => s.trim());
  let group = null, name = c[0], vals = c.slice(1);

  if (/^售前[A-C]组$/.test(c[0])) { group = c[0].replace('售前', ''); name = c[1]; vals = c.slice(2); }
  else if (/^分流-/.test(c[0])) { group = '分流'; name = c[0].split('-')[1]; vals = c.slice(1); }

  if (/^周末/.test(name)) return;                       // 周末占位行
  if (['早', '中', '晚', '休', '调'].includes(c[0]) && vals.every(v => /^\d+$/.test(v))) return;  // 统计行

  if (group) lastGroup = group; else group = lastGroup;
  if (!group) { problems.push('无组别: ' + line.slice(0, 20)); return; }

  // 尾部长空值补齐（飞书复制偶尔丢列）
  const sched = {};
  for (let d = 1; d <= DAYS; d++) {
    const v = (vals[d - 1] || '').trim();
    if (!v) continue;
    if (!OK.has(v)) { problems.push(name + ' 第' + d + '天取值异常: "' + v + '"'); continue; }
    sched[String(d)] = v;
  }
  const filled = Object.keys(sched).length;
  if (filled < DAYS) problems.push(name + ' 只解析到 ' + filled + '/' + DAYS + ' 天');
  rows.push({ month_key: MONTH, staff_name: name, group_name: group, schedule: sched });
});

// 组别顺序 + 人数汇总
const byGroup = {};
rows.forEach(r => (byGroup[r.group_name] = byGroup[r.group_name] || []).push(r.staff_name));

const esc = s => String(s).replace(/'/g, "''");
const sql = [
  '-- 11 月班表导入（source: 飞书在线表 wiki SwHcw0zKai3o4gk1pzLcu7MAnVb?sheet=F2E4o9）',
  "INSERT INTO schedule_data (month_key, staff_name, group_name, schedule) VALUES",
  rows.map(r => "('" + r.month_key + "', '" + esc(r.staff_name) + "', '" + esc(r.group_name) + "', '" + JSON.stringify(r.schedule) + "'::jsonb)").join(',\n'),
  'ON CONFLICT (month_key, staff_name) DO UPDATE SET group_name = EXCLUDED.group_name, schedule = EXCLUDED.schedule;',
  "SELECT month_key, count(*) AS staff_count, sum(jsonb_object_length(schedule)) AS filled_days FROM schedule_data WHERE month_key = '" + MONTH + "' GROUP BY month_key;"
].join('\n');

fs.writeFileSync(path.join(ROOT, 'outputs/data/duty-2026-11.json'), JSON.stringify(rows, null, 1));
fs.writeFileSync(path.join(ROOT, 'outputs/data/duty-2026-11.sql'), sql);

console.log('人数:', rows.length);
Object.keys(byGroup).forEach(g => console.log(' ', g + ':', byGroup[g].length + '人 —', byGroup[g].join('/')));
console.log('总格数:', rows.reduce((s, r) => s + Object.keys(r.schedule).length, 0), '/', rows.length * DAYS);
if (problems.length) { console.log('⚠️ 问题:'); problems.forEach(p => console.log('  -', p)); }
else console.log('✔ 校验通过（每人 30 天齐全、取值合法）');
