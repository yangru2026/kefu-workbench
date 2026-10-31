# 尤赫客服工作台 - 项目记忆

## 概况
- 前端：原生单文件 HTML → **双托管**（同一仓库 push 两边都自动更新）：
  - **主：Cloudflare Pages https://kefu-workbench-c9x.pages.dev**（2026-10-31 上线，首字节 0.65–1.3s，二次访问 ~0.8s）
  - 备：GitHub Pages https://yangru2026.github.io/kefu-workbench/（首字节 1.4–2.7s，偶发抖到 12s；备用保留）
  - ⚠️ Pages 会把 `xxx.html` 308 到 `/xxx`（pretty URL 不可关），功能正常；双跑期间**不要**把 iframe 路径改成无 `.html`（GH Pages 上会 404）。
- 后端：Supabase **`icfgireprowcqwdodfqx`**（youhe-workbench，2026-10-20 迁移）；旧项目 `ienmejlxukhrxjjxvfqf` 已停用仅留档。仓库 `yangru2026/kefu-workbench`（main）
- 茹姐会在 Supabase SQL Editor 手动跑 SQL
- 主题：翡翠绿 #10B981 + 白底浅色侧边栏 + 冷白底 #F7F9F8（index.html `:root`）。
  换侧边栏底色先 `grep var(--sidebar-bg)`，配 `color:#fff` 的组件要同步改。
  qc.html / qc-v2 / cs-qc 等独立质检页仍是旧绿主题（未同步）。

## 性能基线（2026-10-31 改造，改前端必看）
- `sw.js` = **kefu-sw-v3**：页面 HTML 也进 SW 缓存（network-first + 1.8s 超时回退缓存），
  同源 js/css/json 走 SWR，vendor cache-first（**不再预缓存 xlsx**），images 用固定 `kefu-sw-img-v1`。
- 体积账：index.html 947KB / app.js 185KB / supabase 207KB / xlsx 861KB。
  xlsx 改为「首屏后 6s + requestIdleCallback」再加载；导出功能里已有 `window.XLSX` 判空提示。
- index.html 末尾 `prefetchSubPages()`：load 后 2.5s 空闲预热 restock/huaming/qc/gift/diversion 五个 iframe，
  切页靠 SW 缓存秒开。新加子页记得加进 want 列表。
- 实测（限速 180ms/1.4Mbps 模拟国内）：冷启 10.6s → SW 命中后 **105ms**，切子页 111~118ms。
- ⚠️ 发布新版本后：用户第 1 次刷新装新 SW，**第 2 次起才命中 HTML 缓存**；
  且网络慢时可能先看到旧页面 → 让茹姐 `Ctrl+Shift+R` 强刷（绕过 SW）。

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
   ⚠️ **所有冒烟脚本的 `SRC='C:/temp/kefu_src'` 都从 kefu_src 读文件**——改完 workspace 的 index.html 后
   务必先 `cp workspace/index.html /c/temp/kefu_src/index.html` 再跑冒烟，否则测的是旧版会误报（2026-10-31 续做时踩过：报 `popupAcquire/dailyRemindCheck is not defined`，其实是 kefu_src 没同步）。
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

## ⚠️ 写库必读：exec-sql.js 的项目 ref
- `outputs/exec-sql.js` 默认项目 = **新库 icfgireprowcqwdodfqx**（2026-10-31 已改，原来写死旧库 ienmejlx…）。
  操作旧库须显式 `SBP_REF=ienmejlxukhrxjjxvfqf`。踩过的坑：11 月班表插进旧库后 REST 查不到，白排查半小时。
- **排查「SQL 能查到、REST 查不到」**：先核对是不是同一项目（脚本 ref），再模拟 anon 身份
  （`BEGIN; SET LOCAL role anon; SELECT count(*) …; ROLLBACK;`）区分 RLS 与项目错位。
- `schedule_data.id` 是 bigint + 序列，但**序列值落后于已有数据**（迁移遗留）→ 插入报
  `duplicate key (id)=(1)`。修法：`SELECT setval('schedule_data_id_seq',(SELECT COALESCE(MAX(id),1) FROM schedule_data));`
- `jsonb_object_length()` **不存在**，数 jsonb 键用 `(SELECT count(*) FROM jsonb_object_keys(x))`。

## 排班表（组长质检提醒的数据源）
- `schedule_data`：`month_key` + `staff_name` + `group_name` + `schedule` jsonb（键 '1'~'31'，值 早/中/晚/休/调）。
  线上只有 2026-08 旧数据；**2026-11 已于 2026-10-31 导入 21 人 × 30 天**（A5/B7/C8/分流1），
  源数据落 `outputs/data/duty-2026-11.{csv,json,sql}`，解析脚本 `outputs/parse-duty-2026-11.js`。
- ⚠️ **班表里写的是真名**（马雷旭），账号花名是「小雷」→ 弹窗匹配必须 name→real_name 兜底。
- 组长（role=leader）3 人：小雷(A/马雷旭)、小念(B)、小暖(A)；管理员杨茹不弹。

## 弹窗调度器（多弹窗排队，2026-10-31 上线）
- 全局同一时刻只显示一个自动弹窗，其余按优先级排队轮转。优先级：**qcGate 100 > 日报 daily 80 > 组长质检 duty 60 > 公告 notice 40**。
- 机制：`window.__popupQueue` + `window.__activePopup` + `popupAcquire(id,prio)`（返回 true=抢到可渲染 / false=排队中别渲染）+ `popupRelease(id)`（关闭后 setTimeout 400ms 触发队列下一个最高优先级）+ `POPUP_RETRY{...}` 各自重跑。
- 已接入：renderQcGate / dutyRemindCheck / dailyRemindCheck / spMaybeShowNotice（关闭都接 popupRelease）。
- 改弹窗逻辑必看：新弹窗要先 `if(!popupAcquire('id',prio)) return;`，关闭时 `popupRelease('id')`，并在 `POPUP_RETRY` 登记重试体，否则会和别的弹窗叠遮罩。
- 冒烟 `outputs/smoke-popup-daily.js`（13 项）：验证 qcGate→daily→duty→notice 依次激活归位、无 pageerror。

## 日报定时提醒（按班次，2026-10-31 上线）
- 触发时刻：`DAILY_REMIND_T={'早':'15:30','中':'20:30','晚':'23:30'}`；读 schedule_data 本人当日班次（getMyTodayShift，name→real_name 兜底）。
- 规则：休/调/无班次静默跳过；**管理员(role=admin)不弹**；当天已交日报（daily_reports 有记录 / localStorage `dailyRemind_<date>.done`）不弹；一天最多 4 次；「稍后提醒」10 分钟后再来；到点前挂定时器到点再查。
- 弹窗 `#daily-remind-modal`（z-index 99997），正文含**班次时间**（如早班 8:00–16:30）+「下班前提交今日日报」+「📝 去填日报」→ switchPage('daily')。
- ⚠️ 弹窗正文显示班次时间，**不含触发时刻 15:30**（15:30 只是触发点，不在弹窗里）。

## 其他项目
- 辽哥健身房小程序：`fitness-miniapp/`，AppID `wx4d7fb2ba6a586905`，主体认证完成，ICP 备案待推进。
