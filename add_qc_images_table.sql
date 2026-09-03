-- ============================================================
-- 质检工具 图片系统重做 · 第 1 步：建 qc_images 表
-- 在 Supabase 控制台 → SQL Editor 执行（管理员身份，绕过 RLS）
-- ============================================================
-- 【为什么要重做】
-- 旧结构：图片关系只存在 qc_records.scene_images / reply_images /
--         knowledge_images 三个 text[] 数组里；文件名 img_时间戳_随机串
--         本身不含任何"属于哪条记录"的信息。
--         → 一旦数组被误清空，图片和记录就彻底失联，只能靠上传时间猜，
--           必然出现张冠李戴（本次 38 条错配的根因）。
--
-- 新结构：qc_images 表用 record_id 外键硬绑定记录，且新上传的文件路径
--         本身就写入 record_id（rec/<record_id>/<kind>-<时间戳>.jpg）。
--         → 数据库和存储桶双向自证归属，结构上不可能再失联。
--         → 记录状态变更（标记已讲解/待讲解）只动 qc_records，绝不碰图片。
-- ============================================================

-- ---------- 1. 建表 ----------
CREATE TABLE IF NOT EXISTS qc_images (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- 硬外键：记录删除时图片行级联删除，永不产生"半失联"状态
  record_id   BIGINT NOT NULL REFERENCES qc_records(id) ON DELETE CASCADE,

  -- 图片归属哪个字段：场景截图 / 客服回复 / 知识点
  kind        TEXT NOT NULL CHECK (kind IN ('scene', 'reply', 'knowledge')),

  -- 同一字段内的显示顺序（0,1,2…）
  seq         INT NOT NULL DEFAULT 0,

  -- 存储桶 qc-images 内的完整相对路径
  --   新上传：rec/<record_id>/<kind>-<时间戳>-<随机>.jpg   ← 路径自带归属
  --   历史图：qc/img_<时间戳>_<随机>.jpg                   ← 旧的扁平路径
  file_path   TEXT NOT NULL,

  -- 可信度：ok=可信可展示  suspect=历史猜测匹配待人工核对  orphan=认领入库
  trust       TEXT NOT NULL DEFAULT 'ok'
              CHECK (trust IN ('ok', 'suspect', 'orphan')),

  -- 溯源信息（便于日后排查，非必填）
  uploaded_by TEXT DEFAULT '',
  source      TEXT DEFAULT 'upload',   -- upload / migrate / claim
  note        TEXT DEFAULT '',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- 2. 约束与索引 ----------
-- 同一张文件不允许在同一条记录的同一字段里重复挂载
CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_images_path_kind
  ON qc_images(record_id, kind, file_path);

-- 主查询路径：按记录批量取图
CREATE INDEX IF NOT EXISTS idx_qc_images_record
  ON qc_images(record_id, kind, seq);

-- 认领面板：按路径反查是否已被占用
CREATE INDEX IF NOT EXISTS idx_qc_images_file_path
  ON qc_images(file_path);

-- 核对面板：快速筛出待核对的可疑图
CREATE INDEX IF NOT EXISTS idx_qc_images_trust
  ON qc_images(trust);

-- ---------- 3. RLS（与 qc_records 现有策略保持一致） ----------
ALTER TABLE qc_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_images_public_read"   ON qc_images;
DROP POLICY IF EXISTS "qc_images_authed_write"  ON qc_images;

-- 所有人可读（分享链接 qc-share.html 走 anon 身份，必须可读）
CREATE POLICY "qc_images_public_read"
  ON qc_images FOR SELECT
  TO anon, authenticated
  USING (true);

-- 登录用户可增删改
CREATE POLICY "qc_images_authed_write"
  ON qc_images FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------- 4. 存储桶策略补充（新路径前缀 rec/） ----------
-- qc-images 桶已有的策略是按 bucket_id 放通的，新前缀 rec/ 自动继承，
-- 无需额外策略。此处仅做确认性重建，避免历史上被改窄。
DROP POLICY IF EXISTS "Allow public read on qc-images" ON storage.objects;
CREATE POLICY "Allow public read on qc-images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'qc-images');

-- ---------- 5. 校验 ----------
-- 执行完请运行下面这句，应返回 0 行（新表还没数据，属正常）
SELECT
  (SELECT COUNT(*) FROM qc_images)                          AS qc_images_行数,
  (SELECT COUNT(*) FROM qc_records)                         AS qc_records_行数,
  (SELECT COUNT(*) FROM storage.objects
    WHERE bucket_id = 'qc-images')                          AS 存储桶文件数;
