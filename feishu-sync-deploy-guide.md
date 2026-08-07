# 飞书多维表格同步部署指南

本指南将帮助你把飞书多维表格中的花色素材数据自动同步到客服工作台。

## 架构说明

```
飞书多维表格（你维护数据）
       ↓ 事件订阅 / 手动触发
Supabase Edge Function（中转服务）
       ↓ REST API
Supabase pattern_assets 表（工作台读取）
       ↓ Realtime
客服工作台（自动刷新）
```

**为什么需要 Edge Function？** 飞书的 App Secret 不能放在前端（会泄露），需要后端代理来获取飞书 API 令牌并拉取数据。

---

## 第一步：创建飞书自建应用

1. 打开 [飞书开放平台](https://open.feishu.cn/app) → 创建企业自建应用
2. 填写应用名称（如"花色素材同步"）和描述
3. 进入应用 → **凭证与基础信息** → 记下：
   - **App ID**（如 `cli_a1b2c3d4...`）
   - **App Secret**（如 `aB3cD4eF5gH6...`）

4. 进入 **权限管理** → 添加以下权限：
   - `bitable:app`（多维表格读写）
   - `bitable:app:readonly`（多维表格只读，保险加上）

5. 进入 **事件与回调** → **事件配置**：
   - 请求地址：填入 Edge Function 部署后的 URL（第四步部署后再填）
   - 添加事件：`drive.file.bitable_record_changed_v1`（多维表格记录变更）

6. 发布应用（版本管理 → 创建版本 → 申请发布）

---

## 第二步：创建飞书多维表格

1. 在飞书中新建一个**多维表格**（不是电子表格）
2. 按照 `pattern_assets` 表结构创建字段：

| 字段名称 | 字段类型 | 说明 |
|---------|---------|------|
| 花色名称 | 文本 | 必填，如"玻璃娃娃" |
| 品牌 | 单选 | 弥生 / 极氧 |
| 抛型 | 单选 | 日抛 / 月抛 / 季抛 / 半年抛 / 年抛 |
| 系列 | 单选 | 如"少女漫-日抛"、"随便花系列" |
| 色系 | 文本 | 如"棕"、"黑灰"、"蓝" |
| 直径 | 文本 | 如"14.5" |
| 着色直径 | 文本 | 如"14" |
| 材质 | 文本 | 如"硅水凝胶" |
| 氧透率 | 文本 | 如"100dk" |
| 含水量 | 文本 | 如"58%" |
| 规格 | 文本 | 如"6片/盒" |
| 花色图URL | 文本 | 图片完整URL（https://...） |
| 上眼图URL | 文本 | 图片完整URL（https://...） |
| 推荐话术 | 文本 | 多行文本也行 |
| 是否下架 | 复选框 | 勾选=已下架 |

> **图片URL说明**：多维表格的附件字段返回的是 file_token，前端无法直接访问。因此图片请使用**文本字段**存储图片的完整 URL（如已上传到 GitHub Pages 的图片路径 `images/patterns/xxx.jpg`，或外部图床 URL）。

3. 录入数据（可从现有 Excel 导入）
4. 从多维表格 URL 中获取两个关键参数：
   - **app_token**：URL 中 `/base/` 后面的部分
     - 例：`https://xxx.feishu.cn/base/BASExxxxxxxxxx?table=tblYYYY`
     - app_token = `BASExxxxxxxxxx`
   - **table_id**：URL 中 `?table=` 后面的部分
     - table_id = `tblYYYY`

5. **重要**：在多维表格右上角「...」→「添加文档应用」→ 搜索你创建的自建应用名称 → 添加为协作者（否则应用无权读取数据）

---

## 第三步：执行数据库 SQL

在 [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor 中执行 `feishu_sync_migration.sql`：

```sql
-- 1. 添加飞书记录 ID 字段
ALTER TABLE pattern_assets
  ADD COLUMN IF NOT EXISTS feishu_record_id TEXT;

-- 2. 去重并创建唯一约束
DELETE FROM pattern_assets a USING pattern_assets b
  WHERE a.brand = b.brand AND a.name = b.name AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pattern_assets_name_brand
  ON pattern_assets (name, brand);
```

同时确保 `is_discontinued` 字段已添加（如果之前没执行过 `add_discontinued_column.sql`）：
```sql
ALTER TABLE pattern_assets
  ADD COLUMN IF NOT EXISTS is_discontinued boolean NOT NULL DEFAULT false;
```

---

## 第四步：部署 Edge Function

### 4.1 安装 Supabase CLI（如未安装）

```bash
# macOS
brew install supabase/tap/supabase

# Windows (PowerShell)
scoop bucket add supabase https://github.com/supabase/scooping
scoop install supabase

# 或通过 npm
npm install -g supabase
```

### 4.2 登录并关联项目

```bash
supabase login
# 在项目根目录执行
supabase link --project-ref ienmejlxukhrxjjxvfqf
```

### 4.3 配置环境变量（Secrets）

```bash
supabase secrets set \
  FEISHU_APP_ID=你的App_ID \
  FEISHU_APP_SECRET=你的App_Secret \
  FEISHU_BITABLE_APP_TOKEN=你的app_token \
  FEISHU_BITABLE_TABLE_ID=你的table_id \
  SYNC_AUTH_TOKEN=自定义一个随机字符串
```

> **SYNC_AUTH_TOKEN**：自定义一个随机字符串（如 `sk_sync_a8f3k2...`），前端调用同步时需要带上这个 token 鉴权。

也可以在 Supabase Dashboard → Edge Functions → 你的函数 → Secrets 页面手动添加。

### 4.4 部署函数

```bash
# 在项目根目录执行
supabase functions deploy feishu-sync
```

部署成功后，函数 URL 格式为：
```
https://ienmejlxukhrxjjxvfqf.supabase.co/functions/v1/feishu-sync
```

### 4.5 测试函数

```bash
# 手动触发同步
curl -X POST https://ienmejlxukhrxjjxvfqf.supabase.co/functions/v1/feishu-sync \
  -H "Authorization: Bearer 你的SYNC_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"sync"}'
```

预期返回：
```json
{
  "ok": true,
  "message": "同步完成",
  "total_in_feishu": 176,
  "synced": 176,
  "timestamp": "2026-07-31T..."
}
```

---

## 第五步：配置飞书事件订阅（自动同步）

1. 回到飞书开放平台 → 你的应用 → **事件与回调**
2. 请求地址填入：
   ```
   https://ienmejlxukhrxjjxvfqf.supabase.co/functions/v1/feishu-sync
   ```
3. 飞书会发送验证请求（challenge），Edge Function 已自动处理
4. 添加事件：`drive.file.bitable_record_changed_v1`
5. 保存后，每次在多维表格中增删改记录，飞书会自动通知 Edge Function 执行同步

> **注意**：飞书事件订阅有重试机制，如果 Edge Function 响应超时（>3秒）会重试。首次同步数据量大时可能较慢，建议先手动触发一次全量同步。

---

## 第六步：工作台配置

Edge Function 部署后，工作台花色素材页面顶部会出现「🔄 从飞书同步」按钮（管理员可见）。

你需要在 `index.html` 中配置 Edge Function URL 和 AUTH TOKEN。代码中已内置默认值，如果需要修改：

找到 `syncFromFeishu()` 函数，修改其中的：
```javascript
const EDGE_FUNCTION_URL = 'https://ienmejlxukhrxjjxvfqf.supabase.co/functions/v1/feishu-sync';
const SYNC_AUTH_TOKEN = '你的SYNC_AUTH_TOKEN';
```

---

## 字段映射对照表

| 飞书多维表格字段 | Supabase pattern_assets 列 | 说明 |
|----------------|--------------------------|------|
| 花色名称 | name | 必填 |
| 品牌 | brand | 弥生/极氧 |
| 抛型 | type | 日抛/半年抛等 |
| 系列 | series | 系列名称 |
| 色系 | color | 颜色描述 |
| 直径 | diameter | 如 14.5 |
| 着色直径 | color_diameter | 如 14 |
| 材质 | material | 如 硅水凝胶 |
| 氧透率 | oxygen | 如 100dk |
| 含水量 | water | 如 58% |
| 规格 | spec | 如 6片/盒 |
| 花色图URL | lens_img | 图片完整URL |
| 上眼图URL | eye_img | 图片完整URL |
| 推荐话术 | description | 销售话术 |
| 是否下架 | is_discontinued | 复选框 |
| (自动) | feishu_record_id | 飞书记录ID，同步时自动写入 |

---

## 同步逻辑说明

1. **新增**：飞书中新增记录 → 同步后自动插入 Supabase
2. **修改**：飞书中修改记录 → 同步后自动更新 Supabase（按 name+brand 匹配）
3. **删除**：飞书中删除记录 → 同步后在 Supabase 中标记为「已下架」（不会真正删除，保留历史数据）
4. **下架标记**：飞书中勾选「是否下架」→ 同步后 `is_discontinued = true`，工作台自动归入「📦 下架花色」分类

---

## 常见问题

### Q: 同步报错"获取 token 失败"
A: 检查 FEISHU_APP_ID 和 FEISHU_APP_SECRET 是否正确

### Q: 同步报错"拉取记录失败: permission denied"
A: 多维表格未添加应用为协作者。在多维表格中「...」→「添加文档应用」→ 搜索你的应用名称

### Q: 图片不显示
A: 多维表格中图片字段必须是**文本类型**存储完整URL，不能用附件类型。附件类型的图片前端无法直接访问

### Q: 事件订阅验证失败
A: 确保 Edge Function 已部署且正常运行。飞书会发送 `{"type":"url_verification","challenge":"xxx"}`，函数需返回 `{"challenge":"xxx"}`

### Q: 同步后工作台没刷新
A: 工作台使用 Supabase Realtime 自动监听 pattern_assets 表变更，数据写入后会自动刷新。如果没刷新，检查 Realtime 是否已开启：
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE pattern_assets;
```
