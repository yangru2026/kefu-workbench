-- ============================================================
-- 考核成绩收卷：quiz_results 表 + 权限（RLS）
-- 背景：花色考核试卷 quiz.html 通过链接发给新客服，交卷后自动上报成绩，
--       主管（admin）在工作台「考核成绩」页查看分数与逐题明细。
-- 在 Supabase SQL Editor 执行一次即可；幂等，可重复执行。
-- 权限设计：
--   · 任何人都能交卷（考生可能没登录工作台账号 → anon 可 insert）
--   · 只有 admin 能看成绩、能删记录（考生自己看不到、也改不了别人的）
-- ============================================================

-- 1) 建表
create table if not exists public.quiz_results (
  id           uuid primary key default gen_random_uuid(),
  quiz_key     text not null default 'miyang-color-price',  -- 试卷标识（将来多套卷子用）
  quiz_title   text,                                        -- 试卷标题快照
  examinee     text not null,                               -- 考生姓名
  score        int  not null default 0,                     -- 总分
  total        int  not null default 100,                   -- 满分
  auto_score   int,                                         -- 客观题得分
  auto_total   int,
  self_score   int,                                         -- 主观题自评得分
  self_total   int,
  duration_sec int,                                         -- 用时（秒）
  detail       jsonb,                                       -- 逐题明细 [{no,sec,ans,got,full,kind}]
  user_agent   text,                                        -- 交卷设备（排查用）
  created_at   timestamptz not null default now()           -- 交卷时间
);

create index if not exists idx_quiz_results_created  on public.quiz_results (created_at desc);
create index if not exists idx_quiz_results_examinee on public.quiz_results (examinee);

-- 2) 开启行级安全
alter table public.quiz_results enable row level security;

-- 3) 权限：任何人可交卷（含未登录考生），但字段做了基本约束，避免脏数据
drop policy if exists "quiz results anyone insert" on public.quiz_results;
create policy "quiz results anyone insert" on public.quiz_results
  for insert to anon, authenticated
  with check (
    length(btrim(examinee)) between 1 and 20
    and score >= 0 and score <= 1000
    and total > 0 and total <= 1000
  );

-- 4) 权限：仅 admin 可读成绩
drop policy if exists "quiz results admin read" on public.quiz_results;
create policy "quiz results admin read" on public.quiz_results
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 5) 权限：仅 admin 可删记录（重复交卷/测试数据清理）
drop policy if exists "quiz results admin delete" on public.quiz_results;
create policy "quiz results admin delete" on public.quiz_results
  for delete to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 6) 验证
select count(*) as 已收卷条数 from public.quiz_results;
