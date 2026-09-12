-- ============================================================
-- 拼多多客服规则（售前相关）批量导入 platform_rules 表
-- 来源：茹姐 2026-09-12 提供的《拼多多客服规则（售前相关）》
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- 注意：若之前从未执行过 create_platform_rules.sql，本文件也会自动建表+授权。
-- ============================================================

-- 0) 建表 + 权限（已执行过 create_platform_rules.sql 的可跳过，语句均幂等）
create table if not exists public.platform_rules (
  id uuid primary key default gen_random_uuid(),
  platform text not null default '通用',
  level text not null default '提醒',
  title text not null,
  content text,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table public.platform_rules enable row level security;

drop policy if exists "platform rules authed read" on public.platform_rules;
create policy "platform rules authed read" on public.platform_rules
  for select to authenticated using (true);

drop policy if exists "platform rules admin insert" on public.platform_rules;
create policy "platform rules admin insert" on public.platform_rules
  for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "platform rules admin update" on public.platform_rules;
create policy "platform rules admin update" on public.platform_rules
  for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "platform rules admin delete" on public.platform_rules;
create policy "platform rules admin delete" on public.platform_rules
  for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 1) 清掉旧的泛化条目（内容已被下面更具体的规则覆盖）
delete from public.platform_rules where platform = '拼多多' and title = '注意平台处罚考核指标';

-- 2) 导入拼多多规则（同标题跳过，可重复执行）
insert into public.platform_rules (platform, level, title, content, sort_order)
select v.platform, v.level, v.title, v.content, v.sort_order
from (values
  -- ===== 一、回复规范 =====
  ('拼多多','高压线','不能引导站外','微信、QQ、电话一律不能提。拼多多聊天内禁止出现任何第三方联系方式，系统自动识别，违规扣款由个人承担。',1),
  ('拼多多','重要','3分钟回复率','客户消息 3 分钟内必回，响应率直接影响店铺评分。高峰期轮班接待，离线前交接好值班。',2),
  ('拼多多','重要','不能重复话术','连续发送一样的话术会被平台判定为机器人，导致降权。同一意思换个说法，不要整段复制粘贴刷屏。',3),
  ('拼多多','高压线','不能发敏感词','极限词、违禁词一律不能用（如"最""第一""绝对"等）。发送前过一遍脑子，拿不准的查违禁词表。',4),
  -- ===== 二、交易规范 =====
  ('拼多多','重要','不能私自改价','所有价格操作走系统流程，不得私下承诺改价或用其他方式变相改价。',5),
  ('拼多多','高压线','不能好评返现','平台重点监控，查到就罚款。不得以返现、红包、赠品换取好评或修改差评。',6),
  ('拼多多','高压线','不能引导退款重拍','不得让客户"退了再换链接拍"，平台判定为违规操作。价格/链接问题走正规流程报备处理。',7),
  ('拼多多','重要','答应的必须做到','赠品、活动、发货时间都不能瞎承诺。承诺之前先确认能不能兑现，兑现不了的不要说。',8),
  -- ===== 三、在线要求 =====
  ('拼多多','重要','8:00-23:00 必须在线','8:00-23:00 时间段内不能挂离开状态。排班休息时间提前报备组长，做好接待交接。',9),
  ('拼多多','重要','已读不回 = 更严重','看到了故意不回，客户投诉直接成立。消息必须逐条处理，不能挑着回、漏着回。',10),
  -- ===== 四、服务态度 =====
  ('拼多多','高压线','不能骂人 / 态度差','讽刺、怼客户、阴阳怪气都不行。无论客户什么态度，保持礼貌专业。',11),
  ('拼多多','提醒','客户情绪激动先安抚','先安抚情绪再解决问题，解决不了的及时转主管，不对喷、不拉黑客户。',12),
  ('拼多多','高压线','不能泄露客户隐私','客户电话、地址等订单信息不外传、不截图发群里、不用于任何私下用途。',13)
) as v(platform, level, title, content, sort_order)
where not exists (
  select 1 from public.platform_rules p where p.title = v.title
);

-- 3) 验证
select platform, level, title
from public.platform_rules
where platform = '拼多多'
order by sort_order;
