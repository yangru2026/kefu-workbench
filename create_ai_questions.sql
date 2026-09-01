-- ============================================================
-- AI 提问功能：建表 + 权限（RLS）
-- 用法：整段复制到 Supabase 控制台 -> SQL Editor -> Run
-- 可重复执行（已用 if not exists / drop policy if exists）
-- ============================================================

-- 1. 建表：每一次提问和回答都会留一条记录
create table if not exists public.ai_questions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  user_name        text,
  group_name       text,
  question         text not null,
  answer           text,
  status           text not null default 'pending',   -- pending / success / failed
  error            text,
  model            text,
  total_tokens     int,
  latency_ms       int,
  created_at       timestamptz not null default now(),
  answered_at      timestamptz
);

-- 2. 索引：历史列表按时间倒序，管理员查全部也走时间
create index if not exists idx_aiq_user_time on public.ai_questions (user_id, created_at desc);
create index if not exists idx_aiq_time       on public.ai_questions (created_at desc);

-- 3. 开启行级安全（RLS）
--    权限在数据库层兜底：就算有人改前端代码、直接打接口，也只能拿到自己的数据
alter table public.ai_questions enable row level security;

-- 4. 策略

-- 4.1 提交：只能以本人身份提交，伪造不了
drop policy if exists "aiq_insert_own" on public.ai_questions;
create policy "aiq_insert_own" on public.ai_questions
  for insert to authenticated
  with check (auth.uid() = user_id);

-- 4.2 查看：客服只能看自己的；管理员 / 组长可以看全部
drop policy if exists "aiq_select_own_or_admin" on public.ai_questions;
create policy "aiq_select_own_or_admin" on public.ai_questions
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'leader')
    )
  );

-- 4.3 修改：仅管理员（预留，用于标记 / 备注）
drop policy if exists "aiq_update_admin" on public.ai_questions;
create policy "aiq_update_admin" on public.ai_questions
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'leader')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'leader')
    )
  );

-- 4.4 删除：仅管理员
drop policy if exists "aiq_delete_admin" on public.ai_questions;
create policy "aiq_delete_admin" on public.ai_questions
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'leader')
    )
  );
