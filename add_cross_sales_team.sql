-- ============================================
-- 连带成交表增加 team（组别）字段
-- ============================================
-- 用途：
--   1. 支持 A/B/C 组分组统计和排名
--   2. 登记时自动关联客服所在组别
--   3. Excel 导入时支持组别反查
-- ============================================

-- 1. 添加 team 字段
ALTER TABLE cross_sales 
ADD COLUMN IF NOT EXISTS team TEXT DEFAULT 'A组';

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_cross_sales_team ON cross_sales(team);

-- 3. 更新现有数据：根据 staff_name 反查 profiles 表的 group_name
--    （执行前请确认 profiles 表有正确的 group_name 数据）
UPDATE cross_sales cs
SET team = COALESCE(p.group_name, 'A组')
FROM profiles p
WHERE cs.staff_name = p.name
   OR cs.staff_name = p.real_name;

-- 4. 如果还有未匹配到的，保持默认值
UPDATE cross_sales
SET team = 'A组'
WHERE team IS NULL OR team = '';
