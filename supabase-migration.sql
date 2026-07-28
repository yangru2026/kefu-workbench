-- ============================================
-- 尤赫客服工作台 - Supabase 数据库初始化
-- 请复制全部内容到 Supabase SQL Editor 执行
-- ============================================

-- 1. 用户资料表（扩展 auth.users）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  group_name TEXT DEFAULT '',
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'leader')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 公告栏
CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 日报表
CREATE TABLE IF NOT EXISTS daily_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, report_date)
);

-- 4. 客服排名数据
CREATE TABLE IF NOT EXISTS ranking_data (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  cross_sales NUMERIC(12,2) DEFAULT 0,
  satisfaction NUMERIC(5,2) DEFAULT 0,
  response_time INTEGER DEFAULT 0,
  period TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period)
);

-- 5. 售前数据汇总
CREATE TABLE IF NOT EXISTS presale_data (
  id BIGSERIAL PRIMARY KEY,
  record_date DATE NOT NULL UNIQUE,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ 开启 Realtime (实时同步) ============
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE ranking_data;
ALTER PUBLICATION supabase_realtime ADD TABLE presale_data;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- ============ RLS 安全策略 ============

-- profiles: 自己可读写
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允许查看所有用户资料" ON profiles FOR SELECT USING (true);
CREATE POLICY "允许更新自己的资料" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "允许注册时创建资料" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- announcements: 所有人可读，管理员可写
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "所有人可查看公告" ON announcements FOR SELECT USING (true);
CREATE POLICY "管理员可创建公告" ON announcements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'))
);
CREATE POLICY "管理员可更新公告" ON announcements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'))
);
CREATE POLICY "管理员可删除公告" ON announcements FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'))
);

-- daily_reports: 自己可读写，领导可读所有人
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "查看自己的日报" ON daily_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "领导可查看全组日报" ON daily_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'))
);
CREATE POLICY "创建自己的日报" ON daily_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "更新自己的日报" ON daily_reports FOR UPDATE USING (auth.uid() = user_id);

-- ranking_data: 所有人可读，管理员可写
ALTER TABLE ranking_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "所有人可查看排名" ON ranking_data FOR SELECT USING (true);
CREATE POLICY "管理员可管理排名" ON ranking_data FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'))
);

-- presale_data: 所有人可读，管理员可写
ALTER TABLE presale_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "所有人可查看售前数据" ON presale_data FOR SELECT USING (true);
CREATE POLICY "管理员可管理售前数据" ON presale_data FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'))
);

-- ============ 触发器：新用户注册自动创建 profile ============
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', '新客服'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.email),
    'staff'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============ 插入默认管理员 ============
-- 杨茹你需要先注册后，再手动改为 admin 角色
-- 注册后执行: UPDATE profiles SET role = 'admin' WHERE phone = '你的手机号';

-- ============ 插入示例公告 ============
INSERT INTO announcements (title, content, is_pinned) VALUES
('🎉 尤赫客服工作台正式上线！', '欢迎使用新版工作台，所有功能已升级为实时同步。\n\n📋 每日填写日报\n📢 关注首页公告\n📊 查看售前数据\n🏆 追踪客服排名\n\n如有问题请联系杨茹。', true),
('📝 日报填写提醒', '请各位客服每天下班前完成日报填写，记录当天工作情况和数据。日报将作为绩效考核参考依据。', false);
