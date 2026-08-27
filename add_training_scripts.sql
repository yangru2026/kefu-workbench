-- ============================================================
-- 售前话术板块：新建 training_scripts 表 + 种子分类与示例话术
-- 在 Supabase SQL Editor 执行本文件即可
-- ============================================================

-- 1) 新建话术表
create table if not exists public.training_scripts (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default '售前话术',
  subcategory text not null default '未分类',
  title       text not null,
  styles      jsonb not null default '{"标准":"","亲切":"","简短":"","专业":"","安抚":""}'::jsonb,
  tags        text[] not null default '{}',
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 索引
create index if not exists idx_training_scripts_cat on public.training_scripts (category);
create index if not exists idx_training_scripts_sub on public.training_scripts (subcategory);

-- 2) RLS：全员可读，登录用户可写（与管理员/主管在界面内再按角色控制）
alter table public.training_scripts enable row level security;

drop policy if exists "scripts public read" on public.training_scripts;
create policy "scripts public read" on public.training_scripts
  for select using (true);

drop policy if exists "scripts authed write" on public.training_scripts;
create policy "scripts authed write" on public.training_scripts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 3) updated_at 自动刷新
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_training_scripts_updated on public.training_scripts;
create trigger trg_training_scripts_updated
  before update on public.training_scripts
  for each row execute function public.set_updated_at();

-- 4) 种子：在 training_categories 加入「售前话术」大类（sort_order 500）
--    以及一个小类「佩戴问题」作为示范，后续可在界面用「＋新增小类」自行扩展
insert into public.training_categories (name, sort_order, parent_id)
select '售前话术', 500, ''
where not exists (
  select 1 from public.training_categories where name = '售前话术' and (parent_id is null or parent_id = '')
);

insert into public.training_categories (name, sort_order, parent_id)
select '佩戴问题', 510, '售前话术'
where not exists (
  select 1 from public.training_categories where name = '佩戴问题' and parent_id = '售前话术'
);

-- 5) 示例话术（内容可后续在界面内编辑/删除/补充）
insert into public.training_scripts (category, subcategory, title, styles, tags, sort_order)
select '售前话术', '佩戴问题', '新客不会佩戴 / 怕上手',
$_${
  "标准": "亲，美瞳建议用指腹轻捏，先戴右眼后左眼，佩戴前洗净双手哦～",
  "亲切": "宝子别慌～第一次戴都这样，对着镜子慢慢来，我教你个小技巧：低头看镜子、手指把镜片轻轻放上去就好啦。",
  "简短": "洗净手 → 指腹捏镜片 → 先右后左 → 对着镜子戴。",
  "专业": "佩戴前用无絮纸巾擦干手指，镜片置于食指指腹，另一只手拉开上下眼睑，双眼直视前方将镜片轻贴角膜后松手闭合。",
  "安抚": "理解第一次戴会紧张，很多老客户也是练几次就顺手了，有任何不舒服随时找我～"
}$_$,
array['新手','佩戴'], 10
where not exists (select 1 from public.training_scripts where title = '新客不会佩戴 / 怕上手' and subcategory = '佩戴问题');

insert into public.training_scripts (category, subcategory, title, styles, tags, sort_order)
select '售前话术', '佩戴问题', '镜片磨眼 / 有异物感',
$_${
  "标准": "异物感可能是镜片正反面戴反或表面有异物，取下重新清洗再佩戴试试。",
  "亲切": "宝是不是戴反啦？拿出来看看是小碗还是小碟～翻过来就舒服咯。",
  "简短": "取下 → 冲洗 → 确认正反面 → 重新佩戴。",
  "专业": "请立即取下镜片检查正反面（边缘内收为正面）及表面是否附着异物，使用护理液冲洗后重新佩戴；若持续不适建议停戴并咨询验光师。",
  "安抚": "磨眼肯定难受，先取下让眼睛休息下，别硬撑，我帮你看看是不是正反问题～"
}$_$,
array['磨眼','异物感','售后'], 20
where not exists (select 1 from public.training_scripts where title = '镜片磨眼 / 有异物感' and subcategory = '佩戴问题');
