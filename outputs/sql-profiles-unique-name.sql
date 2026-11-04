-- 在职客服花名唯一（已清退的不占名额，允许新人复用花名）
create unique index if not exists profiles_active_name_uk
  on public.profiles (lower(btrim(name)))
  where status = 'active';

select indexname, indexdef from pg_indexes where tablename = 'profiles' and indexname = 'profiles_active_name_uk';
