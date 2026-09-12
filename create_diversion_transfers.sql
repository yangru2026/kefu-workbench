-- ============================================================
-- 舆情转接登记：diversion_transfers 表 + diversion-images 公开 bucket
-- 背景：规范分流号使用，仅「舆情问透氧 / 跨店问正品」两种场景可转分流号，
--       转接必须登记（客服/客户昵称或订单号/原因/聊天截图）用于监管。
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- 权限：登录用户可读可登记；删除仅限 role='admin'。
-- ============================================================

-- 1) 建表
create table if not exists public.diversion_transfers (
  id uuid primary key default gen_random_uuid(),
  cs_name text not null,             -- 客服名字
  customer_info text,                -- 客户昵称 / 订单号
  reason text not null,              -- 转接原因：舆情问透氧 / 跨店问正品
  screenshots text[],                -- 聊天截图（diversion-images bucket 路径数组）
  created_at timestamptz default now()  -- 登记时间
);

alter table public.diversion_transfers enable row level security;

-- 2) 权限：登录用户可读（全员透明，互相监督）
drop policy if exists "diversion authed read" on public.diversion_transfers;
create policy "diversion authed read" on public.diversion_transfers
  for select to authenticated
  using (true);

-- 3) 权限：登录用户可登记（只能插，不能改别人的）
drop policy if exists "diversion authed insert" on public.diversion_transfers;
create policy "diversion authed insert" on public.diversion_transfers
  for insert to authenticated
  with check (true);

-- 4) 权限：仅 admin 可删除（虚假/重复登记找管理员处理）
drop policy if exists "diversion admin delete" on public.diversion_transfers;
create policy "diversion admin delete" on public.diversion_transfers
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 5) 创建公开 bucket（截图需要免登录直链查看）
insert into storage.buckets (id, name, public)
values ('diversion-images', 'diversion-images', true)
on conflict (id) do update set public = true;

-- 6) 存储策略：公开读
drop policy if exists "diversion images public read" on storage.objects;
create policy "diversion images public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'diversion-images');

-- 7) 存储策略：登录用户可上传（客服自己传截图证明）
drop policy if exists "diversion images authed insert" on storage.objects;
create policy "diversion images authed insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'diversion-images');

-- 8) 存储策略：仅 admin 可删除截图
drop policy if exists "diversion images admin delete" on storage.objects;
create policy "diversion images admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'diversion-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 9) 验证
select count(*) as 舆情转接登记条数 from public.diversion_transfers;
select id, name, public from storage.buckets where id = 'diversion-images';
