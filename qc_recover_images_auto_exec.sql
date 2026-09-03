-- 自动生成并合并所有待恢复 UPDATE 语句（一键执行版）
-- 在 Supabase 控制台 SQL Editor 执行；管理员身份绕过 RLS，可写。
-- ⚠️ 执行前建议先跑 qc_recover_images_auto.sql 查看匹配结果，确认 staff/id 与图片数量合理。

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
    oi.filename,
    ROW_NUMBER() OVER (
      PARTITION BY er.id
      ORDER BY ABS(EXTRACT(EPOCH FROM (er.created_at - oi.created_at))), oi.created_at
    ) AS rn
  FROM empty_records er
  JOIN orphan_images oi
    ON ABS(EXTRACT(EPOCH FROM (er.created_at - oi.created_at))) <= 600
),
update_groups AS (
  SELECT
    id,
    staff,
    string_agg('''' || filename || '''', ', ' ORDER BY rn) AS img_list
  FROM matches
  WHERE rn <= 3
  GROUP BY id, staff
)
SELECT
  string_agg(
    'UPDATE qc_records SET scene_images = ARRAY[' || img_list ||
    '], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = ' ||
    id || ' AND staff = ''' || staff || ''' AND (scene_images IS NULL OR scene_images = ''{}''::text[]);',
    E'\n' ORDER BY id
  ) AS all_update_sql
FROM update_groups;
