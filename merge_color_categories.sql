-- ============================================
-- 花色素材库 - 色系分类合并整理
-- 在 Supabase SQL Editor 中执行
-- ============================================
-- 功能：将所有非标准色系值归一到标准分类
-- 如"青灰"→"灰色系"，"棕粉"→"粉色系"等
-- 执行后色系分类将精简为：棕色系/黑灰色系/蓝色系/绿色系/粉色系/紫色系/灰色系/混血色/粉紫色系
-- ============================================

-- 1. 归一化所有非标准色系值
-- 标准色系：棕色系、黑灰色系、蓝色系、绿色系、粉色系、紫色系、灰色系、混血色、粉紫色系
UPDATE pattern_assets SET color = 
  CASE
    -- ========== 混合色 / 描述性文字 → 混血色 ==========
    WHEN color LIKE '%拼色%' THEN '混血色'
    WHEN color LIKE '%同款%' AND color NOT LIKE '%蓝%' AND color NOT LIKE '%黑%' THEN '混血色'
    
    -- ========== 双色组合（按主导色归类）==========
    -- 黑+灰 → 黑灰色系
    WHEN color LIKE '%黑%' AND color LIKE '%灰%' THEN '黑灰色系'
    -- 黑+紫 → 紫色系
    WHEN color LIKE '%黑%' AND color LIKE '%紫%' THEN '紫色系'
    -- 黑+粉 → 粉色系
    WHEN color LIKE '%黑%' AND color LIKE '%粉%' THEN '粉色系'
    -- 黑+蓝 → 蓝色系
    WHEN color LIKE '%黑%' AND color LIKE '%蓝%' THEN '蓝色系'
    -- 黑+棕/黑棕 → 棕色系
    WHEN color LIKE '%黑%' AND color LIKE '%棕%' THEN '棕色系'
    -- 黑+金 → 黑灰色系
    WHEN color LIKE '%黑%' AND (color LIKE '%金%' OR color LIKE '%亮点%') THEN '黑灰色系'
    
    -- 灰+蓝/灰蓝 → 灰色系
    WHEN color LIKE '%灰%' AND color LIKE '%蓝%' THEN '灰色系'
    -- 灰+绿/灰绿 → 绿色系
    WHEN color LIKE '%灰%' AND color LIKE '%绿%' THEN '绿色系'
    -- 灰+咖 → 灰色系
    WHEN color LIKE '%灰%' AND color LIKE '%咖%' THEN '灰色系'
    -- 灰+黑/灰黑 → 黑灰色系
    WHEN color LIKE '%灰%' AND color LIKE '%黑%' THEN '黑灰色系'
    
    -- 蓝+紫/蓝紫 → 紫色系
    WHEN color LIKE '%蓝%' AND color LIKE '%紫%' THEN '紫色系'
    -- 蓝+绿/蓝绿 → 绿色系
    WHEN color LIKE '%蓝%' AND color LIKE '%绿%' THEN '绿色系'
    -- 蓝+棕/蓝棕拼色 → 混血色
    WHEN color LIKE '%蓝%' AND color LIKE '%棕%' THEN '混血色'
    
    -- 粉+棕/棕粉/粉棕 → 粉色系
    WHEN color LIKE '%粉%' AND color LIKE '%棕%' THEN '粉色系'
    
    -- 红+黑/红黑 → 混血色
    WHEN color LIKE '%红%' AND color LIKE '%黑%' THEN '混血色'
    -- 红+棕/红棕 → 棕色系
    WHEN color LIKE '%红%' AND color LIKE '%棕%' THEN '棕色系'
    
    -- ========== 单色关键词归类 ==========
    WHEN color LIKE '%棕%' THEN '棕色系'
    WHEN color LIKE '%琥珀%' THEN '棕色系'
    WHEN color LIKE '%奶%' AND color LIKE '%棕%' THEN '棕色系'
    WHEN color LIKE '%焦糖%' THEN '棕色系'
    WHEN color LIKE '%茶%' AND (color LIKE '%黑%' OR color LIKE '%棕%') THEN '棕色系'
    
    WHEN color LIKE '%黑%' THEN '黑灰色系'
    WHEN color LIKE '%灰%' THEN '灰色系'
    WHEN color LIKE '%青灰%' THEN '灰色系'
    WHEN color LIKE '%灰咖%' THEN '灰色系'
    
    WHEN color LIKE '%蓝%' THEN '蓝色系'
    WHEN color LIKE '%绿%' THEN '绿色系'
    WHEN color LIKE '%青绿%' THEN '绿色系'
    WHEN color LIKE '%墨绿%' THEN '绿色系'
    
    WHEN color LIKE '%粉%' THEN '粉色系'
    WHEN color LIKE '%樱%' THEN '粉色系'
    WHEN color LIKE '%紫%' THEN '紫色系'
    
    WHEN color LIKE '%红%' THEN '棕色系'
    
    -- ========== 空值 → 棕色系（默认）==========
    WHEN color IS NULL OR color = '' THEN '棕色系'
    
    -- ========== 已是标准值，保持不变 ==========
    ELSE color
  END
WHERE color IS NULL 
   OR color = '' 
   OR NOT (color IN ('棕色系','黑灰色系','蓝色系','绿色系','粉色系','紫色系','灰色系','混血色','粉紫色系'));

-- 2. 合并「黑色系」→「黑灰色系」
-- （极氧部分花色使用了"黑色系"，统一为"黑灰色系"减少分类数量）
UPDATE pattern_assets SET color = '黑灰色系' WHERE color = '黑色系';

-- 3. 清理 pattern_categories 表中的非标准色系分类
-- 删除所有不在标准列表中的色系分类记录
DELETE FROM pattern_categories 
WHERE category_type = 'color' 
  AND name NOT IN ('棕色系','黑灰色系','蓝色系','绿色系','粉色系','紫色系','灰色系','混血色','粉紫色系');

-- 4. 确保「粉紫色系」分类存在（极氧使用）
INSERT INTO pattern_categories (category_type, name, sort_order) 
VALUES ('color', '粉紫色系', 9)
ON CONFLICT (category_type, name) DO NOTHING;

-- 5. 重新排序色系分类
UPDATE pattern_categories SET sort_order = sub.new_order
FROM (
  SELECT id, row_number() OVER (ORDER BY 
    CASE name 
      WHEN '棕色系' THEN 1 
      WHEN '黑灰色系' THEN 2 
      WHEN '灰色系' THEN 3 
      WHEN '蓝色系' THEN 4 
      WHEN '绿色系' THEN 5 
      WHEN '粉色系' THEN 6 
      WHEN '紫色系' THEN 7 
      WHEN '粉紫色系' THEN 8 
      WHEN '混血色' THEN 9 
      ELSE 99 
    END
  ) as new_order
  FROM pattern_categories 
  WHERE category_type = 'color'
) sub
WHERE pattern_categories.id = sub.id AND pattern_categories.category_type = 'color';

-- 6. 验证结果
SELECT '归一化后的色系分布' as info;
SELECT color, COUNT(*) as count 
FROM pattern_assets 
GROUP BY color 
ORDER BY count DESC;

SELECT '色系分类列表' as info;
SELECT name, sort_order 
FROM pattern_categories 
WHERE category_type = 'color' 
ORDER BY sort_order;
