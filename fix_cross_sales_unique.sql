-- ============================================
-- 修复：允许手工粘贴 / 登记保留真正的重复记录
-- ============================================
-- 背景：
--   cross_sales 原表有 UNIQUE(record_date, first_order_no, second_order_no)。
--   批量粘贴 / 导入时，系统会按该键合并或拦截重复行，导致粘贴数量与原表对不上。
--   用户希望“不要拦截，全部写入，重复项由页面高亮，复核后自行删除”。
--
-- 方案：
--   1) 删除 (日期+第一单+第二单) 唯一约束；
--   2) 改为按 feishu_record_id 去重，且仅对“来自飞书的记录”生效
--      （用部分唯一索引 WHERE feishu_record_id <> ''，手工粘贴的记录该字段为空，不受约束，
--       因此可自由保留重复项；飞书同步的记录带唯一 feishu_record_id，仍能在重复同步时正确去重）。
--
-- 在 Supabase Dashboard → SQL Editor 中执行本脚本（只需执行一次）。
-- ============================================

-- 1. 动态删除旧的 (record_date, first_order_no, second_order_no) 唯一约束
DO $$
DECLARE
  con text;
BEGIN
  SELECT conname INTO con
  FROM pg_constraint
  WHERE conrelid = 'cross_sales'::regclass
    AND contype = 'u'
    AND (
      SELECT count(*) FROM unnest(conkey) AS k
      JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = k
      WHERE a.attname IN ('record_date','first_order_no','second_order_no')
    ) = 3;
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE cross_sales DROP CONSTRAINT %I', con);
    RAISE NOTICE '已删除唯一约束: %', con;
  ELSE
    RAISE NOTICE '未找到 (日期+第一单+第二单) 唯一约束，跳过';
  END IF;
END $$;

-- 2. 改为按飞书记录ID去重（仅对非空值生效，手工粘贴记录为空不受限）
DROP INDEX IF EXISTS cross_sales_feishu_record_id_key;
CREATE UNIQUE INDEX cross_sales_feishu_record_id_key
  ON cross_sales (feishu_record_id)
  WHERE feishu_record_id IS NOT NULL AND feishu_record_id <> '';

-- 3. 说明：飞书同步 Edge Function 的 cross_sales 配置需将 onConflict 改为 feishu_record_id
--    （见 supabase/functions/feishu-sync/index.ts 中 cross_sales 配置项），
--    并建议开启 insertOnly（按飞书ID忽略重复，避免重复同步产生多条）。
