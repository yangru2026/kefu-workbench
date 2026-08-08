-- ============================================
-- 确保 pattern_assets 表有 created_at 字段
-- 用于新款花色置顶排序（30天内新增的排最前面）
-- 幂等执行，可重复运行
-- ============================================

-- 1. 添加 created_at 字段（如果不存在）
ALTER TABLE pattern_assets
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 2. 如果有现有记录的 created_at 为 NULL，用 now() 填充
UPDATE pattern_assets SET created_at = now() WHERE created_at IS NULL;

-- 3. 确保后续插入自动填充（DEFAULT 已设置，这里确认一下）
-- Supabase 的 REST API insert 会自动使用 DEFAULT

-- 验证
SELECT 'created_at 列状态:' as info,
       count(*) as total,
       count(created_at) as has_created_at,
       count(*) - count(created_at) as missing
FROM pattern_assets;
