-- ============================================
-- 连带成交 · 选项模板（按组隔离）+ 组别字段
-- ============================================
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本（可重复执行）
--
-- 作用：
--   1. option_templates 表支持按组（team）隔离选项：
--      A组/B组/C组 可拥有不同的「店铺/产品类型/第一单状态」选项
--   2. 每个选项支持自定义颜色，方便客服快速识别
--   3. cross_sales 表增加 team（组别）字段，支持分组统计和排名
-- ============================================

-- ---------- 1. 选项模板表（支持按组隔离） ----------
-- 先删除旧 UNIQUE 约束（key），改为复合唯一键（key, team）
ALTER TABLE option_templates
DROP CONSTRAINT IF EXISTS option_templates_key_key;

ALTER TABLE option_templates
ADD COLUMN IF NOT EXISTS team TEXT DEFAULT 'default';

-- 确保复合唯一键
ALTER TABLE option_templates
DROP CONSTRAINT IF EXISTS option_templates_key_team_key;

ALTER TABLE option_templates
ADD CONSTRAINT option_templates_key_team_key UNIQUE (key, team);

-- 如果没有 id 主键则加上（已有则跳过）
ALTER TABLE option_templates
ADD COLUMN IF NOT EXISTS id BIGSERIAL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'option_templates_pkey'
  ) THEN
    ALTER TABLE option_templates ADD PRIMARY KEY (id);
  END IF;
END
$$;

-- RLS：所有人可查看，仅 admin/leader 可管理
ALTER TABLE option_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "所有人可查看选项模板" ON option_templates;
CREATE POLICY "所有人可查看选项模板" ON option_templates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "管理员可管理选项模板" ON option_templates;
CREATE POLICY "管理员可管理选项模板" ON option_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','leader'))
  );

-- Realtime（安全写法：已存在则跳过）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'option_templates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE option_templates;
  END IF;
END
$$;

-- 兼容旧数据：把原有 key 记录的 team 补成 'default'
UPDATE option_templates SET team = 'default' WHERE team IS NULL OR team = '';

-- 兼容旧数据：如果已存在字符串数组，自动升级为带颜色的对象数组
UPDATE option_templates
SET options = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(elem) = 'string' THEN jsonb_build_object('value', elem, 'color', '')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(options) AS elem
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(options) AS e
  WHERE jsonb_typeof(e) = 'string'
);

-- 初始化各组默认选项（已存在则不覆盖）
-- 通用 default 组保留原有默认，A/B/C 组默认与 default 相同，方便管理员后续按组调整
INSERT INTO option_templates (key, label, team, options, sort_order) VALUES
('shop', '店铺', 'default', '[
  {"value":"淘宝官方旗舰店","color":"#ff6b6b"},
  {"value":"京东旗舰店","color":"#4ecdc4"},
  {"value":"拼多多旗舰店","color":"#e67e22"},
  {"value":"抖音直播间","color":"#1a1a2e"},
  {"value":"小红书店铺","color":"#ff8b94"}
]'::jsonb, 1),
('product_type', '产品类型', 'default', '[
  {"value":"日抛美瞳","color":"#3498db"},
  {"value":"月抛美瞳","color":"#9b59b6"},
  {"value":"半年抛美瞳","color":"#2ecc71"},
  {"value":"年抛美瞳","color":"#f1c40f"},
  {"value":"季抛美瞳","color":"#16a085"},
  {"value":"护理液","color":"#1abc9c"},
  {"value":"眼镜盒","color":"#95a5a6"},
  {"value":"其他","color":"#bdc3c7"}
]'::jsonb, 2),
('order_status', '第一单状态', 'default', '[
  {"value":"已成交","color":"#27ae60"},
  {"value":"已发货","color":"#2980b9"},
  {"value":"待发货","color":"#f39c12"},
  {"value":"已退款","color":"#7f8c8d"}
]'::jsonb, 3),
('shop', '店铺', 'A组', '[
  {"value":"淘宝官方旗舰店","color":"#ff6b6b"},
  {"value":"京东旗舰店","color":"#4ecdc4"},
  {"value":"拼多多旗舰店","color":"#e67e22"},
  {"value":"抖音直播间","color":"#1a1a2e"},
  {"value":"小红书店铺","color":"#ff8b94"}
]'::jsonb, 1),
('product_type', '产品类型', 'A组', '[
  {"value":"日抛美瞳","color":"#3498db"},
  {"value":"月抛美瞳","color":"#9b59b6"},
  {"value":"半年抛美瞳","color":"#2ecc71"},
  {"value":"年抛美瞳","color":"#f1c40f"},
  {"value":"季抛美瞳","color":"#16a085"},
  {"value":"护理液","color":"#1abc9c"},
  {"value":"眼镜盒","color":"#95a5a6"},
  {"value":"其他","color":"#bdc3c7"}
]'::jsonb, 2),
('order_status', '第一单状态', 'A组', '[
  {"value":"已成交","color":"#27ae60"},
  {"value":"已发货","color":"#2980b9"},
  {"value":"待发货","color":"#f39c12"},
  {"value":"已退款","color":"#7f8c8d"}
]'::jsonb, 3),
('shop', '店铺', 'B组', '[
  {"value":"淘宝官方旗舰店","color":"#ff6b6b"},
  {"value":"京东旗舰店","color":"#4ecdc4"},
  {"value":"拼多多旗舰店","color":"#e67e22"},
  {"value":"抖音直播间","color":"#1a1a2e"},
  {"value":"小红书店铺","color":"#ff8b94"}
]'::jsonb, 1),
('product_type', '产品类型', 'B组', '[
  {"value":"日抛美瞳","color":"#3498db"},
  {"value":"月抛美瞳","color":"#9b59b6"},
  {"value":"半年抛美瞳","color":"#2ecc71"},
  {"value":"年抛美瞳","color":"#f1c40f"},
  {"value":"季抛美瞳","color":"#16a085"},
  {"value":"护理液","color":"#1abc9c"},
  {"value":"眼镜盒","color":"#95a5a6"},
  {"value":"其他","color":"#bdc3c7"}
]'::jsonb, 2),
('order_status', '第一单状态', 'B组', '[
  {"value":"已成交","color":"#27ae60"},
  {"value":"已发货","color":"#2980b9"},
  {"value":"待发货","color":"#f39c12"},
  {"value":"已退款","color":"#7f8c8d"}
]'::jsonb, 3),
('shop', '店铺', 'C组', '[
  {"value":"淘宝官方旗舰店","color":"#ff6b6b"},
  {"value":"京东旗舰店","color":"#4ecdc4"},
  {"value":"拼多多旗舰店","color":"#e67e22"},
  {"value":"抖音直播间","color":"#1a1a2e"},
  {"value":"小红书店铺","color":"#ff8b94"}
]'::jsonb, 1),
('product_type', '产品类型', 'C组', '[
  {"value":"日抛美瞳","color":"#3498db"},
  {"value":"月抛美瞳","color":"#9b59b6"},
  {"value":"半年抛美瞳","color":"#2ecc71"},
  {"value":"年抛美瞳","color":"#f1c40f"},
  {"value":"季抛美瞳","color":"#16a085"},
  {"value":"护理液","color":"#1abc9c"},
  {"value":"眼镜盒","color":"#95a5a6"},
  {"value":"其他","color":"#bdc3c7"}
]'::jsonb, 2),
('order_status', '第一单状态', 'C组', '[
  {"value":"已成交","color":"#27ae60"},
  {"value":"已发货","color":"#2980b9"},
  {"value":"待发货","color":"#f39c12"},
  {"value":"已退款","color":"#7f8c8d"}
]'::jsonb, 3)
ON CONFLICT (key, team) DO NOTHING;

-- ---------- 2. cross_sales 表增加 team 字段 ----------
ALTER TABLE cross_sales
ADD COLUMN IF NOT EXISTS team TEXT DEFAULT 'A组';

CREATE INDEX IF NOT EXISTS idx_cross_sales_team ON cross_sales(team);

-- 更新已有数据：根据 staff_name 反查 profiles 表的 group_name
UPDATE cross_sales cs
SET team = COALESCE(p.group_name, 'A组')
FROM profiles p
WHERE (cs.staff_name = p.name OR cs.staff_name = p.real_name)
  AND (cs.team IS NULL OR cs.team = '' OR cs.team = 'A组');

-- 未匹配到的保持默认值
UPDATE cross_sales
SET team = 'A组'
WHERE team IS NULL OR team = '';
