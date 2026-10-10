# 尤赫客服工作台 - 项目记忆

## 概况
- 前端：原生单文件 HTML/CSS/JS → GitHub Pages https://yangru2026.github.io/kefu-workbench/
- 后端：Supabase `ienmejlxukhrxjjxvfqf`（表/RLS/Storage/Edge Functions）
- 仓库：`yangru2026/kefu-workbench`（main）；茹姐会在 Supabase SQL Editor 手动跑 SQL
- 主题：**翡翠绿 #10B981 + 白底浅色侧边栏 + 冷白底 #F7F9F8**（index.html `:root`）。
  换侧边栏底色前 `grep var(--sidebar-bg)`，配 `color:#fff` 的组件要同步改。
  qc.html / qc-v2 / cs-qc 等独立质检页仍是旧绿主题（未同步）。

## 功能一览（新页面 = 独立 html + index.html iframe 接入 + admin-only-nav 控权限）
| 模块 | 文件 | 表 |
|---|---|---|
| 客服信息 / 加班调休 | index.html | `cs_info` `overtime_records` `compensatory_leave_records` |
| 培训资料 / 花色素材 | index.html | `training_materials` `pattern_assets` `*_categories` |
| 质检工具 | qc.html 系 | `qc_records` + `qc-images` bucket |
| 客服申请审批 | index.html | `cs_requests`（通过后联动排班/加班/调休） |
| 赠品编码查询 | `gift.html` | `gift_codes` + `gift-images` |
| 舆情转接登记 | `diversion.html` | `diversion_transfers` + `diversion-images` |
| 平台规则 | `rules.html` | `platform_rules`（预置 21 条） |
| 工作清单打卡 | `checklist.html` | `checkin_records`（清单项硬编码在页面数组） |
| 花色考核试卷 | `quiz.html` | 题库内联，35 题满分 100 |
| 考核成绩（仅 admin） | `quiz-results.html` | `quiz_results` |
| AI 提问 | index.html + Edge Fn `ai-ask` | `ai_questions` |
- 连带成交已下线（2026-09-12）：`cross_sales` 数据保留，页面 DOM/JS 仍在 index.html 未删。
- 飞书多表同步：排班表 / 客服排名 / 售前月度 / 连带成交，支持 Excel 导入。
- 舆情转接店铺口径 = 独立 11 家名单（抖音1-4店/拼多多1-5店/天猫弥生/天猫极氧），**勿与其他模块混用**。
- 工作清单来自 Excel《客服管理固定工作清单》售前管理页（日 8/周 9/月 11），绩效锚点暂定 28 号；售后 sheet 未做。
- **AI 提问已上线**（2026-10-10 / commit 91b2b4e）：`ARK_MODEL=doubao-seed-2-1-lite-260915`，
  已加 `thinking:{type:'disabled'}`（12~34s → **3.9s**，token 省 4 倍，质量不变）。
  ⚠️ 火山方舟**界面显示名不能调用**，必须带日期后缀的完整 ID；查法 `GET /api/v3/models`。
  换 Key/改函数走 Management API，见技能 `supabase-edge-fn-ops`。aiforce.cloud 方案已否决。

## 待开发
- 周报（每周数据汇总）；积分卡（客服积分/绩效）；审单统计

## ⚠️ 三条必读分叉
1. **index.html 双源码**：权威副本 `C:\temp\kefu_src\index.html`。改完必须
   `cp /c/temp/kefu_src/index.html index.html` 再提交；推前 `git fetch` 确认远端没被别的会话推过
   （2026-09-22 曾用旧版覆盖线上）。一致性校验用 `git rev-parse HEAD:index.html` 对比 GitHub
   commits API 的 `files[].sha`（**trees API 有缓存，别用**）。
2. **iframe 子页高度坑**：`.page.active{display:block}` 会让 inline `flex-direction:column` 失效 → iframe 塌成 150px。
   每加一个 iframe 子页必须：① CSS `#page-xxx.active{display:flex;height:100vh;overflow:hidden;}`
   ② 容器上加 `style="padding:0;overflow:hidden;flex-direction:column;"` ③ 懒加载分支
   ④ 菜单项 + `data-src` 版本号升版。
3. **独立页命名坑**：UMD SDK 占全局 `supabase`，禁止 `const supabase = createClient(...)`（整段脚本不执行），
   统一 `const sb = ...`；别撞已有 `data-page`（如 `quiz` 已被知识测验占用 → 花色考核用 `price-quiz`）。

## 花色素材图片链路（2026-09-24 大改）
- 图片源 = **同源 GitHub Pages 直连**，由 `toCdnUrl()` 统一规范；**绝不能再改回 jsDelivr**
  （jsDelivr 301 到 raw.githubusercontent，国内 12s 超时 → 首屏卡死）。
- 三级图：`thumb/`（卡片）/ `large/`、`hd/`（hover、灯箱）；`{品牌}_{系列}_{花色}_eye|_lens|_extra.webp`。
- ⚠️ 管理员重新上传图片只写 Storage、不生成缩略图 → 慢链路复现。清零三步：
  `SBP_TOKEN=xxx node outputs/gen-storage-thumbs.js` → git push → 跑生成的 SQL。
- ⚠️ `pattern_assets.id` 是 UUID，SQL 必须 `where id='<uuid>'` 带引号；孤儿缩略图**别按名字猜配对**。
- Storage 兜底：`toStorageRender()` 换 `/storage/v1/render/image/public/` + `?width=&quality=&format=webp&resize=contain`，
  `toThumbUrl()` 400px/q72。⚠️ 该端点 no-cache + 跨域，SW 缓存不到；是**付费功能**，4xx 要优雅退化。
- 性能配套：`PATTERN_PAGE_SIZE=20` 分页 + lazy + 首屏 6 张 high 优先级 + `kefu_cache_pattern_assets` 秒显。
- `sw.js`：`/images/` stale-while-revalidate，`IMG_CACHE='kefu-sw-img-v1'` 固定名不清空。
  ⚠️ fetch 分支 **isLib 必须排在 isImage 之前**；SW 只处理**同源**。
- 价格档：`pattern_assets.price_tier`/`diam_group`（直径≥14.5 自动预填大直径）；速查页 = 直径分组 × 价格档。

## 权限与 RLS
- `isAdminUser()`/`isFullAdmin()` → 仅 `role==='admin'`；`isQcRole()` → `admin||leader`。
  改「谁能进/改某功能」前先确认用哪一个；父页给 QC iframe 传 `setQcMode` 必须用 `isQcRole()`。
- **profiles 应有 4 条策略**：SELECT true / UPDATE `auth.uid()=id` / INSERT `auth.uid()=id` /
  **UPDATE `auth.uid()=id OR is_admin()`**（管理员改他人）。⚠️ **绝不能有** `管理员可查看所有成员`（递归源 42P17）；
  `is_admin()` 必须 `SECURITY DEFINER`。补丁：`fix_profiles_admin_update_policy.sql`。
- ⚠️ 写 RLS 策略的 `USING` 里**别直接 `SELECT FROM` 同一张表**，一律包 `SECURITY DEFINER` 函数。
- 待补：`offboardMember`/`restoreMember` 仍是不带 `.select()` 的老写法（被挡时会假报「已清退」）。
- 免 token 排查 RLS：用页面里的 `sb_publishable_…` 直连 REST，PATCH 真实行看返回体
  （`[]`=被挡 / `[{...}]`=放行）；读 `updated_at`、`rpc/is_admin` 交叉印证。

## Supabase 凭据与 Edge Function
- ⚠️ **`sbp_` = Personal Access Token（可管理整个项目）**，绝不能硬编码进要提交的文件
  （2026-09-24 曾被 GitHub Secret Scanning 拦下 push）。脚本一律 `process.env.SBP_TOKEN` 读取；
  被拦**不要点 unblock 链接**，脱敏后 `git commit --amend` 再 push。
- anon publishable key 公开可接受（页面里本来就有）；失效诊断：GET `/rest/v1/<表>?select=id&limit=1`
  → 200 有效 / 401 失效。
- **Edge Function 运维（2026-10-10 起）不装 CLI**，走 Management API：
  `POST /secrets`（upsert，不删其它）/ `POST /functions/deploy?slug=<slug>`（手工拼 multipart，
  ⚠️ `entrypoint_path` 填 **`index.ts`**）。判据分层：`500 尚未配置`=Secret 缺；
  **`401 登录状态已失效`= 配置已生效**；网关 404 = 没部署。详见技能 `supabase-edge-fn-ops`。
- 部署后若客服仍报旧错，让她们 `Ctrl+Shift+R`（GitHub Pages 有缓存）。
- **注入 key 的省事做法**：页面里写占位符，用脚本从已有页面正则提取 key 后替换，避免 key 出现在对话/日志里。

## 前端排查与验证（细节见技能 modal-mask-guard）
- **顺序**：先证明线上是新版（抓 HTML grep）→ 排除缓存 → 再「注入变量」复现环境差异，
  **别急着改代码**。UI bug 优先用注入变量法（字号/宽度/缩放）。
- 语法检查 `node outputs/check-syntax.js <文件>`；无头冒烟用 `puppeteer-core` + Edge headless + 看门狗。
  ⚠️ 页面有 `confirm()/alert()` 必须桩掉，否则 headless 永久挂起；mock supabase 要「运行时读全局配置」。
- ⚠️ **同一文件不要在同一轮并行发多个 Edit**（互相覆盖，症状＝「返回 success 但改动不见了」），改完 `grep` 复核。
- ⚠️ **推送后必须复核** `git rev-parse origin/main`——commit 与 push 写在同一串命令时输出易被截断，曾误判已推送。
- ⚠️ 本地 git 对象库有损坏（`git fsck` 报 broken link），`git log -S` 可能漏提交 → 追历史改用 GitHub API 拉 raw 比对。
- 沙箱 bash 缺 coreutils：命令前导出 `PATH=.../PortableGit/versions/1.2.0/{usr,mingw64}/bin:$PATH`。

## 其他项目
- 辽哥健身房小程序：本地 `fitness-miniapp/`，AppID `wx4d7fb2ba6a586905`，主体认证已完成，ICP 备案待推进。
