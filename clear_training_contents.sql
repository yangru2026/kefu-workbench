-- 清空培训资料/售前话术内容卡片
-- 保留 training_categories 分类结构（大类/小类/分组），只删除具体的话术/资料内容
-- 执行前如需保留旧数据，请先用 Supabase Table Editor 导出备份

truncate table public.training_knowledge restart identity;
truncate table public.training_scripts restart identity;
