-- ============================================================
-- 售前话术：新增「极氧」+「操作类」话题与示例场景（追加文件）
-- 独立追加，单独在 Supabase SQL Editor 执行即可，不影响已有话术。
-- 幂等：重复执行不会重复插入，也不会删除任何已有数据。
-- 注意：本文件只做「新增」。请勿再执行旧的全量文件 add_scripts_from_excel.sql，
--       因为那个文件有 delete 全部售前话术的逻辑，重跑会清掉本文件加的内容。
-- ============================================================

-- 确保表/权限/trigger 存在（对已经执行过全量文件的用户无害）
create table if not exists public.training_scripts (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default '售前话术',
  subcategory text not null default '未分类',
  title       text not null,
  styles      jsonb not null default '{"标准":"","亲切":"","简短":"","专业":"","安抚":""}'::jsonb,
  tags        text[] not null default '{}',
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  script_group text not null default '通用',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_training_scripts_cat on public.training_scripts (category);
create index if not exists idx_training_scripts_sub on public.training_scripts (subcategory);
alter table public.training_scripts add column if not exists script_group text not null default '通用';
alter table public.training_scripts enable row level security;
drop policy if exists "scripts public read" on public.training_scripts;
create policy "scripts public read" on public.training_scripts for select using (true);
drop policy if exists "scripts authed write" on public.training_scripts;
create policy "scripts authed write" on public.training_scripts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_training_scripts_updated on public.training_scripts;
create trigger trg_training_scripts_updated before update on public.training_scripts
  for each row execute function public.set_updated_at();

-- 1) 新增「极氧」小类（parent 指向售前话术大类），sort_order 590 排在最后
insert into public.training_categories (name, sort_order, parent_id)
select '极氧', 590, '售前话术'
where not exists (select 1 from public.training_categories where name='极氧' and parent_id='售前话术');

-- 2) 新增「操作类」小类（parent 指向售前话术大类），sort_order 580
insert into public.training_categories (name, sort_order, parent_id)
select '操作类', 580, '售前话术'
where not exists (select 1 from public.training_categories where name='操作类' and parent_id='售前话术');

-- 3) 插入「极氧」示例场景话术（归「极氧」分组）
--    防重：按 (subcategory, title) 唯一判断，重复执行不堆积。

insert into public.training_scripts (category, subcategory, title, styles, tags, sort_order, script_group)
select '售前话术', '极氧', '极氧和普通美瞳有什么区别',
  '{"标准":"极氧主打硅水凝胶材质，透氧性比普通水凝胶美瞳更高，长时间佩戴眼睛不容易干涩、泛红。适合追求舒适度的敏感眼和长时间戴镜的姐妹。", "亲切":"", "简短":"", "专业":"", "安抚":""}'::jsonb,
  array['极氧','硅水凝胶','透氧'], 1, '极氧'
where not exists (select 1 from public.training_scripts where category='售前话术' and subcategory='极氧' and title='极氧和普通美瞳有什么区别');

insert into public.training_scripts (category, subcategory, title, styles, tags, sort_order, script_group)
select '售前话术', '极氧', '敏感眼/干眼适合戴极氧吗',
  '{"标准":"敏感眼和干眼更推荐极氧系列。硅水凝胶材质透氧通道多，含水量更稳定，能减少镜片与角膜之间的缺氧感和干涩感。", "亲切":"", "简短":"", "专业":"", "安抚":""}'::jsonb,
  array['极氧','敏感眼','干眼'], 2, '极氧'
where not exists (select 1 from public.training_scripts where category='售前话术' and subcategory='极氧' and title='敏感眼/干眼适合戴极氧吗');

insert into public.training_scripts (category, subcategory, title, styles, tags, sort_order, script_group)
select '售前话术', '极氧', '极氧花色推荐（自然/通勤款）',
  '{"标准":"极氧系列花色偏自然清透，日常通勤、素颜、淡妆都很适合。想要裸眼感选浅棕/巧色系，想要有神但不夸张选小黑环/星点款。", "亲切":"", "简短":"", "专业":"", "安抚":""}'::jsonb,
  array['极氧','花色推荐','通勤'], 3, '极氧'
where not exists (select 1 from public.training_scripts where category='售前话术' and subcategory='极氧' and title='极氧花色推荐（自然/通勤款）');

insert into public.training_scripts (category, subcategory, title, styles, tags, sort_order, script_group)
select '售前话术', '极氧', '极氧透氧参数怎么讲',
  '{"标准":"极氧采用硅水凝胶材质，透氧量（Dk/t）明显高于普通水凝胶镜片。透氧量越高，角膜获得的氧气越多，佩戴感越透气、越不容易红眼。", "亲切":"", "简短":"", "专业":"", "安抚":""}'::jsonb,
  array['极氧','透氧','专业参数'], 4, '极氧'
where not exists (select 1 from public.training_scripts where category='售前话术' and subcategory='极氧' and title='极氧透氧参数怎么讲');

-- 4) 插入「操作类」示例场景话术（建模版）

insert into public.training_scripts (category, subcategory, title, styles, tags, sort_order, script_group)
select '售前话术', '操作类', '延迟发货操作',
  '{"标准":"📋 延迟发货标准操作：\n\n①先安抚客户情绪，说明延迟原因（工厂排单/物流高峰/备货中）；\n②明确告知预计发货时间，给出具体日期而非模糊表述；\n③主动提供补偿方案（如小赠品/优惠券）降低不满；\n④承诺到点未发主动跟进，必要时升级处理。\n\n⚠️ 模板待完善：把你们实际遇到最多的延迟场景话术填进来。", "亲切":"", "简短":"", "专业":"", "安抚":""}'::jsonb,
  array['操作','发货'], 1, '通用'
where not exists (select 1 from public.training_scripts where category='售前话术' and subcategory='操作类' and title='延迟发货操作');

insert into public.training_scripts (category, subcategory, title, styles, tags, sort_order, script_group)
select '售前话术', '操作类', '拆分不同地址下单操作',
  '{"标准":"📋 拆分不同地址下单标准操作：\n\n①确认客户需要分几个地址、分别发什么商品/度数；\n②引导客户【按地址分别下单】，每单填对应收货信息；\n③如客户坚持一单多地址，说明本店系统限制，建议分开下单以便准确发货；\n④下单后提醒客户核对收货地址，避免发错。\n\n⚠️ 模板待完善：补充你们允许的拆单规则与话术。", "亲切":"", "简短":"", "专业":"", "安抚":""}'::jsonb,
  array['操作','拆单','地址'], 2, '通用'
where not exists (select 1 from public.training_scripts where category='售前话术' and subcategory='操作类' and title='拆分不同地址下单操作');

insert into public.training_scripts (category, subcategory, title, styles, tags, sort_order, script_group)
select '售前话术', '操作类', '不同花色下单流程',
  '{"标准":"📋 不同花色（多副）下单标准流程：\n\n①确认客户要几副、各自花色与度数；\n②引导分别加入购物车后合并结算；\n③如各副度数不同，务必在备注栏写清「第1副：花色+度数；第2副：花色+度数」；\n④下单后复述一遍花色度数，请客户确认无误再发货。\n\n⚠️ 模板待完善：补充你们主推的拼色搭配与备注规范。", "亲切":"", "简短":"", "专业":"", "安抚":""}'::jsonb,
  array['操作','多副','花色'], 3, '通用'
where not exists (select 1 from public.training_scripts where category='售前话术' and subcategory='操作类' and title='不同花色下单流程');

-- 完成提示
select '「极氧」+「操作类」话题与示例场景已就绪' as result;
