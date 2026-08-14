-- ============================================
-- 连带成交：允许客服删除【本人名下】记录
-- ============================================
-- 问题现象：普通客服点删除，前端弹“已删除”，但刷新后记录还在。
-- 根因：cross_sales 的删除权限只放给 admin/leader
--   （策略「管理员可管理连带成交数据」FOR ALL），
--   普通客服 INSERT 可以，DELETE 被 RLS 静默拦截（影响 0 行、不报错），
--   于是库里没真删，刷新又出现。
--
-- 修复：新增一条“客服可删除本人连带成交记录”DELETE 策略，
--   允许 staff_name 与本人 profiles.name / real_name 一致的记录被删除，
--   与前端“只能删自己”的按钮判定完全一致（界面本来就只在
--   r.staff_name === 本人姓名 时才显示删除按钮）。
--   admin/leader 仍走原 FOR ALL 策略，可删全部。
--
-- 用法：在 Supabase Dashboard → SQL Editor 粘贴全部执行
-- ============================================

DROP POLICY IF EXISTS "客服可删除本人连带成交记录" ON cross_sales;
CREATE POLICY "客服可删除本人连带成交记录" ON cross_sales
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (cross_sales.staff_name = p.name OR cross_sales.staff_name = p.real_name)
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

-- 说明：两条策略均为 PERMISSIVE，Postgres RLS 按“任一满足即放行”合并；
--   admin/leader 仍可被原 FOR ALL 策略覆盖，互不影响。
-- 执行后无需改任何前端代码，客服刷新页面即可删除自己名下的记录。
