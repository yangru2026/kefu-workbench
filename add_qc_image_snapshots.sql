-- 质检记录图片链接快照表
-- 用途：在 markDone/markPending 等会修改记录状态的操作前，自动保存当时的图片链接
-- 这样即使未来代码 bug 把 qc_records 的图片数组清空，也能从快照恢复

CREATE TABLE IF NOT EXISTS qc_image_snapshots (
  id bigint generated always as identity primary key,
  record_id bigint not null references qc_records(id) on delete cascade,
  scene_images text[] not null default '{}',
  reply_images text[] not null default '{}',
  knowledge_images text[] not null default '{}',
  status_before text,
  triggered_by text not null default '',
  created_at timestamptz not null default now()
);

-- 索引：按记录查快照、按时间查最近快照
CREATE INDEX IF NOT EXISTS idx_qc_image_snapshots_record_id ON qc_image_snapshots(record_id);
CREATE INDEX IF NOT EXISTS idx_qc_image_snapshots_created_at ON qc_image_snapshots(created_at);

-- RLS：默认所有人可读；写入/删除仅 admin/leader/service_role
ALTER TABLE qc_image_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_image_snapshots_select_all" ON qc_image_snapshots;
CREATE POLICY "qc_image_snapshots_select_all"
  ON qc_image_snapshots FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "qc_image_snapshots_write_admin" ON qc_image_snapshots;
CREATE POLICY "qc_image_snapshots_write_admin"
  ON qc_image_snapshots FOR ALL
  USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','leader')
  ))
  WITH CHECK (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','leader')
  ));
