-- ============================================================
-- 修复：管理员在工作台改「客服组别 / 角色」保存不上（改完自动变回原值）
-- 项目：ienmejlxukhrxjjxvfqf
-- 运行：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
-- 本脚本可重复执行（幂等）。
--
-- 【根因】
--   2026-09-01 的 add_member_invite_rls.sql 建了策略
--     「管理员可修改任意成员」 FOR UPDATE USING (auth.uid() = id OR EXISTS(...role='admin'))
--   但该策略的 USING 里直接 SELECT FROM profiles，导致查询 profiles 时
--   「infinite recursion (42P17)」，所有人（含管理员）都连 profiles 都读不出来。
--   当天的 fix_profiles_rls_recursion.sql 紧急救火时，做的却是：
--     DROP POLICY "管理员可查看所有成员"   ← 删掉的是【多余的那条】，不是递归源
--     DROP POLICY "管理员可修改任意成员"   ← 把【真正需要的这条】删了
--   于是 profiles 上只剩原始迁移留下的：
--     SELECT  USING (true)
--     UPDATE  USING (auth.uid() = id)      ← 只能改自己
--     INSERT  WITH CHECK (auth.uid() = id)
--   → 管理员改别人的 group_name / role：PostgreSQL「0 行被更新且不报错」，
--     前端又没带 .select()，于是假报「已更新」，刷新后变回原值。
--
-- 【本脚本做两件事】
--   1) 恢复 is_admin() 函数（幂等重建）
--   2) 恢复「管理员可修改任意成员」UPDATE 策略，用 is_admin() 判断，零递归
--   ⚠️ 注意：以下 SQL **故意不重建**「管理员可查看所有成员」SELECT 策略
--      —— 它就是当初的递归源，且 SELECT USING (true) 已允许全员可读，无需它。
-- ============================================================

-- ---------- 1) is_admin()：SECURITY DEFINER，内部查 profiles 不触发 RLS ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ---------- 2) 恢复「管理员可修改任意成员」（零递归）----------
DROP POLICY IF EXISTS "管理员可修改任意成员" ON public.profiles;
CREATE POLICY "管理员可修改任意成员" ON public.profiles
  FOR UPDATE
  USING ( auth.uid() = id OR public.is_admin() )
  WITH CHECK ( auth.uid() = id OR public.is_admin() );

-- ---------- 3) 顺手把「清退 / 恢复」也纳入（同样是改别人的行，走同一条策略即可）----------
--   status / left_at 的更新已被上面的 UPDATE 策略覆盖，无需额外策略。

-- ---------- 4) 确保 RLS 处于开启状态（幂等）----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 自检：列出 profiles 当前全部策略，应能看到
--   允许查看所有用户资料 / 允许更新自己的资料 / 允许注册时创建资料 / 管理员可修改任意成员
--   且【不应】看到「管理员可查看所有成员」（那是递归源，已被清除）
-- ============================================================
SELECT policyname AS "策略名", cmd AS "操作", qual AS "USING"
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY cmd, policyname;

SELECT '✅ profiles 管理员改他人策略已恢复，请回工作台重新改组别验证' AS result;
