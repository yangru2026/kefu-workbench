-- ============================================================
-- 彻底删除客服（管理员专用，SECURITY DEFINER）
-- 用途：客服信息页「🗑 删除」按钮 → admin_delete_staff(p_id)
-- 行为：
--   1. 仅 is_admin() 可调用
--   2. 断开两类"不可级联"的外键引用（换班对方 / 协作者邀请人）
--   3. 删 profiles（日报/加班/调休/排名等带 CASCADE 的引用一并删除）
--   4. 删 auth.users 登录账号（防止幽灵账号还能登录；失败不阻断）
-- 幂等可重复执行；返回被删人姓名
-- ============================================================

create or replace function public.admin_delete_staff(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.is_admin() then
    raise exception '仅管理员可删除客服';
  end if;

  select name into v_name from public.profiles where id = p_id;
  if v_name is null then
    raise exception '该客服不存在或已删除';
  end if;

  -- 这两类外键是 NO ACTION，先断开再删
  update public.cs_requests set swap_partner_id = null where swap_partner_id = p_id;
  update public.page_collaborators set invited_by = null where invited_by = p_id;

  -- 日报/加班/调休/排名/协作者等带 CASCADE 的引用自动删除；公告/售前数据 created_by 置空
  delete from public.profiles where id = p_id;

  -- 登录账号也删掉（auth.users；个别环境下权限不足则跳过，档案已删不影响使用）
  begin
    delete from auth.users where id = p_id;
  exception when others then
    null;
  end;

  return v_name;
end;
$$;

revoke all on function public.admin_delete_staff(uuid) from anon;
grant execute on function public.admin_delete_staff(uuid) to authenticated;

-- 验证
select proname, prosecdef from pg_proc where proname = 'admin_delete_staff';
