-- ============================================
-- 创建 pattern-images Storage bucket
-- 用于存储从飞书附件下载的花色图片
-- 幂等执行，可重复运行
-- ============================================

-- 1. 创建公开 bucket（图片需要公开访问）
INSERT INTO storage.buckets (id, name, public)
VALUES ('pattern-images', 'pattern-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 设置 Storage 策略：允许匿名用户读取（公开访问）
-- 使用 DO + EXCEPTION 处理幂等性
DO $$
BEGIN
  -- 允许匿名读取
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies
    WHERE name = 'pattern_images_public_read'
  ) THEN
    CREATE POLICY pattern_images_public_read
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'pattern-images');
  END IF;

  -- 允许 service_role 写入（Edge Function 用 service role key）
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies
    WHERE name = 'pattern_images_service_write'
  ) THEN
    CREATE POLICY pattern_images_service_write
    ON storage.objects FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'pattern-images');
  END IF;

  -- 允许 service_role 更新/删除
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies
    WHERE name = 'pattern_images_service_modify'
  ) THEN
    CREATE POLICY pattern_images_service_modify
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id = 'pattern-images')
    WITH CHECK (bucket_id = 'pattern-images');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '策略可能已存在: %', SQLERRM;
END $$;

-- 验证
SELECT 'bucket 状态:' as info,
       id, name, public
FROM storage.buckets
WHERE id = 'pattern-images';
