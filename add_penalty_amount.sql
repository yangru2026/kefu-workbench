-- ============================================================
-- 质检记录：新增「扣罚金额」字段
-- 用途：一般提醒不扣钱（默认 0），严重问题 / 严重需整改
--       由管理员在录入/编辑时自定义填写扣罚金额。
-- 执行方式：登录 Supabase 控制台 → SQL Editor → 粘贴执行
-- ============================================================

ALTER TABLE public.qc_records
  ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC DEFAULT 0;

-- 刷新 PostgREST schema 缓存（Supabase 通常会自动刷新，此句为双保险）
NOTIFY pgrst, 'reload schema';
