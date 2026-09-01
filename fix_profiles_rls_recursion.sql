-- ============================================================
-- 紧急修复：profiles 表 RLS 无限递归（PostgreSQL 错误码 42P17）
-- 项目：ienmejlxukhrxjjxvfqf
-- 运行：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
-- 现象：登录后界面仍显示「未登录」，profiles 查询返回
--        {"code":"42P17","message":"infinite recursion detected in policy
--        for relation \"profiles\""}
-- 根因：add_member_invite_rls.sql 中两条 profiles policy 的 USING 子句
--       里写了 EXISTS(SELECT 1 FROM profiles ...)，引用了 profiles 表自身。
--       查询 profiles 时要评估这条 policy，而 policy 里又查 profiles，
--       再次触发本 policy → 死循环。
-- 本脚本可重复执行（幂等）。
-- ============================================================

-- 1) 删除致命的递归 SELECT policy
--    它本就是多余的：基础策略「允许查看所有用户资料」(SELECT USING true)
--    已经允许所有人查询 profiles，无需再补一条会递归的 SELECT policy。
DROP POLICY IF EXISTS "管理员可查看所有成员" ON public.profiles;

-- 2) 用 SECURITY DEFINER 函数判断管理员
--    函数以数据库 owner 身份执行，不受表级 RLS 约束，因此内部查 profiles 不会递归。
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 3) 重建「管理员可修改任意成员」UPDATE policy，改用 is_admin() 判断
--    不再在 policy 里直接 SELECT FROM profiles，彻底消除递归。
DROP POLICY IF EXISTS "管理员可修改任意成员" ON public.profiles;
CREATE POLICY "管理员可修改任意成员" ON public.profiles
  FOR UPDATE
  USING ( auth.uid() = id OR public.is_admin() )
  WITH CHECK ( auth.uid() = id OR public.is_admin() );

-- 4) 把 pending_invites 的管理 policy 也改用 is_admin()，保持一致、零递归风险
DROP POLICY IF EXISTS "管理员可管理邀请" ON public.pending_invites;
CREATE POLICY "管理员可管理邀请" ON public.pending_invites
  FOR ALL
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- ============================================================
-- 完成提示
-- ============================================================
SELECT '✅ profiles RLS 递归已修复，可重新登录' AS result;
