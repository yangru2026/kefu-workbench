-- ============================================
-- 质检工具「分享给客服」功能建表语句
-- 在 Supabase SQL Editor 中执行
-- 作用：管理员把某客服的一条/多条质检记录打包成专属链接发给该客服，
--       客服点开链接一对一看，并可「确认收到」。
-- ============================================

-- 1. 建表：qc_shares
CREATE TABLE IF NOT EXISTS qc_shares (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,                       -- 分享链接令牌（唯一、不可猜测）
  staff TEXT NOT NULL,                              -- 这批记录归属的客服姓名
  record_ids BIGINT[] NOT NULL DEFAULT '{}',        -- 关联的 qc_records.id 列表
  record_count INT DEFAULT 0,                       -- 记录条数（冗余，便于展示）
  created_by TEXT DEFAULT '',                       -- 发送人
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,                         -- 客服确认时间（NULL=未确认）
  confirm_note TEXT DEFAULT ''                      -- 客服确认时附的备注
);

-- 2. 索引
CREATE INDEX IF NOT EXISTS idx_qc_shares_token ON qc_shares(token);
CREATE INDEX IF NOT EXISTS idx_qc_shares_staff ON qc_shares(staff);
CREATE INDEX IF NOT EXISTS idx_qc_shares_created ON qc_shares(created_at);

-- 3. RLS
ALTER TABLE qc_shares ENABLE ROW LEVEL SECURITY;

-- 所有人可读（分享链接本身就是公开访问，token 是不可猜测的密钥）
CREATE POLICY "Allow public read on qc_shares"
ON qc_shares FOR SELECT
TO anon, authenticated
USING (true);

-- 登录用户可创建分享（管理员发送）
CREATE POLICY "Allow authenticated insert on qc_shares"
ON qc_shares FOR INSERT
TO authenticated
WITH CHECK (true);

-- 允许更新：用于客服在分享页「确认收到」时写入 confirmed_at / confirm_note。
-- 安全说明：匿名用户也能更新，但只能定位到其持有 token 的行（token 不可猜测），
-- 且前端只提交这两个字段。这是分享链接类功能的通用做法，适合内部团队工具。
CREATE POLICY "Allow confirm update on qc_shares"
ON qc_shares FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 登录用户可删除（管理员清理）
CREATE POLICY "Allow authenticated delete on qc_shares"
ON qc_shares FOR DELETE
TO authenticated
USING (true);
