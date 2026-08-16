-- ============================================================
-- 周报功能：周报模板表 + 周报表
-- ============================================================

-- 周报模板表：按 A/B/C 组分别配置指标列表
-- config 结构：
-- {
--   "metrics": [
--     {"key":"唯一键","label":"指标名（可含店铺名）","unit":"单位","target":数字,"type":"指标类型","shop":"店铺名(仅conversion/response填写)"}
--   ]
-- }
-- 指标 type 含义：
--   linked_sales      连带销售额，直接填总值（客服负责店铺合计），达标=值≥目标
--   overall_conversion 全平台转化率 = Σ各店付款 / Σ各店询单
--   conversion        单店转化率 = 该店付款/询单
--   satisfaction      满意度 = 好评/(好评+差评)*100
--   reply_rate        三分钟回复率 = 三分钟响应轮次/总会话轮次*100
--   response          单店平均响应 = 该店响应秒/轮次（越低越好）
--   avg_response      各店平均响应 = 所有店铺 响应秒/轮次 求平均（越低越好）
-- 成员不存模板，直接取自后台「成员管理」的组身份；店铺从 conversion/response 指标自动派生。
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

-- 周报表：存储每周汇报内容（原始录入数据，指标由系统计算）
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

-- 默认模板数据（ON CONFLICT 覆盖刷新，重跑可更新指标/目标）
INSERT INTO weekly_templates (group_name, config) VALUES
('A组', '{
  "metrics": [
    {"key":"linked_sales","label":"连带销售额","unit":"元","target":8000,"type":"linked_sales"},
    {"key":"overall_conversion","label":"全平台转化率","unit":"%","target":50,"type":"overall_conversion"},
    {"key":"conv_douyidian","label":"转化率-抖一店","unit":"%","target":50,"type":"conversion","shop":"抖一店"},
    {"key":"conv_tmallms","label":"转化率-天猫弥生","unit":"%","target":50,"type":"conversion","shop":"天猫弥生"},
    {"key":"conv_tmalljy","label":"转化率-天猫极氧","unit":"%","target":50,"type":"conversion","shop":"天猫极氧"},
    {"key":"conv_ksms","label":"转化率-快手弥生","unit":"%","target":50,"type":"conversion","shop":"快手弥生"},
    {"key":"satisfaction","label":"满意度-售前全平台满意度","unit":"%","target":98,"type":"satisfaction"},
    {"key":"response_3min","label":"三分钟回复率","unit":"%","target":100,"type":"reply_rate"}
  ]
}'),
('B组', '{
  "metrics": [
    {"key":"conv_pdd1","label":"转化率-拼多多1店","unit":"%","target":42,"type":"conversion","shop":"拼多多1店"},
    {"key":"conv_pdd2","label":"转化率-拼多多2店","unit":"%","target":42,"type":"conversion","shop":"拼多多2店"},
    {"key":"conv_pdd3","label":"转化率-拼多多3店","unit":"%","target":42,"type":"conversion","shop":"拼多多3店"},
    {"key":"conv_pdd4","label":"转化率-拼多多4店","unit":"%","target":42,"type":"conversion","shop":"拼多多4店"},
    {"key":"conv_pdd5","label":"转化率-拼多多5店","unit":"%","target":42,"type":"conversion","shop":"拼多多5店"},
    {"key":"conv_dousan","label":"转化率-抖三店","unit":"%","target":42,"type":"conversion","shop":"抖三店"},
    {"key":"overall_conversion","label":"全平台转化率","unit":"%","target":42,"type":"overall_conversion"},
    {"key":"avg_response","label":"响应（各店平均）","unit":"s","target":15,"type":"avg_response"}
  ]
}'),
('C组', '{
  "metrics": [
    {"key":"conv_douer","label":"转化率-抖二店","unit":"%","target":57,"type":"conversion","shop":"抖二店"},
    {"key":"conv_dousi","label":"转化率-抖四店","unit":"%","target":57,"type":"conversion","shop":"抖四店"},
    {"key":"overall_conversion","label":"全平台转化率","unit":"%","target":57,"type":"overall_conversion"},
    {"key":"satisfaction","label":"满意度","unit":"%","target":98,"type":"satisfaction"},
    {"key":"avg_response","label":"响应（各店平均）","unit":"s","target":10,"type":"avg_response"}
  ]
}')
ON CONFLICT (group_name) DO UPDATE SET config = EXCLUDED.config, updated_at = now();
