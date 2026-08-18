-- ============================================
-- 修复「保存失败：Could not find the 'coach_date' column」
-- 在 Supabase SQL Editor 中执行一次
-- ============================================

-- 1. 若列不存在则补建（兼容老表 / 不同步的表）
ALTER TABLE qc_records
  ADD COLUMN IF NOT EXISTS coach_date TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS coach_note TEXT DEFAULT '';

-- 2. 关键：刷新 PostgREST schema 缓存
--    报错的根因是 PostgREST 还记着旧表结构，必须重载才认得新列
SELECT pg_notify('pgrst', 'reload schema');

-- 3. 验证：列出 qc_records 的列，确认 coach_date / coach_note 已存在
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'qc_records'
  AND column_name IN ('coach_date', 'coach_note');
