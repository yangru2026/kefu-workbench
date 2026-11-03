-- ============================================================
-- 排班表关联飞书电子表格（B+C 方案）
-- 1) 新增 sync_config：存"排班表链接/表名/月份"等配置，管理员可改，前端可读
-- 2) 幂等：可重复执行
-- ============================================================

create table if not exists public.sync_config (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  note       text,
  updated_at timestamptz not null default now()
);

comment on table public.sync_config is '外部数据源同步配置（如飞书排班表链接），管理员维护';

alter table public.sync_config enable row level security;

-- 读：登录用户可读（前端要显示"已关联哪张表"）
drop policy if exists sync_config_select on public.sync_config;
create policy sync_config_select on public.sync_config
  for select to authenticated using (true);

-- 写：仅管理员
drop policy if exists sync_config_admin_write on public.sync_config;
create policy sync_config_admin_write on public.sync_config
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 更新时间戳
create or replace function public.touch_sync_config()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_sync_config on public.sync_config;
create trigger trg_touch_sync_config
  before update on public.sync_config
  for each row execute function public.touch_sync_config();

-- 默认配置行：排班表（spreadsheet_token 留空，等管理员在页面上粘贴链接）
insert into public.sync_config (key, value, note)
values ('schedule_sheet', '{"url":"","sheet_name":"","month_key":"","cleanup":true}'::jsonb, '排班表飞书电子表格')
on conflict (key) do nothing;

select key, value, updated_at from public.sync_config;
