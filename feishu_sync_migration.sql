-- ============================================
-- 飞书多维表格同步 - 数据库变更
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 添加飞书记录 ID 字段（用于增量同步匹配）
ALTER TABLE pattern_assets
  ADD COLUMN IF NOT EXISTS feishu_record_id TEXT;

-- 2. 添加 name + brand 唯一约束（upsert 依赖此约束）
-- 如果已存在同名同品牌记录，先去重保留最早的一条
DELETE FROM pattern_assets a USING pattern_assets b
  WHERE a.brand = b.brand AND a.name = b.name AND a.id > b.id;

-- 创建唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_pattern_assets_name_brand
  ON pattern_assets (name, brand);

-- 3. 说明：
-- feishu_record_id: 飞书多维表格每条记录的唯一 ID，同步时写入
-- 当飞书中删除某条记录后，同步函数会根据 feishu_record_id 找到对应行并标记为下架
-- name + brand 唯一约束确保 upsert 时能正确匹配同名同品牌的记录
