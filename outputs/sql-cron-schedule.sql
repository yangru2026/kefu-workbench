-- 每 30 分钟自动同步排班表（飞书电子表格 → schedule_data）
select cron.unschedule('sync-schedule-sheet')
where exists (select 1 from cron.job where jobname = 'sync-schedule-sheet');

select cron.schedule(
  'sync-schedule-sheet',
  '*/30 * * * *',
  $job$
  select net.http_post(
    url := 'https://icfgireprowcqwdodfqx.supabase.co/functions/v1/feishu-sync',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sync_1786182307_8d204d969f0b99fd"}'::jsonb,
    body := '{"action":"sync_schedule_sheet"}'::jsonb,
    timeout_milliseconds := 25000
  ) as request_id;
  $job$
);

select jobid, jobname, schedule, active from cron.job where jobname = 'sync-schedule-sheet';
