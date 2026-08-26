-- ============================================================
-- qc_good_cases 优秀案例表
-- 用途：记录客服优秀对话/话术，作为正向教材供全员学习
-- 权限：管理员/组长可录入删除，全员可查看（RLS 全放通，前端控制）
-- 使用：直接在 Supabase SQL Editor 执行
-- ============================================================

create table if not exists public.qc_good_cases (
  id bigint primary key,
  title text not null,
  staff text not null,
  shop text not null,
  date text not null,
  tags text[] not null default '{}',
  scenario text not null default '',
  reply text not null default '',
  highlights text not null default '',
  images text[] not null default '{}',
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.qc_good_cases enable row level security;

drop policy if exists "qc_good_cases_all" on public.qc_good_cases;
create policy "qc_good_cases_all" on public.qc_good_cases
  for all using (true) with check (true);

-- 提示：表就绪后，刷新质检工具页面即可在顶部看到「🌟 优秀案例」入口。
