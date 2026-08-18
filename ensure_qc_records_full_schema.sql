-- ============================================================
-- 补齐 qc_records 全量字段 + 索引 + RLS（幂等，可重复执行）
-- 在 Supabase SQL Editor 中执行后，刷新 PostgREST schema cache
-- ============================================================

-- 1. 如果表不存在，用完整结构创建
CREATE TABLE IF NOT EXISTS qc_records (
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

-- 2. 如果表已存在但缺列，逐个补齐（幂等）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'id') THEN
    ALTER TABLE qc_records ADD COLUMN id BIGINT PRIMARY KEY;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'staff') THEN
    ALTER TABLE qc_records ADD COLUMN staff TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'customer_id') THEN
    ALTER TABLE qc_records ADD COLUMN customer_id TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'shop') THEN
    ALTER TABLE qc_records ADD COLUMN shop TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'date') THEN
    ALTER TABLE qc_records ADD COLUMN date TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'tags') THEN
    ALTER TABLE qc_records ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'severity') THEN
    ALTER TABLE qc_records ADD COLUMN severity TEXT NOT NULL DEFAULT '一般';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'scene') THEN
    ALTER TABLE qc_records ADD COLUMN scene TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'reply') THEN
    ALTER TABLE qc_records ADD COLUMN reply TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'problem') THEN
    ALTER TABLE qc_records ADD COLUMN problem TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'correct') THEN
    ALTER TABLE qc_records ADD COLUMN correct TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'knowledge') THEN
    ALTER TABLE qc_records ADD COLUMN knowledge TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'note') THEN
    ALTER TABLE qc_records ADD COLUMN note TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'scene_images') THEN
    ALTER TABLE qc_records ADD COLUMN scene_images TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'reply_images') THEN
    ALTER TABLE qc_records ADD COLUMN reply_images TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'knowledge_images') THEN
    ALTER TABLE qc_records ADD COLUMN knowledge_images TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'status') THEN
    ALTER TABLE qc_records ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'coach_date') THEN
    ALTER TABLE qc_records ADD COLUMN coach_date TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'coach_note') THEN
    ALTER TABLE qc_records ADD COLUMN coach_note TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'created_at') THEN
    ALTER TABLE qc_records ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'updated_at') THEN
    ALTER TABLE qc_records ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qc_records' AND column_name = 'created_by') THEN
    ALTER TABLE qc_records ADD COLUMN created_by TEXT DEFAULT '';
  END IF;
END $$;

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_qc_records_staff ON qc_records(staff);
CREATE INDEX IF NOT EXISTS idx_qc_records_shop ON qc_records(shop);
CREATE INDEX IF NOT EXISTS idx_qc_records_date ON qc_records(date);
CREATE INDEX IF NOT EXISTS idx_qc_records_status ON qc_records(status);

-- 4. RLS 策略
ALTER TABLE qc_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qc_records' AND policyname = 'Allow public read on qc_records'
  ) THEN
    CREATE POLICY "Allow public read on qc_records" ON qc_records
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qc_records' AND policyname = 'Allow authenticated write on qc_records'
  ) THEN
    CREATE POLICY "Allow authenticated write on qc_records" ON qc_records
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. 刷新 PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 6. 验证列是否齐全
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'qc_records'
ORDER BY ordinal_position;
