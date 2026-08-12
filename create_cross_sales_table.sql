-- ============================================
-- 连带成交登记表
-- ============================================
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
--
-- 用途：
--   1. 存储飞书「连带成交登记表」实时同步的数据
--   2. 支持按日期/月份统计第二单销售额排名
--
-- 飞书字段映射（字段名以实际表格为准，这里给出常用命名）：
--   日期              → record_date
--   店铺              → shop
--   成交客服          → staff_name
--   产品类型          → product_type
--   第一单订单号      → first_order_no
--   第二单订单号      → second_order_no
--   第一单状态        → first_order_status
--   第一单金额        → first_amount
--   第二单金额        → second_amount
--   合计金额          → total_amount
--   质检确认          → qc_confirmed
-- ============================================

CREATE TABLE IF NOT EXISTS cross_sales (
  id BIGSERIAL PRIMARY KEY,
  record_date DATE NOT NULL,               -- 日期（飞书「日期」字段）
  shop TEXT,                               -- 店铺
  staff_name TEXT NOT NULL,                -- 成交客服
  product_type TEXT,                       -- 产品类型
  first_order_no TEXT,                     -- 第一单订单号
  second_order_no TEXT,                    -- 第二单订单号
  first_order_status TEXT,                 -- 第一单状态
  first_amount NUMERIC(12,2) DEFAULT 0,    -- 第一单金额
  second_amount NUMERIC(12,2) DEFAULT 0,     -- 第二单金额
  total_amount NUMERIC(12,2) DEFAULT 0,      -- 合计金额
  qc_confirmed BOOLEAN DEFAULT FALSE,        -- 质检确认
  feishu_record_id TEXT,                   -- 飞书记录ID（同步匹配用）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(record_date, first_order_no, second_order_no)
);

-- RLS
ALTER TABLE cross_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "所有人可查看连带成交数据" ON cross_sales;
CREATE POLICY "所有人可查看连带成交数据" ON cross_sales
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "管理员可管理连带成交数据" ON cross_sales;
CREATE POLICY "管理员可管理连带成交数据" ON cross_sales
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','leader'))
  );

-- 索引
CREATE INDEX IF NOT EXISTS idx_cross_sales_date ON cross_sales(record_date);
CREATE INDEX IF NOT EXISTS idx_cross_sales_staff ON cross_sales(staff_name);
CREATE INDEX IF NOT EXISTS idx_cross_sales_month ON cross_sales((date_trunc('month', record_date)));

-- Realtime（安全写法：已存在则跳过）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cross_sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cross_sales;
  END IF;
END
$$;
