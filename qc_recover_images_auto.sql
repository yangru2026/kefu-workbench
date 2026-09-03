-- 自动匹配：为图片数组全空的已讲解记录，按 created_at 最近原则匹配孤儿图片
-- 在 Supabase 控制台 SQL Editor 执行；管理员身份绕过 RLS，可写。
-- 安全护栏：
--   1. 只更新 scene_images 为空的记录；
--   2. 只匹配未被任何记录引用的孤儿图片；
--   3. 只取时间差 600 秒（10 分钟）内、最多 3 张图；
--   4. 生成结果请先逐条检查 staff/id 与图片文件名是否对应，确认后再执行。

WITH empty_records AS (
  SELECT id, staff, shop, created_at
  FROM qc_records
  WHERE status = 'done'
    AND date >= '2026-09-01'
    AND scene_images IS NOT NULL
    AND scene_images = '{}'::text[]
),
used_images AS (
  SELECT unnest(scene_images) AS img
  FROM qc_records
  WHERE scene_images IS NOT NULL AND scene_images <> '{}'::text[]
  UNION ALL
  SELECT unnest(reply_images)
  FROM qc_records
  WHERE reply_images IS NOT NULL AND reply_images <> '{}'::text[]
  UNION ALL
  SELECT unnest(knowledge_images)
  FROM qc_records
  WHERE knowledge_images IS NOT NULL AND knowledge_images <> '{}'::text[]
),
orphan_images AS (
  SELECT
    split_part(name, '/', 2) AS filename,
    created_at
  FROM storage.objects
  WHERE bucket_id = 'qc-images'
    AND name LIKE 'qc/img_%'
    AND split_part(name, '/', 2) NOT IN (SELECT img FROM used_images WHERE img IS NOT NULL)
),
matches AS (
  SELECT
    er.id,
    er.staff,
    er.created_at AS rec_at,
    oi.filename,
    oi.created_at AS img_at,
    ROW_NUMBER() OVER (
      PARTITION BY er.id
      ORDER BY ABS(EXTRACT(EPOCH FROM (er.created_at - oi.created_at))), oi.created_at
    ) AS rn
  FROM empty_records er
  JOIN orphan_images oi
    ON ABS(EXTRACT(EPOCH FROM (er.created_at - oi.created_at))) <= 600
)
SELECT
  'UPDATE qc_records SET scene_images = ARRAY[' ||
  string_agg('''' || filename || '''', ', ' ORDER BY rn) ||
  '], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = ' ||
  id || ' AND staff = ''' || staff || ''' AND (scene_images IS NULL OR scene_images = ''{}''::text[]);' AS sql,
  id,
  staff,
  COUNT(*) OVER (PARTITION BY id) AS matched_count
FROM matches
WHERE rn <= 3
GROUP BY id, staff
ORDER BY id;
