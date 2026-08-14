-- ============================================
-- 连带成交：允许客服修改本人名下的记录（UPDATE）
-- ============================================
-- 背景：
--   客服在连带成交明细页修改"店铺 / 产品类型 / 第一单状态"等下拉选项时，
--   前端调用 UPDATE，但现有 RLS 只允许 admin/leader 更新，
--   普通客服的 UPDATE 被静默拦截（影响 0 行、不报错），
--   导致"选完一会儿又变回请选择"。
--
-- 此脚本新增策略：普通客服可更新 staff_name 与本人姓名匹配的记录；
-- admin/leader 仍由已有策略管理全部记录。
--
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
-- ============================================

DROP POLICY IF EXISTS "客服可更新本人连带成交记录" ON cross_sales;

CREATE POLICY "客服可更新本人连带成交记录" ON cross_sales
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.name = cross_sales.staff_name OR p.real_name = cross_sales.staff_name)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.name = cross_sales.staff_name OR p.real_name = cross_sales.staff_name)
    )
  );

-- 说明：
--   "管理员可管理连带成交数据"（FOR ALL / admin+leader）继续生效，
--   与该策略互不冲突，管理员仍可更新任意记录。
