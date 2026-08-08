-- 花色素材多图支持：新增 lens_imgs 和 eye_imgs 数组字段
-- lens_imgs: 存储所有花色图(镜片图) URL 数组
-- eye_imgs: 存储所有上眼图 URL 数组
-- 兼容：原有的 lens_img / eye_img (text) 保留，存第一张图

ALTER TABLE pattern_assets
ADD COLUMN IF NOT EXISTS lens_imgs text[],
ADD COLUMN IF NOT EXISTS eye_imgs text[];

-- 把已有的单图数据迁移到数组字段（仅当数组为空时）
UPDATE pattern_assets
SET lens_imgs = ARRAY[lens_img]
WHERE lens_img IS NOT NULL AND lens_img != '' AND (lens_imgs IS NULL OR array_length(lens_imgs, 1) IS NULL);

UPDATE pattern_assets
SET eye_imgs = ARRAY[eye_img]
WHERE eye_img IS NOT NULL AND eye_img != '' AND (eye_imgs IS NULL OR array_length(eye_imgs, 1) IS NULL);
