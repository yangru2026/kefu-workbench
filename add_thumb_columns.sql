-- ============================================
-- 花色素材缩略图字段迁移 + 批量回填
-- ============================================
-- 目的: 为 pattern_assets 表增加「缩略图 URL」字段
--       卡片列表默认显示缩略图（~33KB），点击/hover 才加载原图（~200KB）
--       首屏 25 张图从 ~5MB 降到 ~830KB，加载速度提升 6 倍
--
-- 前提: 已运行 generate_thumbnails.py 生成 images/patterns/thumb/ 目录
--       已 git push 把缩略图推送到 GitHub Pages
--
-- 使用方法: 在 Supabase Dashboard → SQL Editor 中执行以下所有语句

-- ============== 1. 添加缩略图字段 ==============
ALTER TABLE pattern_assets
  ADD COLUMN IF NOT EXISTS thumb_eye_url TEXT,
  ADD COLUMN IF NOT EXISTS thumb_lens_url TEXT;

COMMENT ON COLUMN pattern_assets.thumb_eye_url IS '上眼图缩略图 URL（480px WebP）';
COMMENT ON COLUMN pattern_assets.thumb_lens_url IS '镜片图缩略图 URL（480px WebP）';

-- ============== 2. 批量回填缩略图 URL ==============
-- 规则: 缩略图路径 = 把原图路径中的 'images/patterns/' 替换为 'images/patterns/thumb/'，扩展名改为 .webp
-- 一次性完成（用 REGEXP_REPLACE 一步到位，兼容 .jpg/.jpeg/.png 等任意扩展名）
UPDATE pattern_assets
SET
  thumb_eye_url = CASE
    WHEN eye_img IS NOT NULL AND eye_img != ''
    THEN REGEXP_REPLACE(
      REGEXP_REPLACE(eye_img, '^images/patterns/', 'images/patterns/thumb/'),
      '\.(jpg|jpeg|png|JPG|JPEG|PNG)$', '.webp'
    )
    ELSE NULL
  END,
  thumb_lens_url = CASE
    WHEN lens_img IS NOT NULL AND lens_img != ''
    THEN REGEXP_REPLACE(
      REGEXP_REPLACE(lens_img, '^images/patterns/', 'images/patterns/thumb/'),
      '\.(jpg|jpeg|png|JPG|JPEG|PNG)$', '.webp'
    )
    ELSE NULL
  END;

-- ============== 3. 验证回填结果 ==============
-- 统计
SELECT
  COUNT(*) AS total_records,
  COUNT(thumb_eye_url) AS with_eye_thumb,
  COUNT(thumb_lens_url) AS with_lens_thumb
FROM pattern_assets;

-- 抽样前 5 条
SELECT name, brand, eye_img, thumb_eye_url, lens_img, thumb_lens_url
FROM pattern_assets
WHERE thumb_eye_url IS NOT NULL OR thumb_lens_url IS NOT NULL
LIMIT 5;
