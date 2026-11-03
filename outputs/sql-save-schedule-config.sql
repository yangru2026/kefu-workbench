update public.sync_config
set value = jsonb_build_object(
  'url', 'https://yow5cuygtx.feishu.cn/wiki/SwHcw0zKai3o4gk1pzLcu7MAnVb?sheet=F2E4o9',
  'sheet_name', '',
  'month_key', '',
  'cleanup', true
)
where key = 'schedule_sheet'
returning key, value;
