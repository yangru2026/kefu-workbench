-- ============================================
-- 花色素材库 - 价格档 + 直径分组（花色价格速查页）
-- 在 Supabase SQL Editor 中执行，可重复执行（幂等）
-- ============================================

-- 1. pattern_categories 允许新分类类型：price(价格档) / diam_group(直径分组)
ALTER TABLE pattern_categories DROP CONSTRAINT IF EXISTS pattern_categories_category_type_check;
ALTER TABLE pattern_categories
  ADD CONSTRAINT pattern_categories_category_type_check
  CHECK (category_type IN ('brand','type','diameter','series','color','price','diam_group'));

-- 2. pattern_assets 加两个字段（已存在则跳过）
ALTER TABLE pattern_assets ADD COLUMN IF NOT EXISTS price_tier TEXT DEFAULT '';
ALTER TABLE pattern_assets ADD COLUMN IF NOT EXISTS diam_group TEXT DEFAULT '';

-- 3. 播种初始价格档
-- ★ 修改区：价格档名称/数量在这里改（sort_order 越小排越前）；执行后也可在页面筛选行右键增删改
INSERT INTO pattern_categories (category_type, name, sort_order) VALUES
  ('price', '29.9元/副', 1),
  ('price', '49.9元/副', 2),
  ('price', '59.9元/副', 3),
  ('price', '69元/副', 4)
ON CONFLICT (category_type, name) DO NOTHING;

-- 4. 播种直径分组
INSERT INTO pattern_categories (category_type, name, sort_order) VALUES
  ('diam_group', '小直径', 1),
  ('diam_group', '大直径', 2)
ON CONFLICT (category_type, name) DO NOTHING;

-- 5. 自动预填直径分组（只填空值，不动已有标注）
--    5a. 直径数值 ≥14.5 视为大直径（14.5 / 14.8 / 15.0 / 16.0 等）
UPDATE pattern_assets SET diam_group = '大直径'
WHERE COALESCE(diam_group, '') = ''
  AND COALESCE(diameter, '') <> ''
  AND (diameter ~ '14\.[5-9]' OR diameter ~ '15\.[0-9]' OR diameter ~ '16\.[0-9]');

--    5b. 其余有直径信息但未标注的 → 小直径
UPDATE pattern_assets SET diam_group = '小直径'
WHERE COALESCE(diam_group, '') = ''
  AND COALESCE(diameter, '') <> '';

-- 6. 验证（应看到 4 个价格档、2 个直径分组，及各分组花色数量）
SELECT category_type, name, sort_order FROM pattern_categories
WHERE category_type IN ('price', 'diam_group')
ORDER BY category_type, sort_order;

SELECT diam_group, count(*) AS cnt FROM pattern_assets GROUP BY diam_group ORDER BY diam_group;
SELECT price_tier, count(*) AS cnt FROM pattern_assets WHERE COALESCE(price_tier,'')<>'' GROUP BY price_tier ORDER BY price_tier;
