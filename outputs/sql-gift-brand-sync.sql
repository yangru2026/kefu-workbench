-- 赠品编码加大类：brand（弥生/极氧/其他）
ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS brand text;

-- 回填现有行（按编码关键字归类）
UPDATE gift_codes SET brand = '极氧' WHERE brand IS NULL AND (merchant_code LIKE '极氧%' OR name LIKE '极氧%' OR merchant_code LIKE '%铃兰%' OR name LIKE '%铃兰%');
UPDATE gift_codes SET brand = '弥生' WHERE brand IS NULL AND (merchant_code LIKE '弥生%' OR name LIKE '弥生%' OR merchant_code LIKE '%初音%' OR merchant_code LIKE '%人鱼%' OR merchant_code LIKE '%MIUSOU%' OR merchant_code LIKE '%少女%' OR name LIKE '%初音%' OR name LIKE '%人鱼%' OR name LIKE '%MIUSOU%' OR name LIKE '%少女%');
UPDATE gift_codes SET brand = '其他' WHERE brand IS NULL;

-- 记事本编码同步（仅新增，merchant_code 已存在的自动跳过；27 行去重后 23 个，其中 15 个已有）
INSERT INTO gift_codes (name, merchant_code, brand, sort_order)
SELECT
  CASE
    WHEN s.code LIKE '弥生%' THEN substring(s.code from 3)
    WHEN s.code LIKE '极氧%' THEN substring(s.code from 3)
    ELSE s.code
  END,
  s.code,
  s.brand,
  (SELECT COALESCE(MAX(sort_order),0) FROM gift_codes) + row_number() OVER (ORDER BY s.ord)
FROM (VALUES
  ('极氧蓬松发圈', '极氧', 1),
  ('极氧铃兰丝巾', '极氧', 2),
  ('大美手机支架', '其他', 3),
  ('极氧铃兰化妆包-粉色', '极氧', 4),
  ('弥生初音未来镭射票', '弥生', 5),
  ('弥生初音未来徽章', '弥生', 6),
  ('弥生初音未来手持镜', '弥生', 7),
  ('弥生初音未来立牌', '弥生', 8),
  ('弥生初音未来六联盒', '弥生', 9),
  ('弥生初音未来护理液60ml', '弥生', 10),
  ('弥生初音未来泡面徽章（大尺寸）', '弥生', 11),
  ('弥生初音未来盲盒徽章组合装', '弥生', 12),
  ('弥生初音未来盲盒徽章', '弥生', 13),
  ('极氧铃兰化妆包-绿色', '极氧', 14),
  ('极氧小手提袋', '极氧', 15),
  ('极氧硅水凝胶探索手札', '极氧', 16),
  ('YOUHOO化妆镜', '其他', 17)
) AS s(code, brand, ord)
WHERE NOT EXISTS (SELECT 1 FROM gift_codes g WHERE g.merchant_code = s.code);

-- 复核
SELECT brand, count(*) FROM gift_codes GROUP BY brand ORDER BY brand;
