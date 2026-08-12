-- 页面协作者表
CREATE TABLE IF NOT EXISTS page_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL,                    -- 页面标识: patterns/training/schedule/ranking/presale/qc/staff-info
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_name TEXT,
  invited_by UUID REFERENCES profiles(id),
  invited_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 唯一约束：同一页面同一人不能重复邀请
CREATE UNIQUE INDEX IF NOT EXISTS page_collaborators_page_profile_key
  ON page_collaborators (page_key, profile_id);

-- RLS：所有人可查看（前端需要判断权限），仅 admin 可增删
ALTER TABLE page_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有人可查看协作者" ON page_collaborators
  FOR SELECT USING (true);

CREATE POLICY "管理员可管理协作者" ON page_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'leader')
    )
  );
