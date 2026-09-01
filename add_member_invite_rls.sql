-- ============================================================
-- 成员邀请 & 离职清退 数据库迁移
-- 项目：ienmejlxukhrxjjxvfqf
-- 运行方式：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
-- 说明：本文件可重复执行（幂等），已加 IF NOT EXISTS / DROP POLICY IF EXISTS
-- ============================================================

-- ============================================================
-- 1) pending_invites 表：管理员生成「邀请新人」记录
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pending_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE,
  phone       text,
  name        text,
  group_name  text,
  role        text NOT NULL DEFAULT 'staff',   -- staff / leader / admin
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at     timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

-- 仅管理员（role='admin'）可读写邀请记录
DROP POLICY IF EXISTS "管理员可管理邀请" ON public.pending_invites;
CREATE POLICY "管理员可管理邀请" ON public.pending_invites
  FOR ALL
  USING ( EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') )
  WITH CHECK ( EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') );

-- ============================================================
-- 2) profiles 增加：status（账号状态）/ left_at（离职时间）
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',  -- active / disabled
  ADD COLUMN IF NOT EXISTS left_at timestamptz;

-- 允许管理员查看所有成员（成员管理页列表需要）
-- 注意：原迁移已存在「允许查看所有用户资料」(SELECT USING true) 策略，
-- 下面这条作为补充，确保 admin 即使将来收紧 SELECT 仍能读取全员。
DROP POLICY IF EXISTS "管理员可查看所有成员" ON public.profiles;
CREATE POLICY "管理员可查看所有成员" ON public.profiles
  FOR SELECT
  USING ( auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') );

-- 允许管理员修改任意成员（改角色 / 改组别 / 清退 / 恢复）
-- 与原有「允许更新自己的资料」(auth.uid()=id) 并存（RLS 取 OR）
DROP POLICY IF EXISTS "管理员可修改任意成员" ON public.profiles;
CREATE POLICY "管理员可修改任意成员" ON public.profiles
  FOR UPDATE
  USING ( auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') )
  WITH CHECK ( auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') );

-- ============================================================
-- 3) SECURITY DEFINER 函数：新人凭 token 读取邀请信息
--    避免把整张 pending_invites 暴露给前端（RLS 已限制仅 admin 可读）
--    新人注册页未登录时用 anon key 调用，仅需知道 token 即可取到自己那份邀请
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS TABLE (name text, group_name text, role text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pi.name, pi.group_name, pi.role
  FROM pending_invites pi
  WHERE pi.token = p_token
    AND pi.used_at IS NULL
    AND (pi.expires_at IS NULL OR pi.expires_at > now());
$$;

-- ============================================================
-- 4) SECURITY DEFINER 函数：标记邀请已使用（防重复领取）
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_invite(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE pending_invites
  SET used_at = now()
  WHERE token = p_token AND used_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_invite(text) TO anon, authenticated;

-- ============================================================
-- 完成提示
-- ============================================================
SELECT '✅ 成员邀请/清退迁移执行完成' AS result;
