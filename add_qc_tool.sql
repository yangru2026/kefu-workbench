-- ============================================
-- 质检工具 Supabase 建表语句
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 建表：qc_records
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

-- 2. 索引
CREATE INDEX IF NOT EXISTS idx_qc_records_staff ON qc_records(staff);
CREATE INDEX IF NOT EXISTS idx_qc_records_shop ON qc_records(shop);
CREATE INDEX IF NOT EXISTS idx_qc_records_date ON qc_records(date);
CREATE INDEX IF NOT EXISTS idx_qc_records_status ON qc_records(status);

-- 3. RLS
ALTER TABLE qc_records ENABLE ROW LEVEL SECURITY;

-- 所有人可读
CREATE POLICY "Allow public read on qc_records" 
ON qc_records FOR SELECT 
TO anon, authenticated 
USING (true);

-- 登录用户可增删改
CREATE POLICY "Allow authenticated write on qc_records" 
ON qc_records FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. 创建 Storage bucket（图片存储）
-- 注意：Storage bucket 需要通过 Supabase 网页界面创建
-- 路径：Storage → New bucket → 名称：qc-images → 勾选 Public bucket
-- 然后在 SQL Editor 执行以下策略：

-- Storage 策略：所有人可读图片
-- 如果 bucket 已存在，先删除旧策略再新建
DROP POLICY IF EXISTS "Allow public read on qc-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload on qc-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete on qc-images" ON storage.objects;

-- 执行创建 bucket 的 SQL（需要 storage 扩展权限）
-- INSERT INTO storage.buckets (id, name, public) VALUES ('qc-images', 'qc-images', true)
-- ON CONFLICT (id) DO NOTHING;

-- 公开读取 qc-images bucket 中的文件
CREATE POLICY "Allow public read on qc-images" 
ON storage.objects FOR SELECT 
TO anon, authenticated 
USING (bucket_id = 'qc-images');

-- 登录用户可上传到 qc-images
CREATE POLICY "Allow authenticated upload on qc-images" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'qc-images');

-- 登录用户可删除 qc-images 中的文件
CREATE POLICY "Allow authenticated delete on qc-images" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'qc-images');

-- 登录用户可更新 qc-images 中的文件
CREATE POLICY "Allow authenticated update on qc-images" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'qc-images') 
WITH CHECK (bucket_id = 'qc-images');
