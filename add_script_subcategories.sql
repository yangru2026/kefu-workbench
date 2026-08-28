-- ============================================================
-- 售前话术「通用」分组：三级小类初始化
-- 用途：在 training_categories 中预设 12 个通用售前话术小类
--       parent_id = '售前话术-通用'，供页面三级 Tab 读取
-- 使用：在 Supabase SQL Editor 执行（可重复执行）
-- ============================================================

-- 确保「售前话术」大类存在
INSERT INTO public.training_categories (name, sort_order, parent_id)
SELECT '售前话术', 500, ''
WHERE NOT EXISTS (
  SELECT 1 FROM public.training_categories
  WHERE name = '售前话术' AND (parent_id IS NULL OR parent_id = '')
);

-- 插入 12 个通用小类（如已存在则跳过）
WITH v(name, sort_order, parent_id) AS (VALUES
  ('商品问题'::text, 10, '售前话术-通用'::text),
  ('活动优惠问题'::text, 20, '售前话术-通用'::text),
  ('订单操作问题'::text, 30, '售前话术-通用'::text),
  ('催单催付'::text, 40, '售前话术-通用'::text),
  ('发货快递'::text, 50, '售前话术-通用'::text),
  ('售后保障（售前咨询售后规则）'::text, 60, '售前话术-通用'::text),
  ('权限规则问题'::text, 70, '售前话术-通用'::text),
  ('比价竞品问题'::text, 80, '售前话术-通用'::text),
  ('使用风险禁忌咨询'::text, 90, '售前话术-通用'::text),
  ('客户情绪与聊天互动'::text, 100, '售前话术-通用'::text),
  ('售前前置投诉顾虑'::text, 110, '售前话术-通用'::text),
  ('商务合作咨询'::text, 120, '售前话术-通用'::text)
)
INSERT INTO public.training_categories (name, sort_order, parent_id)
SELECT name, sort_order, parent_id FROM v
WHERE NOT EXISTS (
  SELECT 1 FROM public.training_categories t
  WHERE t.name = v.name AND t.parent_id = v.parent_id
);
