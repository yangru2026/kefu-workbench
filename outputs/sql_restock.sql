-- 缺货补货动态表（在 Supabase SQL Editor 执行）
create table if not exists restock_items (
  id uuid primary key default gen_random_uuid(),
  toss text not null check (toss in ('半年抛','日抛')),
  name text not null,
  status text not null check (status in ('restocking','done','no')),
  eta_date text,
  note text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table restock_items enable row level security;

-- 所有登录用户可读（客服只读）
create policy "restock_select_all"
  on restock_items for select to authenticated
  using (true);

-- 仅管理员可写
create policy "restock_insert_admin"
  on restock_items for insert to authenticated
  with check (is_admin());

create policy "restock_update_admin"
  on restock_items for update to authenticated
  using (is_admin()) with check (is_admin());

create policy "restock_delete_admin"
  on restock_items for delete to authenticated
  using (is_admin());
