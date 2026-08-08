-- ============================================
-- 花色素材库 - 直径值去重归一化
-- 在 Supabase SQL Editor 中执行
-- ============================================
-- 功能：清理 diameter 字段中的 mm 后缀、空格等
-- 把 "14.5mm" / "14.5 mm" / " 14.5 " 统一为 "14.5"
-- 并清理 pattern_categories 中的重复直径分类
-- ============================================

-- 1. 归一化所有非空 diameter 值
UPDATE pattern_assets
SET diameter = TRIM(REPLACE(REPLACE(REPLACE(diameter, 'mm', ''), 'MM', ''), ' ', ''))
WHERE diameter IS NOT NULL AND diameter != '';

-- 2. 清理 pattern_categories 中重复/过期的直径分类
-- 先删除所有直径分类（会根据实际数据重新生成）
DELETE FROM pattern_categories WHERE category_type = 'diameter';

-- 3. 根据归一化后的数据重新生成分类，按数值排序
INSERT INTO pattern_categories (category_type, name, sort_order)
SELECT 'diameter', diameter, row_number() OVER (ORDER BY 
  CASE 
    WHEN diameter ~ '^[0-9]+(\.[0-9]+)?$' THEN CAST(diameter AS numeric)
    ELSE 999
  END
) as sort_order
FROM (
  SELECT DISTINCT diameter 
  FROM pattern_assets 
  WHERE diameter IS NOT NULL AND diameter != ''
) t
ON CONFLICT (category_type, name) DO NOTHING;

-- 4. 验证结果
SELECT '归一化后的直径分布' as info;
SELECT diameter, COUNT(*) as count 
FROM pattern_assets 
WHERE diameter IS NOT NULL AND diameter != ''
GROUP BY diameter 
ORDER BY 
  CASE 
    WHEN diameter ~ '^[0-9]+(\.[0-9]+)?$' THEN CAST(diameter AS numeric)
    ELSE 999
  END;

SELECT '直径分类列表' as info;
SELECT name, sort_order 
FROM pattern_categories 
WHERE category_type = 'diameter' 
ORDER BY sort_order;
