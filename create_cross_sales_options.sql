-- ============================================
-- 连带成交 · 选项模板 + 组别字段
-- ============================================
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本（可重复执行）
--
-- 作用：
--   1. option_templates 表：管理员统一管理「店铺/产品类型/第一单状态」下拉选项
--      客服登记页动态加载，管理员增删改后 Realtime 实时同步
--      每个选项支持自定义颜色，方便客服快速识别
--   2. cross_sales 表增加 team（组别）字段，支持 A/B/C 组分组统计和排名
-- ============================================

-- ---------- 1. 选项模板表 ----------
CREATE TABLE IF NOT EXISTS option_templates (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,          -- 模板标识：shop / product_type / order_status
  label TEXT NOT NULL,               -- 显示名称：店铺 / 产品类型 / 第一单状态
  options JSONB DEFAULT '[]'::jsonb, -- 选项列表：[{"value":"旗舰店","color":"#ff6b6b"},...]
  sort_order INT DEFAULT 0,          -- 排序
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 初始化默认选项（已存在则不覆盖）
INSERT INTO option_templates (key, label, options, sort_order) VALUES
('shop', '店铺', '[
  {"value":"淘宝官方旗舰店","color":"#ff6b6b"},
  {"value":"京东旗舰店","color":"#4ecdc4"},
  {"value":"拼多多旗舰店","color":"#e67e22"},
  {"value":"抖音直播间","color":"#1a1a2e"},
  {"value":"小红书店铺","color":"#ff8b94"}
]'::jsonb, 1),
('product_type', '产品类型', '[
  {"value":"日抛美瞳","color":"#3498db"},
  {"value":"月抛美瞳","color":"#9b59b6"},
  {"value":"半年抛美瞳","color":"#2ecc71"},
  {"value":"年抛美瞳","color":"#f1c40f"},
  {"value":"季抛美瞳","color":"#16a085"},
  {"value":"护理液","color":"#1abc9c"},
  {"value":"眼镜盒","color":"#95a5a6"},
  {"value":"其他","color":"#bdc3c7"}
]'::jsonb, 2),
('order_status', '第一单状态', '[
  {"value":"已成交","color":"#27ae60"},
  {"value":"已发货","color":"#2980b9"},
  {"value":"待发货","color":"#f39c12"},
  {"value":"已退款","color":"#7f8c8d"}
]'::jsonb, 3)
ON CONFLICT (key) DO NOTHING;

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

-- ---------- 2. cross_sales 表增加 team 字段 ----------
ALTER TABLE cross_sales
ADD COLUMN IF NOT EXISTS team TEXT DEFAULT 'A组';

CREATE INDEX IF NOT EXISTS idx_cross_sales_team ON cross_sales(team);

-- 更新已有数据：根据 staff_name 反查 profiles 表的 group_name
UPDATE cross_sales cs
SET team = COALESCE(p.group_name, 'A组')
FROM profiles p
WHERE cs.staff_name = p.name
   OR cs.staff_name = p.real_name;

-- 未匹配到的保持默认值
UPDATE cross_sales
SET team = 'A组'
WHERE team IS NULL OR team = '';
