-- =====================================================
-- 修复「一对一质检反馈」分享页匿名访问权限
-- 客服打开分享链接时通常未登录，需要 anon 角色可读
-- =====================================================

-- 1. 确保 qc_shares 允许匿名读取/更新（token 即密钥）
ALTER TABLE IF EXISTS qc_shares ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qc_shares' AND policyname = 'Allow public read on qc_shares'
  ) THEN
    CREATE POLICY "Allow public read on qc_shares"
    ON qc_shares FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qc_shares' AND policyname = 'Allow confirm update on qc_shares'
  ) THEN
    CREATE POLICY "Allow confirm update on qc_shares"
    ON qc_shares FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 2. 确保 qc_records 允许匿名读取（分享页需要按 id 拉取记录）
ALTER TABLE IF EXISTS qc_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qc_records' AND policyname = 'Allow public read on qc_records for shares'
  ) THEN
    CREATE POLICY "Allow public read on qc_records for shares"
    ON qc_records FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;

-- 3. 刷新 PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 4. 返回确认
SELECT 'qc_shares & qc_records public RLS OK' AS status;