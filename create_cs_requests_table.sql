-- 客服申请审批系统
-- 支持: 换班(shift_swap) / 加班(overtime) / 调休(compensatory_leave)
-- 审批通过后自动联动: 换班→更新排班表, 加班→累计加班时长, 调休→扣减调休时长

CREATE TABLE IF NOT EXISTS cs_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('shift_swap', 'overtime', 'compensatory_leave')),
  requester_id uuid,
  requester_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  target_date date NOT NULL,
  shift_from text,
  shift_to text,
  hours numeric,
  reason text,
  reviewer_id uuid,
  reviewer_name text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 按状态和创建时间查询的索引
CREATE INDEX IF NOT EXISTS idx_cs_requests_status ON cs_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_requests_requester ON cs_requests(requester_id, created_at DESC);

ALTER TABLE cs_requests ENABLE ROW LEVEL SECURITY;

-- 所有登录用户可查看全部申请（审批需要看到所有人的）
CREATE POLICY "cs_requests_select_all" ON cs_requests
  FOR SELECT TO authenticated USING (true);

-- 所有登录用户可新增申请
CREATE POLICY "cs_requests_insert_all" ON cs_requests
  FOR INSERT TO authenticated WITH CHECK (true);

-- 仅管理员/组长可更新（审批操作）
CREATE POLICY "cs_requests_update_admin" ON cs_requests
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'leader'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'leader'))
  );
