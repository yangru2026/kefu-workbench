-- ============================================================
-- 查验证明权限收紧：仅 role='admin' 可写 licenses / production_factories / licenses 存储桶
-- 其他人（含 leader/客服）只读 + 可复制图片
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- 前提：public.profiles 表有 role 字段，且管理员角色值为 'admin'
-- ============================================================

-- 1) licenses 表：删除旧的可登录用户写权限，改为仅 admin
alter table public.licenses enable row level security;

drop policy if exists "licenses authed write" on public.licenses;
create policy "licenses admin write" on public.licenses
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

-- 2) production_factories 表：同样仅 admin 可写
alter table public.production_factories enable row level security;

drop policy if exists "production_factories authed write" on public.production_factories;
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

-- 3) Storage licenses 桶：写权限也限制为 admin（读仍公开）
drop policy if exists "licenses storage authed write" on storage.objects;
create policy "licenses storage admin write" on storage.objects
  for all
  using (
    bucket_id = 'licenses'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    bucket_id = 'licenses'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 完成提示
select '查验证明写权限已收紧为仅 admin' as result;
