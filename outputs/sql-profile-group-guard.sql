-- ============================================================
-- profiles.group_name 防清空保险丝 + 审计（2026-11-02）
-- 背景：小柚的组别多次被清空（改回后过几天又空），无法定位是哪个入口干的。
-- 方案：BEFORE UPDATE 触发器 —— 组别从「有组」被改成 NULL 时：
--       ① 自动保持原值（置空一律拦截，真要清退用 status 字段，不该清组别）
--       ② 写一条审计记录（谁、什么时候、想清谁的），茹姐可随时查
-- 幂等可重复执行。执行环境：youhe-workbench（icfgireprowcqwdodfqx）SQL Editor
-- ============================================================

-- 1) 审计表
CREATE TABLE IF NOT EXISTS public.profile_group_audit (
  id           bigint generated always as identity primary key,
  profile_id   uuid,
  profile_name text,
  old_group    text,
  new_group    text,
  changed_by   uuid,
  changed_by_name text,
  at           timestamptz default now()
);

ALTER TABLE public.profile_group_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pga_read_admin" ON public.profile_group_audit;
CREATE POLICY "pga_read_admin" ON public.profile_group_audit
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 2) 守卫函数
CREATE OR REPLACE FUNCTION public.profile_group_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_actor text;
BEGIN
  IF NEW.group_name IS NULL AND OLD.group_name IS NOT NULL THEN
    SELECT name INTO v_name FROM public.profiles WHERE id = OLD.id;
    SELECT coalesce(name, '未知用户(' || auth.uid() || ')') INTO v_actor
      FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.profile_group_audit
      (profile_id, profile_name, old_group, new_group, changed_by, changed_by_name)
    VALUES (OLD.id, v_name, OLD.group_name, NULL, auth.uid(), v_actor);
    -- 保住原值：不许清空
    NEW.group_name := OLD.group_name;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) 挂触发器
DROP TRIGGER IF EXISTS trg_profile_group_guard ON public.profiles;
CREATE TRIGGER trg_profile_group_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profile_group_guard();

-- 4) 校验：返回触发器即生效；再改小柚组别为 NULL 试一下应被拦（模拟验证可选）
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
