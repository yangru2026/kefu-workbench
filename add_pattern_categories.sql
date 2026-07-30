-- ============================================
-- 花色素材库 - 分类管理表
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 建表
CREATE TABLE IF NOT EXISTS pattern_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type TEXT NOT NULL CHECK (category_type IN ('brand', 'type', 'series', 'color')),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_type, name)
);

-- 2. 开启 RLS
ALTER TABLE pattern_categories ENABLE ROW LEVEL SECURITY;

-- 3. RLS 策略：匿名用户可读
CREATE POLICY "Allow public read on pattern_categories" 
ON pattern_categories FOR SELECT 
TO anon, authenticated 
USING (true);

-- 4. RLS 策略：已登录管理员可写
CREATE POLICY "Allow authenticated write on pattern_categories" 
ON pattern_categories FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. 播种初始数据（从现有花色中提取）
-- 品牌
INSERT INTO pattern_categories (category_type, name, sort_order) VALUES
('brand', '弥生', 1),
('brand', '极氧', 2)
ON CONFLICT (category_type, name) DO NOTHING;

-- 抛型
INSERT INTO pattern_categories (category_type, name, sort_order) VALUES
('type', '日抛', 1),
('type', '月抛', 2),
('type', '季抛', 3),
('type', '半年抛', 4),
('type', '年抛', 5)
ON CONFLICT (category_type, name) DO NOTHING;

-- 色系
INSERT INTO pattern_categories (category_type, name, sort_order) VALUES
('color', '棕色系', 1),
('color', '黑灰色系', 2),
('color', '蓝色系', 3),
('color', '绿色系', 4),
('color', '粉色系', 5),
('color', '紫色系', 6),
('color', '灰色系', 7),
('color', '混血色', 8)
ON CONFLICT (category_type, name) DO NOTHING;

-- 系列（从 pattern_assets 中提取已有系列）
INSERT INTO pattern_categories (category_type, name, sort_order)
SELECT 'series', series, row_number() OVER (ORDER BY series)
FROM (
  SELECT DISTINCT series FROM pattern_assets WHERE series IS NOT NULL AND series != ''
) t
ON CONFLICT (category_type, name) DO NOTHING;
