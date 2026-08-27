-- ============================================================
-- 培训资料「页面内固定知识卡」表
-- 用途：把结构化知识（抛型对比、护理要求等）直接沉淀到工作台，
--       不依赖飞书跳转。按小类(subcat)挂载，进入该小类时优先渲染。
-- 执行方式：Supabase → SQL Editor → 粘贴执行
-- ============================================================

create table if not exists public.training_knowledge (
  id           uuid primary key default gen_random_uuid(),
  subcat       text not null,                 -- 小类名，如 '美瞳抛型'
  section_type text not null,                 -- overview | cards | steps
  title        text,                          -- 区块标题，如 '抛型对比总览'
  icon         text,                          -- 区块图标 emoji，可空
  content      jsonb not null default '{}'::jsonb,  -- 结构随 section_type 变化
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_training_knowledge_subcat on public.training_knowledge(subcat);

-- RLS：公开可读，登录用户可写（与 training_materials 一致）
alter table public.training_knowledge enable row level security;

drop policy if exists "training_knowledge_public_read" on public.training_knowledge;
create policy "training_knowledge_public_read"
  on public.training_knowledge for select using (true);

drop policy if exists "training_knowledge_auth_write" on public.training_knowledge;
create policy "training_knowledge_auth_write"
  on public.training_knowledge for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 种子数据：美瞳抛型（示例内容，确认风格后可替换为真实文案）
-- content 结构：
--   overview: { "items": [ { "icon": "👁️", "name": "日抛", "desc": "1天" }, ... ] }
--   cards:    { "items": [ { "title": "建议佩戴时长", "body": "..." }, ... ] }
--   steps:    { "items": [ { "title": "第一步", "body": "..." }, ... ] }
-- ============================================================
insert into public.training_knowledge (subcat, section_type, title, icon, content, sort_order)
values
(
  '美瞳抛型', 'overview', '抛型对比总览', '👁️',
  '{
    "items": [
      {"icon":"👁️","name":"日抛","desc":"佩戴 1 天，当天丢弃，无需护理液"},
      {"icon":"🌙","name":"月抛","desc":"连续佩戴约 30 天，需每日护理"},
      {"icon":"🍃","name":"季抛","desc":"约 90 天，适合偶尔佩戴"},
      {"icon":"🌿","name":"半年抛","desc":"约 180 天，性价比高"},
      {"icon":"🗓️","name":"年抛","desc":"约 365 天，需注意清洁频次"}
    ]
  }'::jsonb,
  10
),
(
  '美瞳抛型', 'cards', '佩戴与护理要点', '💡',
  '{
    "items": [
      {"title":"建议佩戴时长","body":"每日佩戴不超过 8 小时，睡眠、游泳、洗澡时务必取下。"},
      {"title":"护理要求","body":"长周期抛需每日用护理液揉搓清洗、浸泡至少 4 小时，不可用清水或自来水。"},
      {"title":"日抛特点","body":"免护理、卫生方便，适合敏感眼、出差旅行或偶尔佩戴人群。"}
    ]
  }'::jsonb,
  20
),
(
  '美瞳抛型', 'steps', '长周期抛日常护理步骤', '🧴',
  '{
    "items": [
      {"title":"摘镜洗手","body":"先洗净双手并擦干，避免细菌感染。"},
      {"title":"揉搓清洗","body":"掌心滴护理液，食指轻揉镜片正反面各 10 秒。"},
      {"title":"浸泡保存","body":"放入镜盒加满新鲜护理液，浸泡至少 4 小时。"},
      {"title":"定期更换","body":"按抛型周期更换，镜盒每月换新，护理液开封后 3 个月内用完。"}
    ]
  }'::jsonb,
  30
);
