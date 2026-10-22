-- 只有管理员可以修改成员身份（role），普通客服连自己的 role 都改不了
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is null then
      return new;  -- service_role / 后台任务放行（RLS 已挡住无 JWT 的匿名请求）
    end if;
    if not coalesce(public.is_admin(), false) then
      raise exception '只有管理员可以修改成员身份';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
before update on public.profiles
for each row execute function public.guard_profile_role_change();
