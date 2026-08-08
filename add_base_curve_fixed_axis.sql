-- 花色素材表新增「基弧」和「定轴」字段
-- 基弧：文本类型，如 "8.6", "8.7", "8.8"
-- 定轴：文本类型，有值表示该花色为定轴款（如 "90°", "180°" 或 "是"），空值表示非定轴

ALTER TABLE pattern_assets
ADD COLUMN IF NOT EXISTS base_curve text,
ADD COLUMN IF NOT EXISTS fixed_axis text;

-- 确认字段已添加
COMMENT ON COLUMN pattern_assets.base_curve IS '基弧值，如 8.6, 8.7, 8.8';
COMMENT ON COLUMN pattern_assets.fixed_axis IS '定轴信息，有值表示定轴款，空值表示非定轴';
