-- ============================================
-- 连带成交：允许客服自行登记（INSERT）
-- ============================================
-- 背景：连带成交的历史数据一次性从飞书同步，
--       后续新增由客服直接在工作台登记。
-- 此脚本放开 INSERT 权限给所有登录用户，
-- 更新/删除仍仅限 admin/leader（由已有策略控制）。
--
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
-- ============================================

-- 所有登录用户可登记连带成交
DROP POLICY IF EXISTS "所有登录用户可登记连带成交" ON cross_sales;
CREATE POLICY "所有登录用户可登记连带成交" ON cross_sales
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 说明：UPDATE / DELETE 继续沿用已有策略
--   "管理员可管理连带成交数据"（admin/leader 可管理全部）
--   普通客服只能查看 + 新增，不能修改/删除他人记录
