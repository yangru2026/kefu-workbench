-- ============================================================
-- 「操作类」从售前话术子分类 → 提升为顶级大类
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- 作用：
--   1) training_scripts 中 category='售前话术' 且 subcategory='操作类' 的数据 → category='操作类'
--   2) training_categories 新增顶级分类「操作类」（parent_id 为空）
--   3) 删除旧的「操作类」子分类记录
-- ============================================================

-- 1) 脚本数据迁移：操作类话题整体提升为顶级大类
update public.training_scripts
set category = '操作类'
where category = '售前话术' and subcategory = '操作类';

-- 2) 顶级分类表：新增顶级「操作类」（排在大类 480，位于店铺产品与售前话术之间）
insert into public.training_categories (name, sort_order, parent_id)
select '操作类', 480, null
where not exists (
  select 1 from public.training_categories
  where name = '操作类' and parent_id is null
);

-- 3) 删除旧的「操作类」子分类记录（已由顶级分类替代）
delete from public.training_categories
where name = '操作类' and parent_id = '售前话术';

-- 完成提示
select '「操作类」已提升为顶级大类' as result;
