-- ============================================
-- 连带成交 · 新增「备注」列
-- ============================================
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
--
-- 用途：客服可在成交明细中填写特殊情况说明（备注）
-- 说明：
--   - notes 为纯文本列，沿用现有 RLS（所有人可查看；本人/管理员可改）
--   - 前端 loadCrossSalesFromDB 使用 select('*')，列一旦存在即自动加载，无需改查询

ALTER TABLE cross_sales ADD COLUMN IF NOT EXISTS notes TEXT;
COMMENT ON COLUMN cross_sales.notes IS '客服填写的特殊情况说明（备注）';
