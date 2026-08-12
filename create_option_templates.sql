-- ============================================
-- 选项模板表
-- ============================================
-- 用途：
--   1. 管理者统一管理店铺/产品类型/第一单状态等下拉选项
--   2. 客服前端实时同步，无需刷新页面
-- ============================================

CREATE TABLE IF NOT EXISTS option_templates (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,          -- 模板标识：shop / product_type / order_status
  label TEXT NOT NULL,               -- 显示名称：店铺 / 产品类型 / 第一单状态
  options JSONB DEFAULT '[]'::jsonb, -- 选项列表：["旗舰店","京东店",...]
  sort_order INT DEFAULT 0,          -- 排序
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE option_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "所有人可查看选项模板" ON option_templates;
CREATE POLICY "所有人可查看选项模板" ON option_templates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "管理员可管理选项模板" ON option_templates;
CREATE POLICY "管理员可管理选项模板" ON option_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','leader'))
  );

-- Realtime
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

-- 初始化默认选项
INSERT INTO option_templates (key, label, options, sort_order) VALUES
('shop', '店铺', '["旗舰店","京东店","拼多多店","抖音店","小红书店"]', 1),
('product_type', '产品类型', '["日抛美瞳","月抛美瞳","年抛美瞳","半年抛美瞳","季抛美瞳","护理液","眼镜盒","其他"]', 2),
('order_status', '第一单状态', '["已发货","待发货","已成交","已退款"]', 3)
ON CONFLICT (key) DO NOTHING;
