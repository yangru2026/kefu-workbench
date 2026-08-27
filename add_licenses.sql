-- ============================================================
-- 查验证明：licenses 表 + Storage bucket + RLS + trigger
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- 列名已锁定：platform / shop_name / shop_short / company /
-- factory / license_file / business_file / production_file
-- ============================================================

-- 1) 建表
create table if not exists public.licenses (
  id             uuid primary key default gen_random_uuid(),
  platform       text not null default '',        -- 平台（抖音/快手/拼多多/天猫/京东/小红书/YH）
  shop_name      text not null default '',        -- 店铺全称
  shop_short     text not null default '',        -- 店铺简称
  company        text not null default '',        -- 所属公司
  factory        text not null default '',        -- 合作工厂
  license_file   text not null default '',        -- 医疗器械经营许可证 图片 URL
  business_file  text not null default '',        -- 营业执照 图片 URL
  production_file text not null default '',       -- 生产许可证 图片 URL
  sort_order     int  not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 2) 索引
create index if not exists idx_licenses_shop     on public.licenses (shop_short);
create index if not exists idx_licenses_platform on public.licenses (platform);

-- 3) RLS
alter table public.licenses enable row level security;
drop policy if exists "licenses public read" on public.licenses;
create policy "licenses public read" on public.licenses
  for select using (true);
drop policy if exists "licenses authed write" on public.licenses;
create policy "licenses authed write" on public.licenses
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4) updated_at trigger（复用公共函数）
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_licenses_updated on public.licenses;
create trigger trg_licenses_updated before update on public.licenses
  for each row execute function public.set_updated_at();

-- 5) Storage bucket：licenses（公开读，登录用户可写）
insert into storage.buckets (id, name, public)
values ('licenses', 'licenses', true)
on conflict (id) do nothing;

drop policy if exists "licenses storage public read" on storage.objects;
create policy "licenses storage public read" on storage.objects
  for select using (bucket_id = 'licenses');
drop policy if exists "licenses storage authed write" on storage.objects;
create policy "licenses storage authed write" on storage.objects
  for all using (bucket_id = 'licenses' and auth.role() = 'authenticated')
  with check (bucket_id = 'licenses' and auth.role() = 'authenticated');

-- 完成提示
select 'licenses 表 + bucket 已就绪' as result;
