-- ============================================================
-- 客户之声 (Voice of Customer) 表 + 权限策略
-- 用途：客服把客户反馈原话原封不动录入，月底汇总调研客户真实想法
-- 设计原则：原话一字不改，仅在外层加"场景/主题"轻量标签方便汇总
-- ============================================================

-- 管理员/组长判定函数（security definer 绕过 profiles 自身 RLS，避免递归）
-- 用 create or replace 保证幂等，重复执行不会报错
create or replace function public.is_admin_or_leader()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'leader')
  );
$$;

-- 主表
create table if not exists public.customer_voice (
  id           bigint generated always as identity primary key,
  raw_text     text        not null,                       -- 客户原话（原封不动，不加工）
  scene        text,                                        -- 来源场景：微信咨询/售后回访/电话沟通/评价留言/直播间/其他
  topic        text,                                        -- 主题：产品建议/价格反馈/物流吐槽/竞品对比/使用问题/好评夸夸/投诉吐槽/其他
  staff_name   text,                                        -- 收集客服（登录名）
  team         text,                                        -- 组别 A组/B组/C组
  customer_tag text,                                        -- 客户标记（微信昵称/订单号，选填）
  created_at   timestamptz not null default now(),
  record_month text                                         -- 冗余月份 'YYYY-MM'，便于按月份索引筛选
);

create index if not exists customer_voice_created_at_idx   on public.customer_voice (created_at desc);
create index if not exists customer_voice_record_month_idx on public.customer_voice (record_month);

-- 开启行级安全
alter table public.customer_voice enable row level security;

-- 所有登录用户可读（客户之声是团队共享资产）
drop policy if exists "cv_select" on public.customer_voice;
create policy "cv_select" on public.customer_voice
  for select to authenticated using (true);

-- 所有登录用户可录入
drop policy if exists "cv_insert" on public.customer_voice;
create policy "cv_insert" on public.customer_voice
  for insert to authenticated with check (true);

-- 仅管理员/组长可改
drop policy if exists "cv_update" on public.customer_voice;
create policy "cv_update" on public.customer_voice
  for update to authenticated using (is_admin_or_leader()) with check (is_admin_or_leader());

-- 仅管理员/组长可删
drop policy if exists "cv_delete" on public.customer_voice;
create policy "cv_delete" on public.customer_voice
  for delete to authenticated using (is_admin_or_leader());
