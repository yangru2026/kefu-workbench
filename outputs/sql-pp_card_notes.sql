-- ============================================================
-- 价格速查「卡片提醒」表
-- 用途：管理员在价格速查第二层选项卡上填写提醒文字，全员实时可见
-- 执行位置：Supabase Dashboard → SQL Editor → 粘贴运行（只需执行一次）
-- ============================================================

create table if not exists pp_card_notes (
  id uuid primary key default gen_random_uuid(),
  note_key text not null unique,          -- 格式：品牌|维度|值，如 弥生|price|29.9元/副
  note_text text not null default '',
  updated_at timestamptz not null default now()
);

-- RLS：与现有表一致，读取全员放开、写入由页面端管理员界面控制
alter table pp_card_notes enable row level security;

drop policy if exists "pp_card_notes_read" on pp_card_notes;
create policy "pp_card_notes_read" on pp_card_notes for select using (true);

drop policy if exists "pp_card_notes_insert" on pp_card_notes;
create policy "pp_card_notes_insert" on pp_card_notes for insert with check (true);

drop policy if exists "pp_card_notes_update" on pp_card_notes;
create policy "pp_card_notes_update" on pp_card_notes for update using (true) with check (true);

-- 开启 Realtime（其他客服实时收到提醒变化）
alter publication supabase_realtime add table pp_card_notes;

-- 验证：应返回空表结构无报错
select * from pp_card_notes limit 1;
