-- ============================================================
-- 质检 id 修复 V3（终极版）：identity 换成显式序列 + 触发器兜底
-- 用法：Supabase SQL Editor 整段执行，可重复运行（幂等）
-- ============================================================

-- 1) 移除 identity（如果之前加过），改用普通序列默认值
ALTER TABLE qc_records ALTER COLUMN id DROP IDENTITY IF EXISTS;

-- 2) 建独立序列并拨号到现有最大 id 之后（重跑也不会回拨造成冲突）
CREATE SEQUENCE IF NOT EXISTS qc_records_id_fallback_seq;
SELECT setval('qc_records_id_fallback_seq',
  GREATEST(
    (SELECT COALESCE(MAX(id),0)+1 FROM qc_records),
    (SELECT COALESCE(last_value,0)+1 FROM qc_records_id_fallback_seq)
  ), false);
GRANT USAGE, SELECT ON SEQUENCE qc_records_id_fallback_seq TO anon, authenticated, service_role;

-- 3) id 默认值 = 序列自增（覆盖「不传 id」的情况）
ALTER TABLE qc_records ALTER COLUMN id SET DEFAULT nextval('qc_records_id_fallback_seq');

-- 4) 触发器兜底（覆盖「显式传 id=null」的情况，比如浏览器缓存的旧页面）
CREATE OR REPLACE FUNCTION qc_records_fix_id()
RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := nextval('qc_records_id_fallback_seq');
  END IF;
  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS trg_qc_records_fix_id ON qc_records;
CREATE TRIGGER trg_qc_records_fix_id
BEFORE INSERT ON qc_records
FOR EACH ROW EXECUTE FUNCTION qc_records_fix_id();

-- 5) 刷新 PostgREST 缓存
NOTIFY pgrst, 'reload schema';

-- 6) 干跑验证 A：显式传 id=NULL（模拟旧缓存页面）→ 必须无红色报错
BEGIN;
INSERT INTO qc_records (id, staff, shop, date, problem)
VALUES (NULL, '__诊断__', '__诊断__', '2026-09-05', '显式null验证，即将回滚');
ROLLBACK;

-- 7) 干跑验证 B：不传 id（模拟新版页面）→ 必须无红色报错
BEGIN;
INSERT INTO qc_records (staff, shop, date, problem)
VALUES ('__诊断__', '__诊断__', '2026-09-05', '自增验证，即将回滚');
ROLLBACK;

-- 成功标志：Results 无红色报错（两次 INSERT 均随即回滚，不留数据）
-- 跑完后：质检页面 Ctrl+Shift+R 强刷，重新保存即可
