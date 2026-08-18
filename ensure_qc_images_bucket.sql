-- ============================================================
-- 创建 qc-images Storage bucket 并配置公开读写策略
-- 图片上传保存失败时执行此脚本（幂等，可重复执行）
-- ============================================================

-- 1. 创建公开 bucket（已存在则跳过）
INSERT INTO storage.buckets (id, name, public)
VALUES ('qc-images', 'qc-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. 删除旧策略（避免重复）
DROP POLICY IF EXISTS "Allow public read on qc-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload on qc-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete on qc-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update on qc-images" ON storage.objects;

-- 3. 公开读取
CREATE POLICY "Allow public read on qc-images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'qc-images');

-- 4. 登录用户可上传
CREATE POLICY "Allow authenticated upload on qc-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'qc-images');

-- 5. 登录用户可删除
CREATE POLICY "Allow authenticated delete on qc-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'qc-images');

-- 6. 登录用户可更新
CREATE POLICY "Allow authenticated update on qc-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'qc-images')
WITH CHECK (bucket_id = 'qc-images');

-- 7. 验证
SELECT id, name, public FROM storage.buckets WHERE id = 'qc-images';
