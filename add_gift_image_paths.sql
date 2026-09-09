-- ============================================================
-- 赠品多图支持迁移：为已存在的 gift_codes 表新增 image_paths 数组字段
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- 适用场景：工作台“🎁 赠品编码”改为支持一个赠品放多张产品图。
-- 注意：本文件只加字段 + 回填旧数据，不会删 image_path（保留兼容）。
-- ============================================================

-- 1) 新增数组字段（已存在则跳过）
alter table public.gift_codes add column if not exists image_paths text[];

-- 2) 回填：把旧的单图迁移到数组里（只回填尚未有 image_paths 的记录）
update public.gift_codes
set image_paths = array[image_path]
where image_path is not null
  and (image_paths is null or array_length(image_paths, 1) is null);

-- 3) 验证
select id, name, image_path, image_paths
from public.gift_codes
order by sort_order, created_at
limit 20;
