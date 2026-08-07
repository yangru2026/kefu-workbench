-- 为 pattern_assets 表增加「是否下架花色」字段
-- 在 Supabase Dashboard → SQL Editor 中执行以下语句

ALTER TABLE pattern_assets
  ADD COLUMN IF NOT EXISTS is_discontinued boolean NOT NULL DEFAULT false;

-- 为已下架花色创建索引（可选，便于筛选）
CREATE INDEX IF NOT EXISTS idx_pattern_assets_discontinued
  ON pattern_assets (is_discontinued);

-- 说明：
-- is_discontinued = true  表示该花色已下架
-- 工作台会自动在「花色素材」品牌栏生成「📦 下架花色」分类，
-- 点击即可查看全部已下架花色；管理员可在花色卡片上点 📦 标记下架 / ↩️ 取消下架。
