-- ============================================================
-- 质检工具：本人确认表（客服自主确认质检清单，模式二）
-- 执行位置：Supabase 控制台 → SQL Editor（管理员身份），一次性执行
-- 用途：普通客服在质检列表对自己名下的记录点「本人确认已知晓」时，记录确认状态
-- 前端 qc-v2.html 的列表「确认」列读写此表
-- ============================================================

-- 1. 建表
CREATE TABLE IF NOT EXISTS public.qc_confirmations (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id    BIGINT NOT NULL REFERENCES qc_records(id) ON DELETE CASCADE,
  staff        TEXT NOT NULL,               -- 确认的客服姓名
  user_id      UUID,                         -- 确认人登录账号（可选）
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_confirmations_record ON public.qc_confirmations(record_id);

-- 2. 开启 RLS
ALTER TABLE public.qc_confirmations ENABLE ROW LEVEL SECURITY;

-- 3. 策略：登录用户可读写（确认动作由前端限制为「本人 = 记录所属客服」）
DROP POLICY IF EXISTS "qc_confirmations_all" ON public.qc_confirmations;
CREATE POLICY "qc_confirmations_all" ON public.qc_confirmations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. 校验
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='qc_confirmations') AS qc_confirmations表,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename='qc_confirmations') AS 策略数;
