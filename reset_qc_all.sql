-- ============================================================
-- 质检工具【数据彻底重置】(杨茹要求：连数据一起清空，从零开始)
-- 执行位置：Supabase 控制台 → SQL Editor（管理员身份）
-- 安全设计：① 先把所有 qc_* 表自动备份到 qc_backup_20260903  schema
--          ② 再 DROP 全部 qc_* 表（CASCADE）
--          ③ 清空存储桶 qc-images 的物理文件
--          ④ 重建表结构需另跑「重建脚本清单」（见文件末尾）
-- ⚠️ 备份 schema 会保留 30 天再手动删；若想再次运行本文件，请先 DROP SCHEMA qc_backup_20260903 CASCADE;
-- ============================================================

-- 0) 先看一眼当前有哪些 qc_* 表（确认范围）
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'qc_%'
ORDER BY table_name;

-- 1) 自动备份（结构+数据）到独立 schema，可回退
CREATE SCHEMA IF NOT EXISTS qc_backup_20260903;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'qc_%'
  LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS qc_backup_20260903.%I (LIKE public.%I INCLUDING ALL)', r.table_name, r.table_name);
    EXECUTE format('INSERT INTO qc_backup_20260903.%I SELECT * FROM public.%I', r.table_name, r.table_name);
  END LOOP;
END $$;

-- 2) 删除全部 qc_* 表（含外键级联）
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'qc_%'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.table_name);
  END LOOP;
END $$;

-- 3) 清空存储桶里的物理图片文件
DELETE FROM storage.objects WHERE bucket_id = 'qc-images';

-- 4) 校验：以下应返回 0 行
SELECT COUNT(*) AS 残留_qc表数
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'qc_%';

-- ============================================================
-- 5) 重建表结构：只需在 SQL Editor 执行【一个】干净脚本即可
--    👉 create_qc_schema_clean.sql  （单一文件：qc_records / qc_images / qc_image_snapshots / qc_shares / notifications + RLS + 存储桶策略，均已 IF NOT EXISTS）
--
-- 重建后，qc-v2.html 会从空数据重新开始，配合「重做」后的前端即为全新状态。
-- 备份数据仍在 qc_backup_20260903.*，确认无误后可手动：DROP SCHEMA qc_backup_20260903 CASCADE;
-- ============================================================
