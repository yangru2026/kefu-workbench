-- ============================================================
-- 质检工具：基础数据表（客服 / 店铺 可在线维护的列表）
-- 执行位置：Supabase 控制台 → SQL Editor（管理员身份），一次性执行
-- 用途：让管理员无需改代码即可增删客服名单 / 店铺明细
-- 前端 qc-v2.html 的「⚙️ 基础数据」管理页读写此表
-- ============================================================

-- 1. 建表
CREATE TABLE IF NOT EXISTS public.qc_options (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category   TEXT NOT NULL,                 -- 'staff' = 客服，'shop' = 店铺
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, name)
);

CREATE INDEX IF NOT EXISTS idx_qc_options_cat ON public.qc_options(category);

-- 2. 开启 RLS
ALTER TABLE public.qc_options ENABLE ROW LEVEL SECURITY;

-- 3. 策略：登录用户可读写（新增/删除是否开放，由前端 isAdmin 控制）
DROP POLICY IF EXISTS "qc_options_select" ON public.qc_options;
CREATE POLICY "qc_options_select" ON public.qc_options
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "qc_options_insert" ON public.qc_options;
CREATE POLICY "qc_options_insert" ON public.qc_options
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "qc_options_delete" ON public.qc_options;
CREATE POLICY "qc_options_delete" ON public.qc_options
  FOR DELETE TO authenticated USING (true);

-- 4. 校验
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='qc_options') AS qc_options表,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename='qc_options') AS 策略数;
