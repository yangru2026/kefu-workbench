-- ============================================================
-- 质检重做 v4 · 补差量（2026-11-02）
-- 背景：10-31 跑的是 v3（14 列），v4 新增的 3 列 + 确认函数没跑成功 →
--       ① 客服登录弹窗读 guidance / staff_confirmed_at 直接报列不存在 → 弹窗不出来
--       ② 客服点「我已知晓」调 qc_confirm_staff() → 函数不存在 → 确认失败、日报也提交不了
-- 本脚本不删表、不删数据，只补缺的东西，可重复执行（幂等）
-- 执行环境：新项目 youhe-workbench（icfgireprowcqwdodfqx）SQL Editor
-- ============================================================

-- 1) 补 3 列
ALTER TABLE public.qc_records ADD COLUMN IF NOT EXISTS guidance           text;
ALTER TABLE public.qc_records ADD COLUMN IF NOT EXISTS staff_confirmed_at timestamptz;
ALTER TABLE public.qc_records ADD COLUMN IF NOT EXISTS staff_confirm_note text;

-- 2) 客服「我已知晓」确认函数：只能确认自己花名的记录，只能改确认字段
CREATE OR REPLACE FUNCTION public.qc_confirm_staff(p_ids text[], p_note text default null)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_count integer;
BEGIN
  SELECT name INTO v_name FROM public.profiles WHERE id = auth.uid();
  IF v_name IS NULL THEN
    RAISE EXCEPTION '未找到当前用户的花名';
  END IF;

  UPDATE public.qc_records r
     SET staff_confirmed_at = now(),
         staff_confirm_note = nullif(trim(coalesce(p_note, '')), '')
   WHERE r.id = ANY(p_ids)
     AND r.staff_name = v_name
     AND r.staff_confirmed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.qc_confirm_staff(text[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.qc_confirm_staff(text[], text) TO authenticated;

-- 3) 索引（缺了会慢，重复建没关系）
CREATE INDEX IF NOT EXISTS idx_qc_records_date     ON public.qc_records (qc_date DESC);
CREATE INDEX IF NOT EXISTS idx_qc_records_staff    ON public.qc_records (staff_name);
CREATE INDEX IF NOT EXISTS idx_qc_records_confirm  ON public.qc_records (staff_confirmed_at);

-- 4) 读权限策略（客服只看自己花名，admin/leader 看全部）—— 已有会跳过重建
DROP POLICY IF EXISTS "qc_read" ON public.qc_records;
CREATE POLICY "qc_read" ON public.qc_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','leader'))
    OR staff_name = (SELECT p2.name FROM public.profiles p2 WHERE p2.id = auth.uid())
  );

-- 5) 校验：应返回 17 行，能看到 guidance / staff_confirmed_at / staff_confirm_note
SELECT ordinal_position AS pos, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'qc_records'
ORDER BY ordinal_position;
