-- ============================================================
-- 质检工具 图片系统重做 · 第 2 步：把历史图片迁进 qc_images
-- 在 Supabase 控制台 → SQL Editor 执行（必须先执行 add_qc_images_table.sql）
-- ============================================================
-- 本脚本做四件事，全程不删除任何图片文件：
--   ① 把 qc_records 三个图片数组整表备份（可随时回滚）
--   ② 把数组里的图片逐张写入 qc_images，建立硬外键关系
--   ③ 把「历史靠时间戳猜出来的」图片标记为 suspect（不可信）
--      → 前端记录上不再显示它们，改为进入「图片核对池」等人工确认
--   ④ 输出统计，方便核对结果
-- ============================================================

-- ------------------------------------------------------------
-- ① 全量备份（一次性，重复执行不会覆盖已有备份）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qc_records_images_backup_20260903 AS
SELECT
  id,
  staff,
  shop,
  date,
  status,
  scene_images,
  reply_images,
  knowledge_images,
  created_at,
  NOW() AS backup_at
FROM qc_records;

-- ------------------------------------------------------------
-- ② 迁移：数组 → qc_images 行
--    scene / reply / knowledge 三个字段分别展开，保留原顺序
-- ------------------------------------------------------------
INSERT INTO qc_images (record_id, kind, seq, file_path, trust, source)
SELECT r.id,
       'scene',
       t.ord - 1,
       'qc/' || t.fname,
       'ok',
       'migrate'
FROM qc_records r
CROSS JOIN LATERAL unnest(r.scene_images) WITH ORDINALITY AS t(fname, ord)
WHERE r.scene_images IS NOT NULL
  AND r.scene_images <> '{}'::text[]
  AND COALESCE(t.fname, '') <> ''
ON CONFLICT (record_id, kind, file_path) DO NOTHING;

INSERT INTO qc_images (record_id, kind, seq, file_path, trust, source)
SELECT r.id,
       'reply',
       t.ord - 1,
       'qc/' || t.fname,
       'ok',
       'migrate'
FROM qc_records r
CROSS JOIN LATERAL unnest(r.reply_images) WITH ORDINALITY AS t(fname, ord)
WHERE r.reply_images IS NOT NULL
  AND r.reply_images <> '{}'::text[]
  AND COALESCE(t.fname, '') <> ''
ON CONFLICT (record_id, kind, file_path) DO NOTHING;

INSERT INTO qc_images (record_id, kind, seq, file_path, trust, source)
SELECT r.id,
       'knowledge',
       t.ord - 1,
       'qc/' || t.fname,
       'ok',
       'migrate'
FROM qc_records r
CROSS JOIN LATERAL unnest(r.knowledge_images) WITH ORDINALITY AS t(fname, ord)
WHERE r.knowledge_images IS NOT NULL
  AND r.knowledge_images <> '{}'::text[]
  AND COALESCE(t.fname, '') <> ''
ON CONFLICT (record_id, kind, file_path) DO NOTHING;

-- ------------------------------------------------------------
-- ③ 把「猜出来的」图片降级为 suspect（不可信 → 进核对池）
-- ------------------------------------------------------------
-- 3-1  qc_recover_images.sql 手工恢复过的 31 条记录
UPDATE qc_images
SET trust = 'suspect',
    note  = '历史按上传时间猜测匹配，需人工核对'
WHERE record_id IN (
  1788249112895801, 1788249184779118, 1788249234194124, 1788249362117958,
  1788249577989027, 1788251696234449, 1788253807517166, 1788254175233078,
  1788254704590756, 1788255474262184, 1788255568718790, 1788271004703242,
  1788271916342192, 1788276538090896, 1788276554320089, 1788276736290754,
  1788276892335097, 1788277083405573, 1788277200430396, 1788277608416790,
  1788277680024962, 1788278058075234, 1788278183840051, 1788278465479871,
  1788278637459622, 1788279055503728, 1788279739447854, 1788280264507441,
  1788280408829914, 1788280705220097, 1788280616571201
);

-- 3-2  qc_recover_images_auto_exec.sql 自动匹配过的窗口
--      （9/1 起、已讲解、当时图片为空的那批 —— 无法逐条区分，
--        整个窗口一起进核对池；本来就正常的在面板上点「确认无误」即可）
UPDATE qc_images i
SET trust = 'suspect',
    note  = '9月自动匹配窗口，需人工核对'
FROM qc_records r
WHERE i.record_id = r.id
  AND i.trust = 'ok'
  AND r.date >= '2026-09-01'
  AND r.status = 'done';

-- ------------------------------------------------------------
-- ④ 统计核对
-- ------------------------------------------------------------
SELECT '迁移总图片数'      AS 项目, COUNT(*)::text AS 数值 FROM qc_images
UNION ALL
SELECT '其中 可信(ok)',      COUNT(*)::text FROM qc_images WHERE trust = 'ok'
UNION ALL
SELECT '其中 待核对(suspect)', COUNT(*)::text FROM qc_images WHERE trust = 'suspect'
UNION ALL
SELECT '涉及记录数',          COUNT(DISTINCT record_id)::text FROM qc_images
UNION ALL
SELECT '存储桶文件总数',      COUNT(*)::text FROM storage.objects WHERE bucket_id = 'qc-images'
UNION ALL
SELECT '无主孤儿文件数',      COUNT(*)::text FROM storage.objects o
  WHERE o.bucket_id = 'qc-images'
    AND o.name NOT IN (SELECT file_path FROM qc_images);

-- ------------------------------------------------------------
-- 【回滚办法】（万一需要）
-- UPDATE qc_records r SET
--   scene_images     = b.scene_images,
--   reply_images     = b.reply_images,
--   knowledge_images = b.knowledge_images
-- FROM qc_records_images_backup_20260903 b
-- WHERE r.id = b.id;
-- TRUNCATE qc_images;
-- ------------------------------------------------------------
