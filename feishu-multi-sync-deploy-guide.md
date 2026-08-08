# 飞书多表同步 - 完整部署指南

> 本指南指导你完成排班表、客服排名、售前月度数据的飞书同步功能部署。
> 花色素材的飞书同步已有，本指南将其扩展为支持四张表同步。

---

## 总览

需要完成的步骤：

| 步骤 | 操作位置 | 说明 |
|------|---------|------|
| 1 | 飞书 | 创建 3 张多维表格（排班/排名/售前月度） |
| 2 | Supabase | 执行 SQL 迁移脚本（建表） |
| 3 | Supabase | 部署 Edge Function（多表同步） |
| 4 | Supabase | 配置环境变量（飞书凭证 + 4个 table_id） |
| 5 | 前端代码 | 配置 SYNC_AUTH_TOKEN |

---

## 步骤 1：创建飞书多维表格

参照 `feishu-tables-design.md` 文档，在飞书中创建 3 张数据表：

1. **排班表** - 月份/姓名/组别/1日~31日
2. **客服排名** - 月份/姓名/组别/转化率/连带销售额/满意度/响应时间
3. **售前月度数据** - 月份/组别/接待量/成交单数/销售额/转化率/响应时间/满意度/连带销售额/接待人数/询单人数/付款人数

创建完成后，从浏览器 URL 中记录每张表的 `table_id`：

```
https://xxx.feishu.cn/base/XXXXXXXXXXXXXX?table=YYYYYYYYYY
                                   ↑                    ↑
                              app_token            table_id
```

---

## 步骤 2：执行 SQL 迁移脚本

1. 打开 Supabase Dashboard → SQL Editor
2. 新建 Query
3. 粘贴 `feishu_multi_sync_migration.sql` 的全部内容
4. 点击 Run 执行

此脚本会：
- 创建 `schedule_data` 表（排班数据）
- 创建 `presale_monthly` 表（售前月度数据）
- 修改 `ranking_data` 表（添加 staff_name、feishu_record_id 字段）
- 为三个表配置 RLS 策略和 Realtime 发布

---

## 步骤 3：部署 Edge Function

### 3.1 安装 Supabase CLI（如果尚未安装）

```bash
npm install -g supabase
```

### 3.2 登录并链接项目

```bash
supabase login
supabase link --project-ref ienmejlxukhrxjjxvfqf
```

### 3.3 部署

在项目根目录执行：

```bash
supabase functions deploy feishu-sync
```

> Edge Function 代码在 `supabase/functions/feishu-sync/index.ts`，已改造为支持多表同步。

---

## 步骤 4：配置环境变量

在 Supabase Dashboard → Edge Functions → feishu-sync → Secrets 中配置：

### 必需变量（花色素材已有，确认即可）

| 变量名 | 说明 |
|--------|------|
| `FEISHU_APP_ID` | 飞书自建应用 App ID |
| `FEISHU_APP_SECRET` | 飞书自建应用 App Secret |
| `FEISHU_BITABLE_APP_TOKEN` | 多维表格 app_token |
| `SYNC_AUTH_TOKEN` | 自定义鉴权 token（自己设一个随机字符串） |

### 新增变量（排班/排名/售前月度）

| 变量名 | 说明 |
|--------|------|
| `FEISHU_PATTERN_TABLE_ID` | 花色素材表的 table_id |
| `FEISHU_SCHEDULE_TABLE_ID` | 排班表的 table_id |
| `FEISHU_RANKING_TABLE_ID` | 客服排名表的 table_id |
| `FEISHU_PRESALE_TABLE_ID` | 售前月度表的 table_id |

### 配置命令（CLI 方式）

```bash
supabase secrets set \
  FEISHU_APP_ID=你的AppID \
  FEISHU_APP_SECRET=你的AppSecret \
  FEISHU_BITABLE_APP_TOKEN=你的AppToken \
  FEISHU_PATTERN_TABLE_ID=花色素材TableID \
  FEISHU_SCHEDULE_TABLE_ID=排班表TableID \
  FEISHU_RANKING_TABLE_ID=客服排名TableID \
  FEISHU_PRESALE_TABLE_ID=售前月度TableID \
  SYNC_AUTH_TOKEN=你的自定义Token
```

> **注意**：原来的 `FEISHU_BITABLE_TABLE_ID` 已被 `FEISHU_PATTERN_TABLE_ID` 替代。如果原来已配置了 `FEISHU_BITABLE_TABLE_ID`，请将其值复制到 `FEISHU_PATTERN_TABLE_ID`。

---

## 步骤 5：配置前端代码

在 `index.html` 中找到 `FEISHU_SYNC_CONFIG`，将 `authToken` 设置为步骤 4 中配置的 `SYNC_AUTH_TOKEN` 值：

```javascript
const FEISHU_SYNC_CONFIG = {
  edgeFunctionUrl: 'https://ienmejlxukhrxjjxvfqf.supabase.co/functions/v1/feishu-sync',
  authToken: '你的SYNC_AUTH_TOKEN值'  // ← 填入这里
};
```

配置后提交并推送到 GitHub Pages。

---

## 步骤 6：飞书侧配置

### 6.1 确保自建应用权限

飞书开放平台 → 你的自建应用 → 权限管理，确保已开通：
- `bitable:app` - 多维表格读写

### 6.2 添加应用为多维表格协作者

在飞书多维表格中：
1. 右上角「...」→「添加文档应用」
2. 搜索你的自建应用名称
3. 添加为协作者

> **重要**：每个数据表都需要确保应用有访问权限。如果多个数据表在同一个多维表格中，添加一次即可。

### 6.3 （可选）配置事件订阅

如果需要自动同步（飞书表格修改后自动同步到工作台）：

1. 飞书开放平台 → 事件订阅
2. 请求地址填入：`https://ienmejlxukhrxjjxvfqf.supabase.co/functions/v1/feishu-sync`
3. 订阅事件：`drive.file.bitable_record_changed_v1`

> 不配置事件订阅也不影响使用，管理员可以在工作台手动点击「从飞书同步」按钮。

---

## 使用方式

### 排班表

1. 在飞书排班表中录入/修改排班数据
2. 工作台排班表页面点击「🔄 从飞书同步」
3. 数据自动同步并刷新
4. 管理员也可以直接在工作台点击单元格修改（自动保存到 Supabase）

### 客服排名

1. 在飞书客服排名表中录入数据
2. 工作台客服排名页面点击「🔄 从飞书同步」
3. 使用月份选择器查看不同月份数据
4. 管理员可以点击「✎ 编辑数据」直接编辑，完成后点击「💾 保存」

### 售前月度数据

1. 在飞书售前月度表中录入数据
2. 工作台售前数据页面切换到「📅 月度汇总」tab
3. 点击「🔄 从飞书同步」
4. 使用上月/下月按钮切换查看不同月份
5. 管理员可以点击「✎ 编辑/补录」直接编辑或补录历史数据，完成后点击「💾 保存」

---

## 验证检查清单

- [ ] 飞书 3 张多维表格已创建，字段名和文档一致
- [ ] Supabase SQL 迁移已执行成功
- [ ] Edge Function 已部署
- [ ] 所有环境变量已配置
- [ ] 前端 `FEISHU_SYNC_CONFIG.authToken` 已填入
- [ ] 飞书自建应用已添加为多维表格协作者
- [ ] 排班表同步按钮可正常同步
- [ ] 客服排名同步按钮可正常同步
- [ ] 售前月度同步按钮可正常同步
- [ ] 排班表单元格编辑可保存
- [ ] 客服排名编辑保存可正常工作
- [ ] 售前月度编辑/补录保存可正常工作

---

## 常见问题

### Q: 同步报错"未配置 FEISHU_SCHEDULE_TABLE_ID"

A: 说明排班表的 table_id 未配置。检查 Supabase Edge Function Secrets 中是否设置了 `FEISHU_SCHEDULE_TABLE_ID`。

### Q: 同步报错"拉取记录失败"

A: 检查飞书自建应用是否已添加为多维表格的协作者。

### Q: 同步成功但工作台没有数据

A: 检查飞书表格中的数据是否填写了必填字段（排班表需要月份+姓名，排名需要姓名+月份，售前月度需要月份+组别）。

### Q: 点击同步按钮提示"请先配置飞书同步参数"

A: 前端 `FEISHU_SYNC_CONFIG.authToken` 未填入。在 index.html 中找到该配置，填入 `SYNC_AUTH_TOKEN` 的值。
