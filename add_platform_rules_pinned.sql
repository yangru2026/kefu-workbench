-- ============================================================
-- 平台规则支持置顶：platform_rules 加 pinned 字段
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- ============================================================

alter table public.platform_rules
  add column if not exists pinned boolean default false;

-- 验证
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'platform_rules' and column_name = 'pinned';
