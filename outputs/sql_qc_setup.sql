-- ============================================================
-- 质检重做 · 一步到位 SQL（2026-10-31）
-- 作用：删掉旧结构的 qc_records 表 + 重建新结构 + 配好权限
--       （旧数据本来就要全部清空，所以直接删表重建，不用分两步跑）
-- 执行环境：【新项目 youhe-workbench（icfgireprowcqwdodfqx）】SQL Editor
-- 跑完后：回工作台刷新「质检」页即可（数据等飞书同步接上后出现）
-- ============================================================

-- 1) 删除旧表（连带旧 RLS 策略）
DROP TABLE IF EXISTS public.qc_records CASCADE;

-- 2) 建新表
CREATE TABLE public.qc_records (
  id          text primary key,              -- 飞书记录 record_id（幂等 upsert 用）
  qc_date     date,                          -- 质检日期
  staff_name  text,                          -- 客服花名（与工作台 profiles.name 一致）
  qc_name     text,                          -- 质检人
  issue_type  text,                          -- 问题类型
  severity    text,                          -- 一般提醒 / 严重问题 / 严重需整改
  amount      numeric(10,2) default 0,       -- 扣罚金额（留空/0 = 待管理员定）
  detail      text,                          -- 问题描述
  note        text,                          -- 备注
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

-- 4) 顺带清掉可能残留的质检截图 bucket（如果之前没跑过清空 SQL，这里补上）
DELETE FROM storage.objects WHERE bucket_id = 'qc-images';
DELETE FROM storage.buckets  WHERE id = 'qc-images';

-- 5) 校验：应返回 qc_records 一行、且包含 qc_date / amount / staff_name 等列
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'qc_records' ORDER BY ordinal_position;
