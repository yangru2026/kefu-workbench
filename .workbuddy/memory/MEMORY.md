# 尤赫客服工作台 - 项目记忆

## 概况
- 前端：原生单文件 HTML → GitHub Pages https://yangru2026.github.io/kefu-workbench/
- 后端：Supabase `ienmejlxukhrxjjxvfqf`；仓库 `yangru2026/kefu-workbench`（main）
- 茹姐会在 Supabase SQL Editor 手动跑 SQL
- 主题：翡翠绿 #10B981 + 白底浅色侧边栏 + 冷白底 #F7F9F8（index.html `:root`）。
  换侧边栏底色先 `grep var(--sidebar-bg)`，配 `color:#fff` 的组件要同步改。
  qc.html / qc-v2 / cs-qc 等独立质检页仍是旧绿主题（未同步）。

## 功能一览（新页面 = 独立 html + index.html iframe 接入 + admin-only-nav 控权限）
| 模块 | 文件 | 表 |
|---|---|---|
| 客服信息/加班调休 | index.html | `cs_info` `overtime_records` `compensatory_leave_records` |
| 培训资料/花色素材 | index.html | `training_materials` `pattern_assets` `*_categories` |
| 质检工具 | qc.html 系 | `qc_records` + `qc-images` |
| 客服申请审批 | index.html | `cs_requests`（通过后联动排班/加班/调休） |
| 赠品编码查询 | gift.html | `gift_codes` + `gift-images` |
| 舆情转接登记 | diversion.html | `diversion_transfers` + `diversion-images` |
| 平台规则 | rules.html | `platform_rules`（预置 21 条） |
| 工作清单打卡 | checklist.html | `checkin_records` |
| 花色考核试卷 | quiz.html | 题库内联 35 题 |
| 考核成绩（仅 admin） | quiz-results.html | `quiz_results` |
| AI 提问 | index.html + Edge Fn `ai-ask` | `ai_questions` |
- 连带成交已下线（2026-09-12），`cross_sales` 数据保留，DOM/JS 未删。
- 舆情转接店铺口径 = 独立 11 家（抖音1-4店/拼多多1-5店/天猫弥生/天猫极氧），**勿与其他模块混用**。
- 工作清单来自《客服管理固定工作清单》售前管理页（日 8/周 9/月 11），绩效锚点暂定 28 号。
- **AI 提问已上线**（2026-10-10）：`ARK_MODEL=doubao-seed-2-1-lite-260915`，已加
  `thinking:{type:'disabled'}`（12~34s → 3.9s）。
  ⚠️ 火山方舟**界面显示名不能调用**，必须带日期后缀的完整 ID（`GET /api/v3/models` 查）。

## ⚠️ AI 话术红线（老板 2026-10-10 连续三条要求，改提示词必看）
1. **通用最高原则**：只回答客户实际问的那件事——不引申、不科普、不补充他没问的。
   客户没问的产品属性（定轴/高光/散光/材质工艺等）一律不主动提、不解释、不否认；
   严禁「不是定轴工艺」「没有高光设计」这类主动否认句式（**美瞳基本都带高光，说没有是事实错误**）。
2. **不确定的不要硬说**：拿不准的不要靠"工艺"去解释，也不要用「有没有/是不是/不属于」这类字眼去否认或绕；
   只按客户问法给回复，确需依据时说「以工作台实际资料为准」。
3. **无散光定制业务**：不能出现「散光定制/定制轴位/定制散光」；**连"定制"二字都不要用来否认**
   （不说"没有散光定制服务"），改答「在售均为普通款，按标准度数统一制作；散光度数高建议先咨询验光师」
   整句不含"定制"。「定轴款」是花色产品线，只说是普通款镜片设计，绝不与散光/轴位挂钩。

## 待开发
- 周报、积分卡（客服积分/绩效）、审单统计

## ⚠️ 三条必读分叉
1. **index.html 双源码**：权威副本 `C:\temp\kefu_src\index.html`。改完
   `cp /c/temp/kefu_src/index.html index.html` 再提交；推前 `git fetch`。
   一致性校验：`git rev-parse HEAD:index.html` 对比 GitHub commits API 的 `files[].sha`
   （**trees API 有缓存，别用**）。
2. **iframe 子页高度坑**：`.page.active{display:block}` 会让 inline `flex-direction:column` 失效 → iframe 塌成 150px。
   加子页必须：① `#page-xxx.active{display:flex;height:100vh;overflow:hidden;}`
   ② 容器 `style="padding:0;overflow:hidden;flex-direction:column;"` ③ 懒加载分支
   ④ 菜单项 + `data-src` 升版。
3. **命名坑**：UMD SDK 占全局 `supabase`，禁止 `const supabase = createClient(...)`（整段脚本不执行），
   统一 `const sb`；别撞已有 `data-page`（`quiz` 已被知识测验占用 → 花色考核用 `price-quiz`）。

## 花色素材图片链路（2026-09-24 大改）
- 图片源 = 同源 GitHub Pages 直连（`toCdnUrl()`）；**绝不能再改回 jsDelivr**
  （301 → raw.githubusercontent，国内 12s 超时）。
- 三级图 `thumb/`（卡片）/`large/`、`hd/`（hover、灯箱）；命名 `{品牌}_{系列}_{花色}_eye|_lens|_extra.webp`。
- ⚠️ 管理员重传图片只写 Storage、不生成缩略图 → 慢链路复现。清零：
  `SBP_TOKEN=xxx node outputs/gen-storage-thumbs.js` → git push → 跑生成的 SQL。
  ⚠️ `pattern_assets.id` 是 UUID，SQL 必须带引号；孤儿缩略图**别按名字猜配对**。
- Storage 兜底 `toStorageRender()`（`render/image` + width/quality/format=webp），`toThumbUrl()` 400px/q72。
  ⚠️ 该端点 no-cache+跨域，SW 缓存不到；是**付费功能**，4xx 要优雅退化。
- 性能：`PATTERN_PAGE_SIZE=20` + lazy + 首屏 6 张 high 优先级 + `kefu_cache_pattern_assets` 秒显。
- `sw.js`：`/images/` stale-while-revalidate，`IMG_CACHE='kefu-sw-img-v1'` 固定名不清空；
  ⚠️ fetch 分支 **isLib 在 isImage 之前**；SW 只处理**同源**。
- 价格档：`pattern_assets.price_tier`/`diam_group`（直径≥14.5 自动预填大直径）；速查页 = 直径分组 × 价格档。

## 权限与 RLS
- `isAdminUser()`/`isFullAdmin()` → 仅 `role==='admin'`；`isQcRole()` → `admin||leader`。
  父页给 QC iframe 传 `setQcMode` 必须用 `isQcRole()`。
- **profiles 应有 4 条策略**：SELECT true / UPDATE `auth.uid()=id` / INSERT `auth.uid()=id` /
  UPDATE `auth.uid()=id OR is_admin()`。⚠️ **绝不能有** `管理员可查看所有成员`（递归源 42P17）；
  `is_admin()` 必须 `SECURITY DEFINER`。补丁 `fix_profiles_admin_update_policy.sql`（待茹姐跑）。
- ⚠️ 策略 `USING` 里别直接 `SELECT FROM` 同一张表，一律包 `SECURITY DEFINER` 函数。
- 待补：`offboardMember`/`restoreMember` 仍是不带 `.select()` 的老写法（被挡会假报「已清退」）。
- 免 token 排查 RLS：用页面里 `sb_publishable_…` 直连 REST，PATCH 真实行看返回体（`[]`=被挡 / `[{...}]`=放行）。

## Supabase 凭据与 Edge Function
- ⚠️ **`sbp_` = Personal Access Token（能管整个项目）**，绝不能硬编码进要提交的文件
  （2026-09-24 被 GitHub Secret Scanning 拦下 push）。脚本一律 `process.env.SBP_TOKEN` 读；
  被拦**不要点 unblock 链接**，脱敏后 `git commit --amend` 再 push。
- anon publishable key 公开可接受；诊断 `GET /rest/v1/<表>?select=id&limit=1` → 200 有效 / 401 失效。
- **Edge Function 运维（2026-10-10 起）不装 CLI**，走 Management API：`POST /secrets`（upsert）、
  `POST /functions/deploy?slug=<slug>`（手工 multipart，⚠️ `entrypoint_path` 填 **`index.ts`**）。
  判据：`500 尚未配置`=Secret 缺；**`401 登录状态已失效`=配置已生效**；网关 404=没部署。
  详见技能 `supabase-edge-fn-ops`。
- 部署后客服仍报旧错 → 让她们 `Ctrl+Shift+R`。
- 注入 key 省事做法：页面写占位符，脚本从已有页面正则提取 key 后替换（key 不进对话/日志）。

## 前端排查与验证（细节见技能 modal-mask-guard）
- **顺序**：先证明线上是新版 → 排除缓存 → 再「注入变量」复现环境差异，别急着改代码。
- 语法检查 `node outputs/check-syntax.js <文件>`；无头冒烟 `puppeteer-core` + Edge headless + 看门狗。
  ⚠️ 有 `confirm()/alert()` 必须桩掉，否则 headless 永久挂起；mock supabase 要「运行时读全局配置」。
- ⚠️ **同一文件不要在同一轮并行发多个 Edit**（互相覆盖，症状＝返回 success 但改动不见了），改完 `grep` 复核。
- ⚠️ **推送后必须复核** `git rev-parse origin/main`（commit+push 同串时输出易截断，曾误判已推送）。
- ⚠️ 本地 git 对象库有损坏，`git log -S` 可能漏提交 → 追历史用 GitHub API 拉 raw 比对。
- 沙箱 bash 缺 coreutils：`export PATH=.../PortableGit/versions/1.2.0/{usr,mingw64}/bin:$PATH`。

## 其他项目
- 辽哥健身房小程序：`fitness-miniapp/`，AppID `wx4d7fb2ba6a586905`，主体认证完成，ICP 备案待推进。
