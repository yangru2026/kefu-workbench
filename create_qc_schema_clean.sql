-- ============================================================
-- 质检工具【干净版】建表脚本（一次性创建全部表 + RLS + 存储桶策略）
-- 执行位置：Supabase 控制台 → SQL Editor（管理员身份）
-- 适用场景：reset_qc_all.sql 清空后，用本文件从零建回干净结构
-- 设计要点：qc_images 用 record_id 外键硬绑定，路径自带记录编号，图片绝不丢失
-- ============================================================

-- ---------- 1. 主表 qc_records ----------
CREATE TABLE IF NOT EXISTS qc_records (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff            TEXT NOT NULL,
  customer_id      TEXT DEFAULT '',
  shop             TEXT DEFAULT '',
  date             TEXT NOT NULL,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  severity         TEXT DEFAULT '一般',
  scene            TEXT DEFAULT '',
  reply            TEXT DEFAULT '',
  problem          TEXT,
  correct          TEXT DEFAULT '',
  knowledge        TEXT DEFAULT '',
  note             TEXT DEFAULT '',
  scene_images     TEXT[] NOT NULL DEFAULT '{}',
  reply_images     TEXT[] NOT NULL DEFAULT '{}',
  knowledge_images TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT DEFAULT 'pending',     -- pending | done
  coach_date       TEXT DEFAULT '',
  coach_note       TEXT DEFAULT '',
  penalty_amount   NUMERIC DEFAULT 0,
  received_at      TIMESTAMPTZ,
  received_by      TEXT DEFAULT '',
  created_by       TEXT DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- 2. 图片权威关系表 qc_images ----------
CREATE TABLE IF NOT EXISTS qc_images (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id  BIGINT NOT NULL REFERENCES qc_records(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('scene','reply','knowledge')),
  seq        INT NOT NULL DEFAULT 0,
  file_path  TEXT NOT NULL,             -- rec/<record_id>/<kind>-<时间戳>-<随机>.jpg
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_images_path_kind ON qc_images(record_id, kind, file_path);
CREATE INDEX IF NOT EXISTS idx_qc_images_record ON qc_images(record_id, kind, seq);

-- ---------- 3. 图片快照（状态变更前自动备份，防清空） ----------
CREATE TABLE IF NOT EXISTS qc_image_snapshots (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id   BIGINT NOT NULL REFERENCES qc_records(id) ON DELETE CASCADE,
  scene_images     TEXT[] NOT NULL DEFAULT '{}',
  reply_images     TEXT[] NOT NULL DEFAULT '{}',
  knowledge_images TEXT[] NOT NULL DEFAULT '{}',
  status_before TEXT,
  triggered_by  TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- 4. 分享 / 反馈 qc_shares ----------
CREATE TABLE IF NOT EXISTS qc_shares (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token            TEXT NOT NULL UNIQUE,
  staff            TEXT NOT NULL,
  record_ids       BIGINT[] NOT NULL DEFAULT '{}',
  record_count     INT DEFAULT 0,
  created_by       TEXT DEFAULT '',
  auto_confirm_hours INT DEFAULT 48,
  due_at           TIMESTAMPTZ,
  confirmed_at     TIMESTAMPTZ,
  auto_confirmed   BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- 5. 站内通知 notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  type       TEXT DEFAULT 'qc_confirm',
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ============================================================
-- RLS（内部工具：登录用户可读写；图片公开读供反馈页）
-- ============================================================
ALTER TABLE qc_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_images         ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_image_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_shares         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;

-- qc_records：登录用户可读写（管理动作由前端 isAdmin 控制）
DROP POLICY IF EXISTS "qc_records_all_authed" ON qc_records;
CREATE POLICY "qc_records_all_authed" ON qc_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- qc_images：公开读（反馈页 anon 身份需读）+ 登录用户可写
DROP POLICY IF EXISTS "qc_images_public_read" ON qc_images;
CREATE POLICY "qc_images_public_read" ON qc_images FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "qc_images_authed_write" ON qc_images;
CREATE POLICY "qc_images_authed_write" ON qc_images FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- qc_image_snapshots：登录用户可读写
DROP POLICY IF EXISTS "qc_snapshots_all_authed" ON qc_image_snapshots;
CREATE POLICY "qc_snapshots_all_authed" ON qc_image_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- qc_shares：公开读（反馈页 anon 需读 token）+ 登录用户可写
DROP POLICY IF EXISTS "qc_shares_public_read" ON qc_shares;
CREATE POLICY "qc_shares_public_read" ON qc_shares FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "qc_shares_authed_write" ON qc_shares;
CREATE POLICY "qc_shares_authed_write" ON qc_shares FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- notifications：用户只看自己的；登录用户可写（发通知）
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_insert_authed" ON notifications;
CREATE POLICY "notif_insert_authed" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 存储桶 qc-images 策略（公开读，登录用户可写）
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('qc-images', 'qc-images', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "qc-images public read" ON storage.objects;
CREATE POLICY "qc-images public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'qc-images');
DROP POLICY IF EXISTS "qc-images authed write" ON storage.objects;
CREATE POLICY "qc-images authed write" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'qc-images') WITH CHECK (bucket_id = 'qc-images');

-- ============================================================
-- 校验
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'qc_%') AS qc表数,
  (SELECT COUNT(*) FROM storage.buckets WHERE id='qc-images') AS 存储桶数;
