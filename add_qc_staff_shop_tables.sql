-- ============================================
-- 客服姓名 / 所属店铺 动态管理表
-- 在 Supabase SQL Editor 中执行
-- 作用：管理员可增删客服和店铺，质检录入/筛选/编辑统一从表中读取。
-- ============================================

-- 1. 客服表
CREATE TABLE IF NOT EXISTS qc_staffs (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,      -- 客服姓名
  sort_order INT DEFAULT 0,        -- 排序（越小越前）
  is_active BOOLEAN DEFAULT true,  -- 是否启用（可软删/停用）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 店铺表
CREATE TABLE IF NOT EXISTS qc_shops (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_qc_staffs_sort ON qc_staffs(sort_order, name);
CREATE INDEX IF NOT EXISTS idx_qc_shops_sort   ON qc_shops(sort_order, name);

-- 4. RLS
ALTER TABLE qc_staffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_shops   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on qc_staffs"
ON qc_staffs FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow authenticated write on qc_staffs"
ON qc_staffs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public read on qc_shops"
ON qc_shops FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow authenticated write on qc_shops"
ON qc_shops FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. 初始化店铺（与旧硬编码列表一致，升级无缝）
INSERT INTO qc_shops (name, sort_order) VALUES
  ('抖音1店', 1), ('抖音2店', 2), ('抖音3店', 3),
  ('快手MS', 4),
  ('拼多多1店', 5), ('拼多多2店', 6), ('拼多多3店', 7), ('拼多多4店', 8), ('拼多多5店', 9),
  ('天猫MS', 10), ('天猫极氧', 11)
ON CONFLICT (name) DO NOTHING;

-- 客服表默认不预置，由管理员在页面上添加。
