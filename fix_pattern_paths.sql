-- ============================================
-- 花色素材路径修复：中文路径 → 英文路径
-- ============================================
-- 问题: 数据库中 eye_img/lens_img 存的是中文路径(图片/图案/...)
--       实际文件在 images/patterns/ 目录下
--       导致前端加载 404
--
-- 使用方法: 在 Supabase SQL Editor 中执行以下所有语句

-- ============== 1. 诊断：查看当前路径前缀分布 ==============
SELECT 
  CASE 
    WHEN eye_img LIKE '图片/图案/%' THEN '图片/图案/ (中文)'
    WHEN eye_img LIKE '图片/模式/%' THEN '图片/模式/ (中文)'
    WHEN eye_img LIKE 'images/patterns/%' THEN 'images/patterns/ (英文)'
    WHEN eye_img IS NULL OR eye_img = '' THEN '(空)'
    ELSE '其他: ' || left(eye_img, 20)
  END AS eye_path_prefix,
  COUNT(*) AS count
FROM pattern_assets
GROUP BY 1
ORDER BY count DESC;

-- ============== 2. 修复：把所有中文路径前缀改成英文 ==============
UPDATE pattern_assets
SET 
  eye_img = CASE 
    WHEN eye_img LIKE '图片/图案/%' THEN REPLACE(eye_img, '图片/图案/', 'images/patterns/')
    WHEN eye_img LIKE '图片/模式/%' THEN REPLACE(eye_img, '图片/模式/', 'images/patterns/')
    WHEN eye_img LIKE '图片/%' THEN REPLACE(eye_img, '图片/', 'images/')
    ELSE eye_img
  END,
  lens_img = CASE 
    WHEN lens_img LIKE '图片/图案/%' THEN REPLACE(lens_img, '图片/图案/', 'images/patterns/')
    WHEN lens_img LIKE '图片/模式/%' THEN REPLACE(lens_img, '图片/模式/', 'images/patterns/')
    WHEN lens_img LIKE '图片/%' THEN REPLACE(lens_img, '图片/', 'images/')
    ELSE lens_img
  END;

-- ============== 3. 重新生成缩略图 URL（基于修复后的英文路径） ==============
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

-- ============== 4. 验证修复结果 ==============
SELECT name, brand, eye_img, thumb_eye_url, lens_img, thumb_lens_url
FROM pattern_assets
LIMIT 10;
