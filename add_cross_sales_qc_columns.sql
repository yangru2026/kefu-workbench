-- ============================================
-- 连带成交 · 质检字段迁移
-- ============================================
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
--
-- 说明：
--   原表所有字段（金额、订单号）一律不动。
--   质检结果单独存于以下新字段，由管理员在「🔍 质检连带明细」面板写入。
--   排名/提成统计时，qc_result 为 pending 或 pass 才计入第二单金额；
--   fail_refund / fail_amount / difficulty_refund 视为不合格，按 0 计。
-- ============================================

ALTER TABLE cross_sales ADD COLUMN IF NOT EXISTS qc_result TEXT DEFAULT 'pending';
ALTER TABLE cross_sales ADD COLUMN IF NOT EXISTS refund_order_no TEXT;
ALTER TABLE cross_sales ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE cross_sales ADD COLUMN IF NOT EXISTS qc_amount_threshold NUMERIC(12,2) DEFAULT 0;
ALTER TABLE cross_sales ADD COLUMN IF NOT EXISTS qc_note TEXT;
ALTER TABLE cross_sales ADD COLUMN IF NOT EXISTS qc_checked_at TIMESTAMPTZ;
ALTER TABLE cross_sales ADD COLUMN IF NOT EXISTS qc_by TEXT;

COMMENT ON COLUMN cross_sales.qc_result IS '质检结果: pending(未检)/pass(合格)/fail_refund(退款不合格)/fail_amount(金额异常)/difficulty_refund(退差价待确认)';
COMMENT ON COLUMN cross_sales.refund_order_no IS '命中的退款单号（来自 ERP 退款清单）';
COMMENT ON COLUMN cross_sales.refund_amount IS '命中退款的金额';
COMMENT ON COLUMN cross_sales.qc_amount_threshold IS '该产品类型的活动机制最低合计金额';
COMMENT ON COLUMN cross_sales.qc_note IS '管理员质检备注';
COMMENT ON COLUMN cross_sales.qc_checked_at IS '质检时间';
COMMENT ON COLUMN cross_sales.qc_by IS '质检操作人';

CREATE INDEX IF NOT EXISTS idx_cross_sales_qc_result ON cross_sales(qc_result);
