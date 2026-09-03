-- 质检记录增加「客服确认收到」字段
-- 用途：普通客服在质检工具表格视图点「确认收到」后记录谁、何时确认
-- 在 Supabase SQL Editor 执行一次即可（带 IF NOT EXISTS，可重复执行不报错）

ALTER TABLE qc_records ADD COLUMN IF NOT EXISTS received_at timestamptz;
ALTER TABLE qc_records ADD COLUMN IF NOT EXISTS received_by text;

-- 便于按确认时间统计
CREATE INDEX IF NOT EXISTS idx_qc_records_received ON qc_records (received_at);
