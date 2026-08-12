-- 客服申请审批 - 换班双方支持
ALTER TABLE cs_requests
  ADD COLUMN IF NOT EXISTS swap_partner_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS swap_partner_name TEXT,
  ADD COLUMN IF NOT EXISTS partner_shift_from TEXT,
  ADD COLUMN IF NOT EXISTS partner_shift_to TEXT;
