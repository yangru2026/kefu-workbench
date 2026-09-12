-- ============================================================
-- 平台规则：platform_rules 表
-- 背景：各平台规则/高压线统一维护（等级：高压线 / 重要 / 提醒），
--       高压线如站外导流、辱骂客户、好评返现、医疗功效宣传、泄露隐私等。
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- 权限：登录用户可读；新增/编辑/删除仅限 role='admin'。
-- ============================================================

-- 1) 建表
create table if not exists public.platform_rules (
  id uuid primary key default gen_random_uuid(),
  platform text not null default '通用',   -- 平台：通用/抖音/拼多多/天猫/京东/快手/小红书
  level text not null default '提醒',       -- 等级：高压线/重要/提醒
  title text not null,                      -- 规则标题
  content text,                             -- 规则内容（详细说明/违规后果）
  sort_order int default 0,                 -- 排序（小的在前）
  created_at timestamptz default now()
);

alter table public.platform_rules enable row level security;

-- 2) 权限：登录用户可读（全员学习）
drop policy if exists "platform rules authed read" on public.platform_rules;
create policy "platform rules authed read" on public.platform_rules
  for select to authenticated
  using (true);

-- 3) 权限：仅 admin 可写（管理员统一维护规则）
drop policy if exists "platform rules admin insert" on public.platform_rules;
create policy "platform rules admin insert" on public.platform_rules
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "platform rules admin update" on public.platform_rules;
create policy "platform rules admin update" on public.platform_rules
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "platform rules admin delete" on public.platform_rules;
create policy "platform rules admin delete" on public.platform_rules
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 4) 预置规则数据（已存在同标题的跳过，可重复执行）
insert into public.platform_rules (platform, level, title, content, sort_order)
select v.platform, v.level, v.title, v.content, v.sort_order
from (values
  -- ===== 通用高压线 =====
  ('通用','高压线','严禁引导站外交易 / 加微信','任何情况下不得引导客户加微信、QQ、电话联系或到其他平台下单，不得发送个人收款码。违规一次即扣除当月全部绩效并停岗调查。',1),
  ('通用','高压线','严禁辱骂、讽刺、威胁客户','无论客户态度如何，不得出现辱骂、讽刺、阴阳怪气、威胁性言辞。出现即扣除当月全部绩效，情节严重直接辞退。',2),
  ('通用','高压线','严禁虚假宣传 / 医疗功效表述','美瞳属于第三类医疗器械，不得宣传治疗、矫正近视、修复角膜等医疗功效，不得承诺"度数降下来""能治好散光"等。违规每次扣款 200 元，引发投诉/处罚由个人承担平台罚款。',3),
  ('通用','高压线','严禁泄露客户隐私','客户手机号、地址、订单信息不得截图外传、不得用于任何私下用途。违规一次即辞退并追究法律责任。',4),
  ('通用','高压线','严禁诱导好评 / 好评返现','不得以返现、红包、赠品等承诺换取好评或修改差评，不得引导客户点赞关注返福利。违规每次扣款 100 元。',5),
  ('通用','高压线','严禁私自承诺赔付 / 私下退款','赔偿、退款必须按流程报备处理，不得私自答应客户超额赔付或私下转账。违规金额由个人承担并视情况停岗。',6),
  -- ===== 通用重要 =====
  ('通用','重要','响应时间要求','首次响应不超过规定时限，超时需说明原因。高峰期轮班接待，不得挂机漏接。多次超时按考核制度扣分。',10),
  ('通用','重要','不得与客户发生争执','客户情绪激动时先安抚再解决，需要升级处理及时转组长/主管，不得对喷、不得拉黑客户。',11),
  ('通用','重要','订单信息录入准确','发货前核对度数（双眼分开）、基弧、直径、抛型、颜色，录错导致的退换损失按责任比例承担。',12),
  -- ===== 通用提醒 =====
  ('通用','提醒','规范使用话术模板','优先使用培训资料中心的标准话术，自定义回复注意错别字与用语规范。',20),
  ('通用','提醒','异常情况及时上报','遇到舆情、职业打假、平台介入、仲裁等情况第一时间上报主管，不要自行答复。',21),
  -- ===== 抖音 =====
  ('抖音','高压线','严禁站外导流','不得在抖音私聊/评论区出现微信号、手机号、第三方链接等任何站外引流信息（包括谐音、错别字变体）。违规轻则禁言重则封店，个人承担相应处罚。',1),
  ('抖音','重要','飞鸽响应与3分钟回复率','注意飞鸽消息及时回复，保障 3 分钟回复率达标，离线前设置好自动回复并交接值班。',5),
  -- ===== 拼多多 =====
  ('拼多多','高压线','严禁发送第三方联系方式','拼多多聊天内禁止发送微信号、手机号、二维码等任何站外联系方式，系统会自动识别并处罚。违规扣款由个人承担。',1),
  ('拼多多','重要','注意平台处罚考核指标','关注店铺体验分/纠纷退款率等指标，出现平台介入单第一时间上报处理。',5),
  -- ===== 天猫 =====
  ('天猫','高压线','严禁虚假发货与刷单','不得参与刷单、虚假发货、空包裹等行为，违规一次辞退并追责。',1),
  ('天猫','重要','旺旺响应要求','千牛消息及时回复，保障响应率与满意度指标，转接/分流规范操作。',5),
  -- ===== 京东 =====
  ('京东','高压线','严禁导流至京东以外的平台','京东对站外引流管控严格，不得引导客户到其他平台下单。',1),
  ('京东','重要','京麦消息及时处理','京麦消息及时回复，售后工单按时效处理，避免超时系统自动赔付。',5),
  -- ===== 快手 =====
  ('快手','高压线','严禁站外导流与私下交易','快手小店禁止私聊引导站外交易，违规封禁严重，个人承担处罚。',1),
  -- ===== 小红书 =====
  ('小红书','高压线','严禁评论区/私信导流','小红书私信与评论区严禁出现微信号、第三方链接等导流信息，违规限流封号。',1)
) as v(platform, level, title, content, sort_order)
where not exists (
  select 1 from public.platform_rules p where p.title = v.title
);

-- 5) 验证
select platform, level, count(*) as 条数
from public.platform_rules
group by platform, level
order by platform, level;
