-- ============================================================
-- 补货情况表 restock_items（2026-11-03 重建，老项目迁库时没带过来）
-- 茹姐口径：只有两个分类——补货中（restocking）/ 不补清单（no）
-- 所有人可读（客服查看），仅管理员可增删改
-- ============================================================

create table if not exists restock_items (
  id         bigint generated always as identity primary key,
  toss       text default '半年抛',        -- 半年抛 / 日抛（仅标签用）
  name       text not null,                -- 花名（按茹姐给的原文存，含 6片装 后缀）
  status     text not null default 'restocking',  -- restocking=补货中 | no=不补清单
  eta_date   text,                         -- 到货时间原文，如「11.7左右」
  note       text,
  updated_at timestamptz default now()
);

alter table restock_items enable row level security;

drop policy if exists "ri_select_all" on restock_items;
create policy "ri_select_all" on restock_items for select using (true);
drop policy if exists "ri_insert_admin" on restock_items;
create policy "ri_insert_admin" on restock_items for insert with check (is_admin());
drop policy if exists "ri_update_admin" on restock_items;
create policy "ri_update_admin" on restock_items for update using (is_admin());
drop policy if exists "ri_delete_admin" on restock_items;
create policy "ri_delete_admin" on restock_items for delete using (is_admin());

-- 预填：2026-11-03 茹姐提供的补货情况（全部为「补货中」）
insert into restock_items (toss, name, status, eta_date) values
  ('半年抛', '我喜欢你',       'restocking', '11.7左右'),
  ('半年抛', '汪汪队',         'restocking', '11.7左右'),
  ('半年抛', '少女心事',       'restocking', '11.13左右'),
  ('半年抛', '她的梨涡',       'restocking', '11.6左右'),
  ('半年抛', '国民初恋',       'restocking', '11.6左右'),
  ('半年抛', '黑莓缪斯',       'restocking', '11.11左右'),
  ('半年抛', '妮妮千金',       'restocking', '11.6左右'),
  ('半年抛', '等你下课',       'restocking', '11.8左右'),
  ('半年抛', '摩卡奶茶',       'restocking', '11.20左右'),
  ('半年抛', '夜与法兰西',     'restocking', '11.12左右'),
  ('日抛',   '伦敦碎片6片装',  'restocking', '11.10左右'),
  ('日抛',   '黄油小熊6片装',  'restocking', '11.12左右'),
  ('日抛',   '校花指南6片装',  'restocking', '12.10左右'),
  ('日抛',   '小黑环pro6片装', 'restocking', '11.5左右'),
  ('日抛',   '小棕环pro6片装', 'restocking', '11.20左右'),
  ('日抛',   '笨蛋美女6片装',  'restocking', '11.20左右'),
  ('日抛',   '冰岛日记6片装',  'restocking', '11.12左右'),
  ('日抛',   '绿野仙棕6片装',  'restocking', '12.10左右');
