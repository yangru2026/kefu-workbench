-- ============================================================
-- 修复 qc_records.id 类型错误：把 uuid 改为 BIGINT
-- 执行前会自动备份数据到 qc_records_backup_20260818
-- 在 Supabase SQL Editor 中执行后，按 Ctrl+Shift+R 刷新页面
-- ============================================================

-- 1. 自动备份当前数据（保留字段，id 以原样备份）
DROP TABLE IF EXISTS qc_records_backup_20260818;
CREATE TABLE qc_records_backup_20260818 AS SELECT * FROM qc_records;

-- 2. 删除旧表并重建为 BIGINT 主键
DROP TABLE IF EXISTS qc_records CASCADE;

CREATE TABLE qc_records (
  id BIGINT PRIMARY KEY,
  staff TEXT NOT NULL,
  customer_id TEXT DEFAULT '',
  shop TEXT NOT NULL,
  date TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT '一般',
  scene TEXT DEFAULT '',
  reply TEXT DEFAULT '',
  problem TEXT NOT NULL,
  correct TEXT DEFAULT '',
  knowledge TEXT DEFAULT '',
  note TEXT DEFAULT '',
  scene_images TEXT[] DEFAULT '{}',
  reply_images TEXT[] DEFAULT '{}',
  knowledge_images TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  coach_date TEXT DEFAULT '',
  coach_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT ''
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_qc_records_staff ON qc_records(staff);
CREATE INDEX IF NOT EXISTS idx_qc_records_shop ON qc_records(shop);
CREATE INDEX IF NOT EXISTS idx_qc_records_date ON qc_records(date);
CREATE INDEX IF NOT EXISTS idx_qc_records_status ON qc_records(status);

-- 4. RLS
ALTER TABLE qc_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on qc_records" 
ON qc_records FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Allow authenticated write on qc_records" 
ON qc_records FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. 刷新 PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 6. 验证表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'qc_records'
ORDER BY ordinal_position;
