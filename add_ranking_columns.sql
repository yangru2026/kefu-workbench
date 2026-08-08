-- ============================================
-- 客服排名表新增字段：接待量、询单人数、付款人数
-- ============================================

-- 新增三个字段
ALTER TABLE ranking_data ADD COLUMN IF NOT EXISTS visitors INTEGER DEFAULT 0;
ALTER TABLE ranking_data ADD COLUMN IF NOT EXISTS inquiry_count INTEGER DEFAULT 0;
ALTER TABLE ranking_data ADD COLUMN IF NOT EXISTS payment_count INTEGER DEFAULT 0;

-- 注释
COMMENT ON COLUMN ranking_data.visitors IS '接待量';
COMMENT ON COLUMN ranking_data.inquiry_count IS '询单人数';
COMMENT ON COLUMN ranking_data.payment_count IS '付款人数';
