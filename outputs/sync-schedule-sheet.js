/* 测试排班表（飞书电子表格）同步
 * 用法：
 *   node outputs/sync-schedule-sheet.js                 # 正式同步（读 sync_config 里的链接）
 *   node outputs/sync-schedule-sheet.js --dry            # 只读不写
 *   node outputs/sync-schedule-sheet.js --url=https://xxx.feishu.cn/sheets/xxxx --dry
 *   node outputs/sync-schedule-sheet.js --month=2026-11
 */
const URL_FN = 'https://icfgireprowcqwdodfqx.supabase.co/functions/v1/feishu-sync';
const TOKEN = 'sync_1786182307_8d204d969f0b99fd';

const args = process.argv.slice(2);
const getArg = (k) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : '';
};
const dry = args.includes('--dry');

(async () => {
  const config = {};
  if (getArg('url')) config.url = getArg('url');
  if (getArg('month')) config.month_key = getArg('month');
  if (getArg('sheet')) config.sheet_name = getArg('sheet');

  const body = { action: 'sync_schedule_sheet', dry_run: dry };
  if (Object.keys(config).length) body.config = config;

  console.log('请求:', JSON.stringify(body));
  const t0 = Date.now();
  const resp = await fetch(URL_FN, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  console.log(`HTTP ${resp.status}  用时 ${Date.now() - t0}ms`);
  let j;
  try { j = JSON.parse(text); } catch (e) { console.log(text.slice(0, 1500)); return; }
  if (!j.ok) {
    console.log('❌ 失败:', j.error);
    return;
  }
  const r = j.results.schedule;
  console.log('✅ 月份:', r.month_key, '| 工作表:', r.sheet_title, '| 解析人数:', r.total_in_feishu);
  console.log('   新增:', r.added, '| 有变化:', r.changed, '| 无变化:', r.unchanged, '| 删除:', r.removed, '| 待删:', r.stale_pending);
  console.log('   所有工作表:', (r.sheet_names || []).join(' / '));
  console.log('   名单:', r.staff.join('、'));
  if (r.changes_preview && r.changes_preview.length) {
    console.log('   变化明细（最多 6 人）:');
    r.changes_preview.forEach((c) => console.log('     ·', c.name, '→', c.diff.join('  ')));
  }
})();
