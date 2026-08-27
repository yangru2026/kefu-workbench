-- ============================================================
-- 培训资料新增「注解/描述」字段
-- 用途：点击资料卡片弹窗显示的详细注解文字
--       管理员在编辑弹窗填写，不依赖飞书文档，可控可搜
-- 执行：Supabase → SQL Editor → 粘贴执行 → 刷新工作台
-- ============================================================

-- 1. 新增 description 列（已存在则跳过，可重复执行）
ALTER TABLE public.training_materials
  ADD COLUMN IF NOT EXISTS description text;

-- 2. 注释（便于后续维护）
COMMENT ON COLUMN public.training_materials.description
  IS '资料注解 / 详细描述，点击卡片弹窗显示（不填则不展示该区块）';

-- 3. RLS 保持不变
--    training_materials 现有策略已覆盖所有列（public read / authenticated write），
--    无需为新列单独授权。如后续调整策略再评估。
