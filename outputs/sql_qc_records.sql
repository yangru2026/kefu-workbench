-- ============================================================
-- 质检记录表（2026-10-31 重做版）
-- 数据来源：飞书登记表（组长登记）→ 由同步任务写入本表，前端只读
-- 执行环境：【新项目 youhe-workbench（icfgireprowcqwdodfqx）】SQL Editor
-- 顺序：先跑 sql_qc_reset.sql（删旧表），再跑本文件
-- ============================================================

create table if not exists public.qc_records (
  id          text primary key,              -- 飞书记录 record_id（幂等 upsert 用）
  qc_date     date,                          -- 质检日期
  staff_name  text,                          -- 客服花名（与工作台 profiles.name 一致）
  qc_name     text,                          -- 质检人
  issue_type  text,                          -- 问题类型
  severity    text,                          -- 一般提醒 / 严重问题 / 严重需整改
  amount      numeric(10,2) default 0,       -- 扣罚金额
  detail      text,                          -- 问题描述
  note        text,                          -- 备注
  raw         jsonb,                         -- 飞书原始行（字段变动时兜底）
  synced_at   timestamptz default now()
);

create index if not exists idx_qc_records_date  on public.qc_records (qc_date desc);
create index if not exists idx_qc_records_staff on public.qc_records (staff_name);

alter table public.qc_records enable row level security;

-- 读：管理员/组长看全部；普通客服只看自己花名下的记录
drop policy if exists "qc_read" on public.qc_records;
create policy "qc_read" on public.qc_records
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','leader'))
    or staff_name = (select p2.name from public.profiles p2 where p2.id = auth.uid())
  );

-- 写：故意不建 insert/update/delete 策略 → 前端一律不能改，只有 service_role（同步任务）能写
