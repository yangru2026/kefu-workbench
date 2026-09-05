-- ============================================================
-- 质检 id 兜底 V2：自诊断 + 独立序列兜底（不依赖 identity）
-- 用法：Supabase SQL Editor 整段执行，可重复运行（幂等）
-- 跑完请把 Results 上方的「Messages」标签内容也截图（有诊断输出）
-- ============================================================

-- 0) 诊断当前状态（结果显示在 Messages 标签）
DO $$
DECLARE
  v_idinfo text; v_trg text; v_seq text;
BEGIN
  SELECT coalesce(is_identity,'?') || ' / ' || coalesce(identity_generation,'?') || ' / default=' || coalesce(column_default,'无')
    INTO v_idinfo
    FROM information_schema.columns
   WHERE table_name='qc_records' AND column_name='id';
  SELECT coalesce(string_agg(tgname, ', '),'（无）') INTO v_trg
    FROM pg_trigger WHERE tgrelid='qc_records'::regclass AND NOT tgisinternal;
  v_seq := pg_get_serial_sequence('qc_records','id');
  RAISE NOTICE '[诊断1] id列(identity/默认值): %', v_idinfo;
  RAISE NOTICE '[诊断2] 表上触发器: %', v_trg;
  RAISE NOTICE '[诊断3] identity序列: %', coalesce(v_seq,'（无）');
END $$;

-- 1) 确保有一个可用的兜底序列（优先用 identity 自带序列，没有就建独立序列）
DO $$
DECLARE
  v_seq text;
BEGIN
  v_seq := pg_get_serial_sequence('qc_records','id');
  IF v_seq IS NULL THEN
    CREATE SEQUENCE IF NOT EXISTS qc_records_id_fallback_seq;
    EXECUTE 'SELECT setval(''qc_records_id_fallback_seq'', COALESCE((SELECT MAX(id) FROM qc_records),0)+1, false)';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE qc_records_id_fallback_seq TO anon, authenticated, service_role';
    v_seq := 'qc_records_id_fallback_seq';
    RAISE NOTICE '[修复] identity 序列不存在，已创建独立序列 % 并按最大 id 拨号', v_seq;
  ELSE
    RAISE NOTICE '[修复] 使用 identity 自带序列 %', v_seq;
  END IF;

  EXECUTE format('CREATE OR REPLACE FUNCTION qc_records_fix_id() RETURNS trigger LANGUAGE plpgsql AS $f$
    BEGIN
      IF NEW.id IS NULL THEN
        NEW.id := nextval(%L);
      END IF;
      RETURN NEW;
    END $f;', v_seq);
END $$;

-- 2) 重建触发器（删了再建，保证是最新定义）
DROP TRIGGER IF EXISTS trg_qc_records_fix_id ON qc_records;
CREATE TRIGGER trg_qc_records_fix_id
BEFORE INSERT ON qc_records
FOR EACH ROW EXECUTE FUNCTION qc_records_fix_id();

-- 3) 刷新 PostgREST 缓存
NOTIFY pgrst, 'reload schema';

-- 4) 验证触发器已挂上
DO $$
DECLARE
  v_trg text;
BEGIN
  SELECT coalesce(string_agg(tgname, ', '),'（无！）') INTO v_trg
    FROM pg_trigger WHERE tgrelid='qc_records'::regclass AND NOT tgisinternal;
  RAISE NOTICE '[验证] 触发器现在是: %', v_trg;
END $$;

-- 5) 干跑验证 A：显式传 id=NULL（模拟旧缓存页面）→ 必须成功回滚、无红色报错
BEGIN;
INSERT INTO qc_records (id, staff, shop, date, problem)
VALUES (NULL, '__诊断__', '__诊断__', '2026-09-05', '显式null验证，即将回滚');
ROLLBACK;

-- 6) 干跑验证 B：不传 id（模拟新版页面）→ 必须成功回滚、无红色报错
BEGIN;
INSERT INTO qc_records (staff, shop, date, problem)
VALUES ('__诊断__', '__诊断__', '2026-09-05', '自增验证，即将回滚');
ROLLBACK;

-- 成功标志：无红色报错。若验证 A 仍报 null id，
-- 请把「Messages」标签的诊断输出发我（能直接定位断在哪一环）。
