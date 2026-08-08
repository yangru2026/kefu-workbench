-- ============================================
-- 飞书多表同步 - 数据库迁移脚本
-- ============================================
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
--
-- 新建表：
--   1. schedule_data    排班数据（替代 config.json 硬编码）
--   2. presale_monthly  售前月度数据（A/B/C 三组按月汇总）
--
-- 修改表：
--   3. ranking_data     客服排名（增加 staff_name + feishu_record_id，支持飞书同步）
-- ============================================

-- ============================================
-- 1. 排班数据表
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_data (
  id BIGSERIAL PRIMARY KEY,
  month_key TEXT NOT NULL,              -- 月份 'YYYY-MM' 如 '2026-08'
  staff_name TEXT NOT NULL,             -- 客服姓名
  group_name TEXT NOT NULL,             -- 组别 'A组'/'B组'/'C组'
  schedule JSONB NOT NULL DEFAULT '{}', -- 排班 {"1":"早班","2":"休息",...}
  feishu_record_id TEXT,                -- 飞书记录ID（用于同步匹配）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month_key, staff_name)
);

-- RLS
ALTER TABLE schedule_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "所有人可查看排班数据" ON schedule_data;
CREATE POLICY "所有人可查看排班数据" ON schedule_data
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "管理员可管理排班数据" ON schedule_data;
CREATE POLICY "管理员可管理排班数据" ON schedule_data
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','leader'))
  );

-- 索引
CREATE INDEX IF NOT EXISTS idx_schedule_data_month ON schedule_data(month_key);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_data;


-- ============================================
-- 2. 售前月度数据表
-- ============================================
CREATE TABLE IF NOT EXISTS presale_monthly (
  id BIGSERIAL PRIMARY KEY,
  period_month TEXT NOT NULL,           -- 月份 'YYYY-MM' 如 '2026-08'
  group_name TEXT NOT NULL,             -- 组别 'A组'/'B组'/'C组'
  visitors INTEGER DEFAULT 0,           -- 接待量
  orders INTEGER DEFAULT 0,             -- 成交单数
  revenue NUMERIC(12,2) DEFAULT 0,      -- 销售额（元）
  conversion NUMERIC(5,2) DEFAULT 0,    -- 转化率（%）
  avg_response INTEGER DEFAULT 0,       -- 平均响应时间（秒）
  satisfaction NUMERIC(5,2) DEFAULT 0,  -- 满意度（%）
  cross_sales NUMERIC(12,2) DEFAULT 0,  -- 连带销售额（元）
  visitor_count INTEGER DEFAULT 0,      -- 接待人数
  inquiry_count INTEGER DEFAULT 0,      -- 询单人数
  payment_count INTEGER DEFAULT 0,      -- 付款人数
  feishu_record_id TEXT,                -- 飞书记录ID
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_month, group_name)
);

-- RLS
ALTER TABLE presale_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "所有人可查看售前月度数据" ON presale_monthly;
CREATE POLICY "所有人可查看售前月度数据" ON presale_monthly
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "管理员可管理售前月度数据" ON presale_monthly;
CREATE POLICY "管理员可管理售前月度数据" ON presale_monthly
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','leader'))
  );

-- 索引
CREATE INDEX IF NOT EXISTS idx_presale_monthly_period ON presale_monthly(period_month);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE presale_monthly;


-- ============================================
-- 3. 客服排名表（修改已有表）
-- ============================================

-- 3.1 user_id 改为可空（飞书同步的数据没有 user_id）
ALTER TABLE ranking_data ALTER COLUMN user_id DROP NOT NULL;

-- 3.2 添加 staff_name 字段
ALTER TABLE ranking_data ADD COLUMN IF NOT EXISTS staff_name TEXT;

-- 3.3 添加 feishu_record_id 字段
ALTER TABLE ranking_data ADD COLUMN IF NOT EXISTS feishu_record_id TEXT;

-- 3.4 添加 created_at 字段（原表可能没有）
ALTER TABLE ranking_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3.5 新增唯一约束：同月同人唯一（飞书同步用）
CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_data_staff_period
  ON ranking_data (staff_name, period)
  WHERE staff_name IS NOT NULL;

-- 3.6 确保已有 RLS 策略（原表应该已有，这里兜底）
DROP POLICY IF EXISTS "所有人可查看排名数据" ON ranking_data;
CREATE POLICY "所有人可查看排名数据" ON ranking_data
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "管理员可管理排名数据" ON ranking_data;
CREATE POLICY "管理员可管理排名数据" ON ranking_data
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','leader'))
  );

-- 3.7 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ranking_data;
