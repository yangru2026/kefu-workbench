-- 给 pattern_assets 表添加 (name, brand) 唯一约束
-- 这是飞书同步 ON CONFLICT 需要的约束

-- 先检查是否有重复的 (name, brand) 组合
-- 如果有重复，这里会列出来，需要先手动处理
SELECT name, brand, count(*) as cnt
FROM pattern_assets
GROUP BY name, brand
HAVING count(*) > 1;

-- 创建唯一索引（如果上面查询有结果，需要先删除重复记录再执行）
CREATE UNIQUE INDEX IF NOT EXISTS pattern_assets_name_brand_key 
ON pattern_assets (name, brand);
