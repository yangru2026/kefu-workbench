-- ============================================================
-- 周报功能：周报模板表 + 周报表
-- ============================================================

-- 周报模板表：按 A/B/C 组分别配置成员、店铺、通用指标、店铺默认目标
-- config 结构：
-- {
--   "members": ["成员1","成员2"],                       -- 可编辑
--   "shops":   ["店铺A","店铺B"],                         -- 可编辑，改动会自动同步到指标列
--   "common":  [{"key":"...","label":"...","unit":"...","target":数字}],  -- 通用指标
--   "shopTargetDefault": 50,                             -- 店铺转化率默认目标
--   "shopTargets": {"店铺A":55,"店铺B":60}               -- 每个店铺单独目标（按店铺名保存）
-- }
CREATE TABLE IF NOT EXISTS weekly_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE weekly_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_templates_select_all" ON weekly_templates;
CREATE POLICY "weekly_templates_select_all"
  ON weekly_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "weekly_templates_write_admin" ON weekly_templates;
CREATE POLICY "weekly_templates_write_admin"
  ON weekly_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','leader')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','leader')));

-- 周报表：存储每周汇报内容（成员 × 指标 的填写值）
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  group_name TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_reports_select_own" ON weekly_reports;
CREATE POLICY "weekly_reports_select_own"
  ON weekly_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','leader')));

DROP POLICY IF EXISTS "weekly_reports_write_own" ON weekly_reports;
CREATE POLICY "weekly_reports_write_own"
  ON weekly_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "weekly_reports_update_own" ON weekly_reports;
CREATE POLICY "weekly_reports_update_own"
  ON weekly_reports FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 默认模板数据（如已在后台修改过，ON CONFLICT 不会覆盖）
INSERT INTO weekly_templates (group_name, config) VALUES
('A组', '{
  "members": ["马雷旭","小暖"],
  "shops": ["快手弥生","天猫弥生","天猫YH"],
  "common": [
    {"key":"linked_sales","label":"连带销售额","unit":"元","target":8000},
    {"key":"overall_conversion","label":"全平台转化率","unit":"%","target":50},
    {"key":"satisfaction","label":"满意度-售前全平台满意度","unit":"%","target":98},
    {"key":"response_3min","label":"三分钟回复率","unit":"%","target":100}
  ],
  "shopTargetDefault": 50,
  "shopTargets": {"快手弥生":35,"天猫弥生":55,"天猫YH":58}
}'),
('B组', '{
  "members": ["李烁南","小态","小歪","小朗"],
  "shops": ["拼多多1店","拼多多2店","拼多多3店","拼多多4店","拼多多5店","拼多多6店"],
  "common": [
    {"key":"linked_sales","label":"连带销售额","unit":"元","target":8000},
    {"key":"overall_conversion","label":"全平台转化率","unit":"%","target":42},
    {"key":"avg_response","label":"平均响应","unit":"s","target":15}
  ],
  "shopTargetDefault": 42,
  "shopTargets": {}
}'),
('C组', '{
  "members": ["小七","小火","小熊","小茜","小猫"],
  "shops": ["抖音官方店","抖音电子"],
  "common": [
    {"key":"linked_sales","label":"连带销售额","unit":"元","target":8000},
    {"key":"overall_conversion","label":"全平台转化率","unit":"%","target":57},
    {"key":"satisfaction","label":"满意度-全平台","unit":"%","target":98},
    {"key":"avg_response","label":"平均响应-全平台","unit":"s","target":10}
  ],
  "shopTargetDefault": 57,
  "shopTargets": {"抖音官方店":55,"抖音电子":60}
}')
ON CONFLICT (group_name) DO NOTHING;
