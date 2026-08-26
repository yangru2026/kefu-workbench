-- ============================================================
-- 培训资料 - 两级分类结构迁移（大类 → 小类）
-- 用途：培训资料从「一级分类」升级为「大类 + 小类」两级结构
--       大类：品牌背景和定位 / 基础知识 / ERP操作 / 店铺产品
--       小类：如 弥生、极氧、美瞳抛型、查询订单、抖音1店 等
-- 权限：RLS 保持全通（管理操作由前端按钮控制），幂等重建
-- 使用：直接在 Supabase SQL Editor 执行（可重复执行）
-- 注意：会清空旧分类；当前培训资料为 0 篇，无关联残留
-- ============================================================

-- 1. training_categories 增加 parent_id 字段（小类存父级大类名，大类为空）
ALTER TABLE public.training_categories ADD COLUMN IF NOT EXISTS parent_id TEXT;

-- 2. training_materials 增加 group_name 字段（资料所属大类，用于按大类筛选/分组）
ALTER TABLE public.training_materials ADD COLUMN IF NOT EXISTS group_name TEXT;

-- 3. 清空旧分类（当前无资料依赖；若已有资料请先调整其 category 字段）
DELETE FROM public.training_categories;

-- 4. 插入大类（parent_id 为空，sort_order 按 100 递增）
INSERT INTO public.training_categories (name, sort_order, parent_id) VALUES
('品牌背景和定位', 100, ''),
('基础知识',       200, ''),
('ERP操作',        300, ''),
('店铺产品',       400, '');

-- 5. 插入小类（parent_id 存大类名，sort_order = 大类段 + 10 递增）
INSERT INTO public.training_categories (name, sort_order, parent_id) VALUES
-- 品牌背景和定位
('弥生', 110, '品牌背景和定位'),
('极氧', 120, '品牌背景和定位'),
-- 基础知识
('美瞳抛型',       210, '基础知识'),
('材质',           220, '基础知识'),
('直径·基弧·透氧',  230, '基础知识'),
('含水·度数换算',   240, '基础知识'),
-- ERP操作
('查询订单', 310, 'ERP操作'),
('驳回审核', 320, 'ERP操作'),
('查询库存', 330, 'ERP操作'),
-- 店铺产品（先建重点店，后续可在页面「＋ 新增小类」随时补充）
('抖音1店',   410, '店铺产品'),
('抖音2店',   420, '店铺产品'),
('拼多多1店', 430, '店铺产品'),
('拼多多2店', 440, '店铺产品'),
('天猫旗舰店', 450, '店铺产品');

-- 6. RLS 策略幂等重建（全员可读，已登录可写，前端控制管理按钮）
ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on training_categories" ON public.training_categories;
CREATE POLICY "Allow public read on training_categories" ON public.training_categories
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated write on training_categories" ON public.training_categories;
CREATE POLICY "Allow authenticated write on training_categories" ON public.training_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.training_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on training_materials" ON public.training_materials;
CREATE POLICY "Allow public read on training_materials" ON public.training_materials
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated write on training_materials" ON public.training_materials;
CREATE POLICY "Allow authenticated write on training_materials" ON public.training_materials
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 提示：SQL 执行成功后，刷新工作台培训页即可看到「大类 Tab + 小类 Tab」两级结构。
