-- ============================================================
-- 质检重做 · 一步到位 SQL（v3，2026-10-31）
-- v2 修正：去掉「直接删 storage 表」的段落 —— Supabase 已禁止用 SQL 删 storage（42501 保护），
--          qc-images 截图桶在旧项目，要去 Supabase 网页 Storage 界面手动删，不走 SQL。
-- v3 新增：evidence（截图链接）列 + 扣罚确认人/确认时间列。
--          截图只存「链接」不存文件 —— 图片本体留在飞书，工作台只渲染一个可点外链，不占存储。
-- 执行环境：【新项目 youhe-workbench（icfgireprowcqwdodfqx）】SQL Editor
-- 可重复执行（幂等）：跑几次都没关系
-- ============================================================

-- 1) 删除旧表（连带旧 RLS 策略）
DROP TABLE IF EXISTS public.qc_records CASCADE;

-- 2) 建新表
CREATE TABLE public.qc_records (
  id          text primary key,              -- 飞书记录 record_id（幂等 upsert 用）
  qc_date     date,                          -- 质检日期
  staff_name  text,                          -- 客服花名（与工作台 profiles.name 一致）
  qc_name     text,                          -- 质检人（组长）
  issue_type  text,                          -- 问题类型
  severity    text,                          -- 一般提醒 / 严重问题 / 严重需整改
  amount      numeric(10,2) default 0,       -- 扣罚金额（留空/0 = 待管理员定）
  amount_confirmed_by text,                  -- 扣罚确认人（茹姐名字，留空=待定）
  amount_confirmed_at timestamptz,           -- 扣罚确认时间
  detail      text,                          -- 问题描述
  note        text,                          -- 备注
  evidence    text,                          -- 截图链接（文本，可多行/多个链接；不存图片本体）
  raw         jsonb,                         -- 飞书原始行
  synced_at   timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_qc_records_date  ON public.qc_records (qc_date DESC);
CREATE INDEX IF NOT EXISTS idx_qc_records_staff ON public.qc_records (staff_name);

-- 3) 权限：管理员/组长看全部；普通客服只看自己花名的记录；前端一律不能写（同步任务专用）
ALTER TABLE public.qc_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_read" ON public.qc_records;
CREATE POLICY "qc_read" ON public.qc_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','leader'))
    OR staff_name = (SELECT p2.name FROM public.profiles p2 WHERE p2.id = auth.uid())
  );

-- 4) 校验：应返回 14 行，包含 evidence / amount_confirmed_by / amount_confirmed_at
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'qc_records' ORDER BY ordinal_position;

-- 5) 再查一下有没有残留的旧 bucket（有的话去 Storage 界面手动删，SQL 删不了）
SELECT id, name FROM storage.buckets WHERE id LIKE '%qc%';
