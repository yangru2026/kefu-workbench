-- ============================================================
-- 售前固定工作清单打卡：建表 + 权限（RLS）
-- 仅 admin（茹姐一人）可见可写，权限在数据库层兜底
-- 可重复执行（if not exists / drop policy if exists）
-- ============================================================

-- 1. 打卡记录表：每条 = 某人在某周期完成了某项
--    period_key 约定：
--      每日项 'D2026-09-22'（当天）
--      每周项 'W2026-09-22'（该周周一的日期）
--      每月项 'M2026-09'（当月）
create table if not exists public.checkin_records (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_key   text not null,
  period_key text not null,
  done_at    timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, item_key, period_key)
);

-- 2. 索引
create index if not exists idx_chk_user_period on public.checkin_records (user_id, period_key);
create index if not exists idx_chk_period on public.checkin_records (period_key);

-- 3. 开启行级安全
alter table public.checkin_records enable row level security;

-- 4. 策略：仅 role = 'admin' 的登录用户可读 / 写 / 删（其他任何人查不到也写不进）
drop policy if exists "chk_select_admin" on public.checkin_records;
create policy "chk_select_admin" on public.checkin_records
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "chk_insert_admin" on public.checkin_records;
create policy "chk_insert_admin" on public.checkin_records
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "chk_delete_admin" on public.checkin_records;
create policy "chk_delete_admin" on public.checkin_records
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
