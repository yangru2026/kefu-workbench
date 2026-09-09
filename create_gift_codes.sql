-- ============================================================
-- 赠品编码查询：gift_codes 表 + gift-images 公开 bucket + 预置弥生赠品数据
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- 权限：登录用户（客服）可读，仅 role='admin' 可写（leader 暂不开放）
-- ============================================================

-- 1) 建表
create table if not exists public.gift_codes (
  id uuid primary key default gen_random_uuid(),
  name text not null,                -- 简称（如：透明伴侣盒）
  merchant_code text,                -- 商家编码（如：弥生伴侣盒A）
  cost text,                         -- 成本（文本，支持 "2.5/片" 这类写法）
  image_path text,                   -- gift-images bucket 内路径（兼容旧数据，取 image_paths[0]）
  image_paths text[],                -- 多图：gift-images bucket 内路径数组
  sort_order int default 0,          -- 排序（小的在前）
  created_at timestamptz default now()
);

alter table public.gift_codes enable row level security;

-- 2) 权限：登录用户可读
drop policy if exists "gift_codes authed read" on public.gift_codes;
create policy "gift_codes authed read" on public.gift_codes
  for select to authenticated
  using (true);

-- 3) 权限：仅 admin 可写（增删改）
drop policy if exists "gift_codes admin write" on public.gift_codes;
create policy "gift_codes admin write" on public.gift_codes
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 4) 创建公开 bucket（图片需要客服无门槛查看）
insert into storage.buckets (id, name, public)
values ('gift-images', 'gift-images', true)
on conflict (id) do update set public = true;

-- 5) 存储策略：公开读
drop policy if exists "gift images public read" on storage.objects;
create policy "gift images public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'gift-images');

-- 6) 存储策略：仅 admin 可上传/更新/删除
drop policy if exists "gift images admin insert" on storage.objects;
create policy "gift images admin insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'gift-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "gift images admin update" on storage.objects;
create policy "gift images admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'gift-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
)
with check (
  bucket_id = 'gift-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "gift images admin delete" on storage.objects;
create policy "gift images admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'gift-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 7) 预置数据：弥生赠品（仅表为空时插入，可重复执行不重复插）
insert into public.gift_codes (name, merchant_code, cost, sort_order)
select * from (values
  ('蒸汽眼罩', '蒸汽眼罩随机单片', '2.5/片', 1),
  ('透明伴侣盒', '弥生伴侣盒A', '1.5', 2),
  ('粉色伴侣盒', '弥生伴侣盒B', '2', 3),
  ('六联盒', '六副装隐形眼镜盒', '4', 4),
  ('润眼液', '弥生隐形眼镜润眼液10ml', '4', 5),
  ('护理液', '弥生护理液60ML装', '3', 6),
  ('贴纸(小)', '弥生美少女贴纸（小）', '0.5', 7),
  ('贴纸(大)', '弥生美少女贴纸（大）', '0.5', 8),
  ('毛绒包', '可爱毛绒女包', '7.5', 9),
  ('眉笔', '眉笔', '1.5', 10)
) as t(name, merchant_code, cost, sort_order)
where not exists (select 1 from public.gift_codes);

-- 8) 验证
select count(*) as 赠品条数 from public.gift_codes;
select id, name, public from storage.buckets where id = 'gift-images';
