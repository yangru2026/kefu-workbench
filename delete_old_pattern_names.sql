-- ============================================================
-- 清理花色改名产生的旧记录：飞书把这批花色改名为「D xx 6片装」，
-- 同步按（花色名+品牌）匹配不到旧名，新增了新行，旧行残留。
-- 只删不带 D 的 4 条旧记录，新的「D xx 6片装」全部保留。
-- 在 Supabase SQL Editor 执行一次即可。
-- ============================================================

delete from public.pattern_assets
where brand = '弥生'
  and name in ('滴落海', '珊珊来信', '松果沙滩', '银河引力');

-- 验证：应只剩 4 条带 D 的新记录
select name, fixed_axis, is_discontinued
from public.pattern_assets
where name ilike '%滴落海%' or name ilike '%珊珊%' or name ilike '%松果%' or name ilike '%银河%';
