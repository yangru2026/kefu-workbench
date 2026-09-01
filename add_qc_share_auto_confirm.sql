-- ============================================
-- 质检「发送客服确认」：超时自动确认 + 到期提醒
-- 在 Supabase SQL Editor 中整段执行（可重复执行，不会报错）
-- ============================================

-- 1. qc_shares 增加超时相关字段
ALTER TABLE qc_shares ADD COLUMN IF NOT EXISTS auto_confirm_hours INT  DEFAULT 48;
ALTER TABLE qc_shares ADD COLUMN IF NOT EXISTS due_at            TIMESTAMPTZ;
ALTER TABLE qc_shares ADD COLUMN IF NOT EXISTS auto_confirmed    BOOLEAN DEFAULT false;
ALTER TABLE qc_shares ADD COLUMN IF NOT EXISTS reminded_at       TIMESTAMPTZ;

-- 2. 回填历史数据：老分享按 48 小时算到期时间
UPDATE qc_shares
SET due_at = created_at + (COALESCE(auto_confirm_hours, 48) * INTERVAL '1 hour')
WHERE due_at IS NULL;

-- 3. 给 notifications 补一条 INSERT 策略
--    （质检员发分享时，需要往「别人」的通知列表里写一条提醒）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'notifications'
      AND policyname = 'Allow authenticated insert notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow authenticated insert notifications" '
         || 'ON notifications FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;
END $$;

-- 4. 索引：加速到期扫描
CREATE INDEX IF NOT EXISTS idx_qc_shares_due ON qc_shares(due_at) WHERE confirmed_at IS NULL;

-- 5. 确认一下结果
SELECT id, staff, record_count, created_at, auto_confirm_hours, due_at,
       confirmed_at, auto_confirmed, reminded_at
FROM qc_shares
ORDER BY created_at DESC
LIMIT 20;
