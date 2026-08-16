-- 为 pattern_assets 增加手动排序权重字段
-- 数值越大越靠前，0 为默认排序
ALTER TABLE pattern_assets
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- 可选：给已有数据建索引，加速按排序字段查询
CREATE INDEX IF NOT EXISTS idx_pattern_assets_sort_order
ON pattern_assets(sort_order DESC);
