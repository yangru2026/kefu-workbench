-- ============================================================
-- 质检保存终极兜底：id 即使被前端显式传 null 也能自动生成
-- 背景：旧版页面缓存会在 INSERT 里带 id:null，绕过 identity 自增
--       报 null value in column "id" ... not-null constraint
-- 用法：Supabase SQL Editor 整段执行，可重复运行（幂等）
-- ============================================================

-- 1) 兜底函数：NEW.id 为 NULL 时用 identity 序列补上
CREATE OR REPLACE FUNCTION qc_records_fix_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := nextval(pg_get_serial_sequence('qc_records','id'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qc_records_fix_id ON qc_records;
CREATE TRIGGER trg_qc_records_fix_id
BEFORE INSERT ON qc_records
FOR EACH ROW EXECUTE FUNCTION qc_records_fix_id();

-- 2) 刷新 PostgREST 结构缓存（确保 REST 层感知最新表结构）
NOTIFY pgrst, 'reload schema';

-- 3) 干跑验证 A：显式传 id=NULL（模拟旧缓存页面的行为）→ 应成功回滚、无红色报错
BEGIN;
INSERT INTO qc_records (id, staff, shop, date, problem)
VALUES (NULL, '__诊断__', '__诊断__', '2026-09-05', '显式null验证，即将回滚');
ROLLBACK;

-- 4) 干跑验证 B：不传 id（模拟新版页面）→ 应成功回滚、无红色报错
BEGIN;
INSERT INTO qc_records (staff, shop, date, problem)
VALUES ('__诊断__', '__诊断__', '2026-09-05', '自增验证，即将回滚');
ROLLBACK;

-- 成功标志：Results 无红色报错（两次 INSERT 均随即回滚，不留数据）
-- 跑完后：质检工具页面 Ctrl+Shift+R 强刷，重新保存即可
