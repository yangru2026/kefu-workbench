-- ============================================
-- 花色素材库 - 新增「直径」分类维度
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 修改 CHECK 约束，允许 'diameter' 类型
-- 先删除旧约束（如果存在），再添加新约束
ALTER TABLE pattern_categories
  DROP CONSTRAINT IF EXISTS pattern_categories_category_type_check;

ALTER TABLE pattern_categories
  ADD CONSTRAINT pattern_categories_category_type_check
  CHECK (category_type IN ('brand', 'type', 'diameter', 'series', 'color'));

-- 2. 从 pattern_assets 中提取已有直径值，自动创建直径分类
INSERT INTO pattern_categories (category_type, name, sort_order)
SELECT 'diameter', diameter, row_number() OVER (ORDER BY diameter)
FROM (
  SELECT DISTINCT diameter FROM pattern_assets
  WHERE diameter IS NOT NULL AND diameter != ''
) t
ON CONFLICT (category_type, name) DO NOTHING;

-- 3. 验证结果
SELECT category_type, name, sort_order
FROM pattern_categories
WHERE category_type = 'diameter'
ORDER BY sort_order;
