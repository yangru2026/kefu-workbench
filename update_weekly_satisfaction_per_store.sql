-- ============================================================
-- 迁移：把周报模板的「满意度」从单指标改为「分店好评/差评 + 系统自动合计」
-- 运行前请确认：此迁移会覆盖 A/B/C 三组的 config 为最新默认结构。
-- 如你已在模板里做了其他自定义修改，请先在 Supabase 备份 weekly_templates 表。
-- ============================================================

UPDATE weekly_templates
SET config = '{
  "metrics": [
    {"key":"linked_sales","label":"连带销售额","unit":"元","target":8000,"type":"linked_sales","sort_order":0},
    {"key":"overall_conversion","label":"全平台转化率","unit":"%","target":50,"type":"overall_conversion","sort_order":1},
    {"key":"conv_douyidian","label":"转化率-抖一店","unit":"%","target":50,"type":"conversion","shop":"抖一店","sort_order":2},
    {"key":"conv_tmallms","label":"转化率-天猫弥生","unit":"%","target":50,"type":"conversion","shop":"天猫弥生","sort_order":3},
    {"key":"conv_tmalljy","label":"转化率-天猫极氧","unit":"%","target":50,"type":"conversion","shop":"天猫极氧","sort_order":4},
    {"key":"conv_ksms","label":"转化率-快手弥生","unit":"%","target":50,"type":"conversion","shop":"快手弥生","sort_order":5},
    {"key":"sat_douyidian","label":"满意度-抖一店","unit":"个","target":0,"type":"satisfaction","shop":"抖一店","sort_order":6},
    {"key":"sat_tmallms","label":"满意度-天猫弥生","unit":"个","target":0,"type":"satisfaction","shop":"天猫弥生","sort_order":7},
    {"key":"sat_tmalljy","label":"满意度-天猫极氧","unit":"个","target":0,"type":"satisfaction","shop":"天猫极氧","sort_order":8},
    {"key":"sat_ksms","label":"满意度-快手弥生","unit":"个","target":0,"type":"satisfaction","shop":"快手弥生","sort_order":9},
    {"key":"satisfaction_total","label":"满意度-售前全平台满意度","unit":"%","target":98,"type":"satisfaction","sort_order":10},
    {"key":"response_3min","label":"三分钟回复率","unit":"%","target":100,"type":"reply_rate","sort_order":11}
  ]
}'::jsonb
WHERE group_name = 'A组';

UPDATE weekly_templates
SET config = '{
  "metrics": [
    {"key":"conv_pdd1","label":"转化率-拼多多1店","unit":"%","target":42,"type":"conversion","shop":"拼多多1店","sort_order":0},
    {"key":"conv_pdd2","label":"转化率-拼多多2店","unit":"%","target":42,"type":"conversion","shop":"拼多多2店","sort_order":1},
    {"key":"conv_pdd3","label":"转化率-拼多多3店","unit":"%","target":42,"type":"conversion","shop":"拼多多3店","sort_order":2},
    {"key":"conv_pdd4","label":"转化率-拼多多4店","unit":"%","target":42,"type":"conversion","shop":"拼多多4店","sort_order":3},
    {"key":"conv_pdd5","label":"转化率-拼多多5店","unit":"%","target":42,"type":"conversion","shop":"拼多多5店","sort_order":4},
    {"key":"conv_dousan","label":"转化率-抖三店","unit":"%","target":42,"type":"conversion","shop":"抖三店","sort_order":5},
    {"key":"sat_dousan","label":"满意度-抖三店","unit":"个","target":0,"type":"satisfaction","shop":"抖三店","sort_order":6},
    {"key":"satisfaction_total","label":"满意度","unit":"%","target":98,"type":"satisfaction","sort_order":7},
    {"key":"overall_conversion","label":"全平台转化率","unit":"%","target":42,"type":"overall_conversion","sort_order":8},
    {"key":"avg_response","label":"响应（各店平均）","unit":"s","target":15,"type":"avg_response","sort_order":9}
  ]
}'::jsonb
WHERE group_name = 'B组';

UPDATE weekly_templates
SET config = '{
  "metrics": [
    {"key":"conv_douer","label":"转化率-抖二店","unit":"%","target":57,"type":"conversion","shop":"抖二店","sort_order":0},
    {"key":"conv_dousi","label":"转化率-抖四店","unit":"%","target":57,"type":"conversion","shop":"抖四店","sort_order":1},
    {"key":"overall_conversion","label":"全平台转化率","unit":"%","target":57,"type":"overall_conversion","sort_order":2},
    {"key":"sat_douer","label":"满意度-抖二店","unit":"个","target":0,"type":"satisfaction","shop":"抖二店","sort_order":3},
    {"key":"sat_dousi","label":"满意度-抖四店","unit":"个","target":0,"type":"satisfaction","shop":"抖四店","sort_order":4},
    {"key":"satisfaction_total","label":"满意度","unit":"%","target":98,"type":"satisfaction","sort_order":5},
    {"key":"avg_response","label":"响应（各店平均）","unit":"s","target":10,"type":"avg_response","sort_order":6}
  ]
}'::jsonb
WHERE group_name = 'C组';
