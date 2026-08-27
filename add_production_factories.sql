-- ============================================================
-- 生产方许可证：4 个合作工厂（非按店铺）
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- ============================================================

-- 1) 建表
create table if not exists public.production_factories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                    -- 工厂名称
  license_file  text not null default '',         -- 生产许可证图片 URL
  sort_order    int  not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2) 索引
create index if not exists idx_production_factories_name on public.production_factories (name);

-- 3) RLS：所有人可读，仅 role='admin' 可写
alter table public.production_factories enable row level security;
drop policy if exists "production_factories public read" on public.production_factories;
create policy "production_factories public read" on public.production_factories
  for select using (true);
drop policy if exists "production_factories authed write" on public.production_factories;
drop policy if exists "production_factories admin write" on public.production_factories;
create policy "production_factories admin write" on public.production_factories
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 4) updated_at trigger（复用公共函数）
drop trigger if exists trg_production_factories_updated on public.production_factories;
create trigger trg_production_factories_updated before update on public.production_factories
  for each row execute function public.set_updated_at();

-- 5) 插入 4 条生产方数据（图片已上传 licenses 桶）
insert into public.production_factories (name, license_file, sort_order) values
('吉林瑞尔康', 'https://ienmejlxukhrxjjxvfqf.supabase.co/storage/v1/object/public/licenses/jilin-ruierkang/production.webp', 1),
('西安科诗美', 'https://ienmejlxukhrxjjxvfqf.supabase.co/storage/v1/object/public/licenses/xian-keshimei/production.webp', 2),
('陕西福蔻',   'https://ienmejlxukhrxjjxvfqf.supabase.co/storage/v1/object/public/licenses/shaanxi-fukou/production.webp', 3),
('江苏天眼',   'https://ienmejlxukhrxjjxvfqf.supabase.co/storage/v1/object/public/licenses/jiangsu-tianyan/production.webp', 4)
on conflict (id) do nothing;

-- 完成提示
select '生产方许可证 4 条数据已上架' as result;
