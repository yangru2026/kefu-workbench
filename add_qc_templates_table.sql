-- ============================================================
-- qc_templates 常用问题快捷模板表
-- 用途：质检录入时快速套用高频问题模板，减少重复输入
-- 使用：直接在 Supabase SQL Editor 执行
-- ============================================================

create table if not exists public.qc_templates (
  id bigint primary key,
  name text not null,
  severity text not null default '一般',
  tags text[] not null default '{}',
  problem text not null default '',
  correct text not null default '',
  knowledge text not null default '',
  penalty_amount numeric not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.qc_templates enable row level security;

drop policy if exists "qc_templates_all" on public.qc_templates;
create policy "qc_templates_all" on public.qc_templates
  for all using (true) with check (true);

-- ============================================================
-- 种子模板（团队共用，管理员可在工具内增删，此处为初始示例）
-- ============================================================
insert into public.qc_templates
  (id, name, severity, tags, problem, correct, knowledge, penalty_amount, sort_order, is_active)
values
(1, '未确认参数直接推荐', '严重',
  array['话术问题','流程问题'],
  '客户咨询美瞳但未确认近视度数、基弧、直径等关键参数，直接推荐了产品',
  '推荐前必须先确认：近视度数、基弧、直径、日抛/月抛需求；客户不确定时引导查看包装盒或验光单',
  '基弧常见 8.6 / 8.7；直径主流 14.2mm；散光客户需定制散光片，不可随意替代',
  0, 1, true),
(2, '首次响应超时', '一般',
  array['响应问题'],
  '客户消息进线后未及时回复，首次响应超过 3 分钟',
  '高峰期开启自动回复并设置排队提示；进线后先快速回应（"您好，在的，帮您看下~"）再查资料',
  '首响目标：3 分钟内；忙时先安抚再让客户稍等，不可长时间静默',
  0, 2, true),
(3, '参数推荐错误', '严重',
  array['产品知识'],
  '客户度数/眼部情况与推荐产品不匹配（如基弧、直径、材质推荐错误）',
  '下单前逐项核对参数：度数 ±0.00~-10.00 对应库存范围；基弧以客户验光单为准，不确定一律先确认再推',
  '敏感眼优先推荐硅水凝胶材质；日抛透氧量高于月抛，需按佩戴习惯推荐',
  0, 3, true),
(4, '未主动催付流失订单', '一般',
  array['流程问题'],
  '客户表达购买意向后未跟进催付，导致订单流失',
  '客户犹豫时给出活动时效与库存提示（"今天下单可享满减，库存不多哦"），1 小时后可跟进一次',
  '催付话术需自然不催促，强调活动时效与库存；已拍未付可提醒支付方式支持',
  0, 4, true),
(5, '退换货未走标准流程', '严重',
  array['流程问题'],
  '客户申请退换货时未登记订单号、未按标准 SOP 处理',
  '退换货必须登记订单号、购买店铺、原因，按 SOP 走审批流程，勿直接承诺无条件退货',
  '售后 SOP：登记订单号 → 核实收货状态 → 按规则判定 → 登记处理结果；快递问题优先安抚',
  0, 5, true),
(6, '态度生硬敷衍', '严重需整改',
  array['态度问题'],
  '客户多问几句后回复生硬、敷衍，或直接让客户自己看详情页',
  '耐心解答客户疑问，先共情再给方案（"理解您的顾虑，帮您确认一下~"），禁止反问或甩链接',
  '情绪管理：先接住客户情绪再解决问题；回复语气保持亲和，多用"帮您""您看这样行吗"',
  0, 6, true);

-- 提示：表已就绪后，刷新质检工具页面即可在录入区顶部看到模板下拉。
