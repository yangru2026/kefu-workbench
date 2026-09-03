-- ============================================================
-- 清空 2026-09-01 / 2026-09-02 的质检登记（杨茹要求：这两天的登记太乱，重新登记）
-- 执行位置：Supabase 控制台 → SQL Editor（管理员身份，绕过 RLS）
-- 执行顺序：先看 0) 核对 → 1) 可选备份 → 2) 删存储桶文件 → 3) 删分享 → 4) 删记录（级联图片）
-- 说明：
--   • 图片归属已用 qc_images 表外键 ON DELETE CASCADE 绑定，删 qc_records 会自动删 qc_images 行；
--   • qc_image_snapshots 同样 ON DELETE CASCADE，一并清理；
--   • 但存储桶(qc-images)里的物理文件不会因 DB 级联而删除，必须在第 2 步用 SQL 清 storage.objects；
--   • qc_shares.record_ids 是 BIGINT[]，第 3 步按数组包含关系清理。
-- ============================================================

-- 0) 先核对将影响的记录（务必先跑这条，确认范围只有 9/1、9/2）
SELECT id, staff, shop, date, status, severity
FROM qc_records
WHERE date IN ('2026-09-01', '2026-09-02')
ORDER BY date, staff;

-- 1) 可选：备份一份（执行一次即可，重复执行会报已存在，可忽略）
--    CREATE TABLE IF NOT EXISTS qc_records_bak_0901_0902 AS
--    SELECT * FROM qc_records WHERE date IN ('2026-09-01','2026-09-02');

-- 收集待删记录的 id（建临时表，供后续步骤匹配存储桶路径 / 分享数组）
DROP TABLE IF EXISTS _qc_del_ids;
CREATE TEMP TABLE _qc_del_ids AS
SELECT id FROM qc_records WHERE date IN ('2026-09-01', '2026-09-02');

-- 2) 清理存储桶中这些记录对应的图片物理文件
--    新路径：rec/<id>/<kind>-<时间戳>-<随机>.jpg
--    旧路径：qc/<id>.jpg
DELETE FROM storage.objects
WHERE bucket_id = 'qc-images'
  AND (
    EXISTS (SELECT 1 FROM _qc_del_ids d WHERE name LIKE 'rec/' || d.id::text || '/%')
    OR EXISTS (SELECT 1 FROM _qc_del_ids d WHERE name = 'qc/' || d.id::text || '.jpg')
  );

-- 3) 清理指向这些记录的分享批次（record_ids 为 BIGINT[]）
DELETE FROM qc_shares
WHERE EXISTS (SELECT 1 FROM _qc_del_ids d WHERE d.id = ANY (qc_shares.record_ids));

-- 4) 删除记录本体（级联删除 qc_images / qc_image_snapshots 关联行）
DELETE FROM qc_records
WHERE id IN (SELECT id FROM _qc_del_ids);

-- 5) 校验：以下应均返回 0 行
SELECT
  (SELECT COUNT(*) FROM qc_records WHERE date IN ('2026-09-01','2026-09-02')) AS 残留记录数,
  (SELECT COUNT(*) FROM qc_images qi WHERE EXISTS (SELECT 1 FROM _qc_del_ids d WHERE d.id = qi.record_id)) AS 残留图片行数;

DROP TABLE IF EXISTS _qc_del_ids;
