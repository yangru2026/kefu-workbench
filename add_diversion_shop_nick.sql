-- ============================================================
-- 舆情转接登记加字段：接待店铺 + 分流号昵称
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- ============================================================

-- 1) 加列（已存在则跳过）
alter table public.diversion_transfers add column if not exists shop text;           -- 接待店铺
alter table public.diversion_transfers add column if not exists diversion_nick text; -- 分流号昵称（可可/莓莓/睛彩顾问）

-- 2) 验证
select id, cs_name, shop, diversion_nick, reason, created_at
from public.diversion_transfers
order by created_at desc
limit 20;
