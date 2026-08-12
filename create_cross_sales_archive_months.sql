-- ============================================
-- 连带成交 · 历史月份归档表
-- ============================================
-- 作用：
--   1. 记录已被管理员归档的月份（如 2026-08）
--   2. 已归档月份在页面上显示只读锁标记，防止客服误改历史数据
--   3. 管理员仍可编辑/解档，保证数据安全与纠错空间
-- ============================================

CREATE TABLE IF NOT EXISTS cross_sales_archive_months (
  id BIGSERIAL PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,      -- 归档月份：2026-08
  team TEXT DEFAULT 'all',         -- 'all' 表示整月归档，也可按组归档
  archived_by UUID REFERENCES auth.users(id),
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cs_archive_month ON cross_sales_archive_months(month);
CREATE INDEX IF NOT EXISTS idx_cs_archive_team ON cross_sales_archive_months(team);

-- RLS：所有人可查看，仅 admin/leader 可管理
ALTER TABLE cross_sales_archive_months ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "所有人可查看归档月份" ON cross_sales_archive_months;
CREATE POLICY "所有人可查看归档月份" ON cross_sales_archive_months
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "管理员可管理归档月份" ON cross_sales_archive_months;
CREATE POLICY "管理员可管理归档月份" ON cross_sales_archive_months
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','leader'))
  );

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cross_sales_archive_months'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cross_sales_archive_months;
  END IF;
END
$$;
