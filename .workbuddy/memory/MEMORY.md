# 尤赫客服工作台 - 项目记忆

## 主题配色（2026-09-09 换版）
- 全站主题：**翡翠绿 #10B981 主色 + 白底浅色侧边栏 + 冷白背景 #F7F9F8**（旧版灰调草木绿+深橄榄侧边栏已废弃）；全部集中在 index.html `:root` CSS 变量。
- 换侧边栏底色的坑：先 `grep var(--sidebar-bg)`，凡配 `color:#fff` 的组件（排班表头、qc-topbar 等）必须同步改，否则白底白字。
- qc.html / qc-v2 / cs-qc 等独立质检页仍是旧绿主题，未同步。

## 已完成功能摘要
- **客服信息管理**：Supabase 表 `cs_info` + 加班/调休小时累计（`overtime_records`/`compensatory_leave_records`）。
- **培训资料 & 花色素材**：迁移到 Supabase（`training_materials`/`pattern_assets`/`training_categories`/`pattern_categories`），管理员页面直接维护，全员实时同步。
- **质检工具**：`qc_records` + `qc-images` Storage，支持录入/筛选/讲解/编辑/删除/导出。
- **花色素材性能**：缩略图/中图（WebP）+ **同源 GitHub Pages 直连**（jsDelivr 已于 2026-09-24 弃用，见下文「花色素材图片链路」）+ 分页/懒加载 + sw.js 图片缓存。
- **花色素材同步**：飞书附件自动下载上传到 Supabase Storage（`pattern-images` bucket）；新增 `base_curve`/`fixed_axis`、`is_discontinued`、新款🆕标签。
- **飞书多表同步**：排班表/客服排名/售前月度/连带成交均接入 Supabase，支持 Excel 导入。
- **客服申请审批**：`cs_requests` 表，审批通过后自动联动排班/加班/调休。
- **连带成交**（已下线，2026-09-12）：`cross_sales` 表数据保留；导航入口已被「舆情转接」替代，页面 DOM/JS 仍在 index.html 未删，需要恢复随时可改回。
- **舆情转接登记**（2026-09-12，commit 72f3c8a）：`diversion.html`（iframe 接入，菜单 🔄 舆情转接）规范分流号使用——仅「舆情问透氧/跨店问正品」可转，登记客服/客户昵称或订单号/原因标签/聊天截图（必传≥1，支持粘贴）；表 `diversion_transfers`（screenshots text[]）+ bucket `diversion-images`，SQL `create_diversion_transfers.sql`（茹姐需 SQL Editor 跑一次）；登录可查可登记、删除仅 admin。
- **赠品编码查询**（2026-09-09）：`gift.html`（iframe 接入，菜单 🎁 赠品编码）卡片视图 + 搜索 + 点编码复制；表 `gift_codes`（`image_paths text[]` 多图数组 + 兼容旧 `image_path`）、图片 bucket `gift-images`，建表 SQL `create_gift_codes.sql` + 存量迁移 `add_gift_image_paths.sql`（茹姐需在 Supabase SQL Editor 各跑一次）；编辑弹窗支持多图（多选/粘贴/删除/排序）、卡片点开为带左右切换的灯箱；**改文字闪退已修**：第一轮 paste 监听仅拦截图片、文字粘贴放行，第二轮弹窗布局由 flex 居中改为顶部留白，避免输入法/焦点变化导致 iframe 内重排闪烁；仅 admin 可写（要开放 leader 改 `isAdmin = (role === 'admin')`）。
- **舆情转接登记**（2026-09-12）：`diversion.html` 替代连带成交入口（菜单 🔄），新表 `diversion_transfers`（shop/diversion_nick 两列需跑 `add_diversion_shop_nick.sql`），bucket `diversion-images`；店铺口径为独立 11 家正式名单（抖音1-4店/拼多多1-5店/天猫弥生/天猫极氧），与其他模块店铺口径不同勿混用。
- **平台规则**（2026-09-12）：`rules.html`（iframe 接入，菜单 📏，培训资料后）；表 `platform_rules`（id/platform/level/title/content/sort_order/created_at）+ RLS（authenticated 读、admin 写）+ 预置 21 条规则（通用高压线 6 条 + 各平台特有），建表 SQL `create_platform_rules.sql`（幂等 by title，茹姐需在 SQL Editor 跑一次）；平台 chips 无「全部」默认第一个，规则卡按等级排序高压线优先；缓存 `kefu_cache_platform_rules` v1；仅 admin 可维护。
- **工作清单打卡**（2026-09-22，commit 609f609）：`checklist.html`（iframe 接入，菜单 ✅ 工作清单，「🌙 汇报」后，**admin-only-nav 仅茹姐可见**）；内容=Excel《客服管理固定工作清单》售前管理页（每日 8 项/每周 9 项带星期锚点/每月 11 项带日期锚点），**清单项硬编码在页面数组里**（要改项需改代码）；打卡表 `checkin_records`（unique(user_id,item_key,period_key)，period_key 约定 D日期/W周一日期/M年月）+ RLS 仅 admin；三页签+进度条，绿边=今天该做、红边=到期未做；绩效核算锚点暂定 28 号（原表空白）；售后管理 sheet 未做。
- **AI 提问复活**（2026-09-21，进行中）：8/30 就做完的页面+代码一直没部署。现已代做：① Management API 跑 `create_ai_questions.sql` 建表+4条RLS（工具 `outputs/exec-sql.js`）② 部署 `ai-ask`（npx supabase + sbp_ token）。**只差茹姐提供火山方舟 ARK_API_KEY + 模型**，之后 `npx supabase secrets set ARK_API_KEY=... ARK_MODEL=...` 即上线。豆包端点 `ark.cn-beijing.volces.com/api/v3`，每个模型须单独开通。aiforce.cloud 链接是飞书妙搭应用（强制豆包登录、无免登录形式、iframe 不被拦但要扫码），已否决嵌入方案。

## 待开发功能清单
1. **周报** - 每周数据汇总报告
2. ~~售前月度数据汇总~~ ✅
3. **积分卡** - 客服积分/绩效卡
4. ~~质检工具接入~~ ✅
5. ~~权限开放功能~~ ✅
6. **审单统计功能** - 订单审核统计

## 技术栈
- 前端：原生 HTML/CSS/JS，部署于 GitHub Pages
- 后端：Supabase (`ienmejlxukhrxjjxvfqf.supabase.co`)
- 访问地址：https://yangru2026.github.io/kefu-workbench/

## Supabase anon public key 管理（重要）
- **首次刷新记录**：2026-08-18，旧 key 失效后从 Project Settings → API 复制新 key，已替换 5 个文件并 commit `83fa2e4`。
- **涉及文件**：`cs-qc.html` `diagnose.html` `qc-share.html` `qc-v2.html` `qc.html`
- **key 位置**：https://supabase.com/dashboard/project/ienmejlxukhrxjjxvfqf/settings/api → 复制 "anon public"
- **快速诊断**：`curl -o /dev/null -w "%{http_code}" -H "apikey: <KEY>" -H "Authorization: Bearer <KEY>" "https://ienmejlxukhrxjjxvfqf.supabase.co/rest/v1/qc_shares?select=id&limit=1"` → 200 有效，401 失效。
- **缓存问题**：GitHub Pages 会缓存静态文件，部署后若仍报旧错误，客服需 `Ctrl+Shift+R` 强制刷新。

## 角色权限函数（极易搞混，改功能时务必选对）
- `isAdminUser()` / `isFullAdmin()` → 仅 `role === 'admin'`
- `isQcRole()` → `admin || leader`（组长可用质检报告 + 质检工具）
- 组长白名单（按杨茹 2026-08-31 决定）：质检报告页 + 质检工具录入/删除；其余权限同普通客服
- 改任何「判断某人能不能进/改某功能」的地方，**先确认用哪一个**，别想当然用 `isAdminUser()`
- 父页面（index.html）给 QC iframe 传 setQcMode 必须用 `isQcRole()`，否则组长被锁只读

## ⚠️ index.html 双源码分叉（2026-09-24 已对齐，必读）
- 排名页（rk 磁贴）的工作副本在 `C:\temp\kefu_src\index.html`（kefu-ranking-sync 技能），工作区仓库也有一份 index.html。
- 2026-09-22 工作区曾把**旧表格版** push 上线覆盖磁贴版（9/23 又被推回来）。**改 index.html 一律以 kefu_src 为准**；
  从工作区推部署前先 `cp kefu_src/index.html index.html`，且 `git fetch` 确认远端没被其他会话推过。
- 2026-09-24 起三方一致：工作区 = kefu_src = 线上（commit bae1214，index.html blob sha `4ccddd4e…`）。
- **远端一致性校验**：`git rev-parse HEAD:index.html` 对比 GitHub API `git/trees/main` 返回的 sha；
  本沙箱 curl 抓线上大文件会被截断（内容不全），别据此误判「没上线」。

## 花色素材图片链路（2026-09-24 大改，必读）
- **图片源 = 同源 GitHub Pages 直连** `https://yangru2026.github.io/kefu-workbench/images/patterns/...`，
  由 `toCdnUrl()`（index.html ~11934 行）统一规范；**绝不能再改回 jsDelivr**。
- ⚠️ 根因教训：jsDelivr 对本仓库图片会 **301 → `raw.githubusercontent.com`**，该域名国内直连 12s 超时失败
  → 首屏 20 张卡片图全卡死（茹姐原话「加载太慢，我想秒开」）。同源直连实测 0.47~1.68s（commit bae1214）。
- 三级图片：`thumb/` 缩略图 34KB（卡片主图）/ `large/` 与 `hd/` 内容相同 28~128KB（hover、灯箱）；
  文件名规则 `{品牌}_{系列}_{花色}_eye|_lens|_extra.webp`（thumb 目录 357 个文件）。
- 数据库 `pattern_assets` 存**相对路径**（如 `images/patterns/thumb/xxx_eye.webp`）：
  `thumb_eye_url`/`thumb_lens_url`（148/189 有值，41 个为 null 时回退 `eye_img` 原图）；
  `eye_imgs`/`lens_imgs` 数组供灯箱多图。
- 性能配套：`PATTERN_PAGE_SIZE=20` 分页 + `loading="lazy"` + 首屏 6 张 `fetchpriority="high"`
  + 数据层秒显缓存 `kefu_cache_pattern_assets`（先渲染缓存再后台刷新）。
- **sw.js 图片缓存**（VERSION v2）：`/images/` 走 stale-while-revalidate（先返缓存秒开 + 后台静默更新），
  `IMG_CACHE='kefu-sw-img-v1'` 固定名不随版本清空，上限 800 条自动淘汰。
  ⚠️ fetch 分支顺序 **isLib 必须排在 isImage 之前**；⚠️ SW 只处理**同源**，跨域图片永远进不了缓存。
- **诊断手法**：先 `curl -sI` 看状态码 + `Location`，再 `curl -sL -w '%{time_total}'` 看跟随重定向后的真实耗时。
  只看首跳状态码会漏掉「301 跳到坏域名」这种最坑的情况。

## 辽哥健身房小程序
- 本地：`fitness-miniapp/`；AppID：`wx4d7fb2ba6a586905`；主体认证已完成（30元），ICP 备案待推进。

## iframe 型子页面的高度坑（2026-09-09，commit 0f1f0c4）
- index.html 的 `.page.active{display:block}`，容器上的 inline `flex-direction:column` 无效，iframe `flex:1` 不生效 → iframe 塌陷成默认 150px，页面只显示顶部一条。
- **每新增 iframe 型子页，必须在 CSS 里加 `#page-xxx.active{display:flex;height:100vh;overflow:hidden;}`（qc/gift 都有），并把 iframe data-src 缓存参数升版。**
- 截图诊断：PIL 按已知颜色（#f8fafc 卡片图区、#e2e8f0 边框、#f6f8f5 页面底色）做像素扫描，可精确还原用户看到的渲染结果。

## 独立 supabase 页面命名坑（2026-09-09）
- UMD SDK 已占用全局 `supabase`，脚本里禁止 `const supabase = window.supabase.createClient(...)`（报 "Identifier 'supabase' has already been declared"，整段脚本不执行），统一用 `const sb = ...`。
- 冒烟脚本模板：`outputs/smoke-gift.js`（本地 http 服务 + Edge headless + pageerror 捕获 + 看门狗）。

## 前端改动验证方法（本沙箱可复用）
- **语法检查**：`node -e "..."` 提取 inline `<script>` 逐段 `new Function(m[1])` 校验。
- **无头浏览器冒烟测试**：`puppeteer-core`（绝对路径 require）+ Edge headless，本地起服务加载页面检查 `console`/`pageerror`。
- **线上验证**：以 `git push` 成功 + 本地冒烟测试为准，勿因本沙箱外网慢而误判未部署。
- **冒烟必备套路（2026-09-04 沉淀，模板 `outputs/smoke-pp.js`）**：
  1. 大 evaluate 拆多步 + 每步超时 + 全局看门狗，否则卡死时 SIGTERM 无输出；
  2. 页面有 `confirm()/alert()` 必须 `page.on('dialog', d=>d.accept())`，否则 evaluate 永久挂起（最常见 SIGTERM 根因）；
  3. supabase mock：`.select()`/`.order()` 链式返回 this + thenable；`.in(col, vals)` 别漏列名；
  4. 临时覆盖 `window.loadPatternsFromDB` 等加载函数拦截异步副作用；
  5. 调 `renderEditorForm` 前先初始化 `window._editPattern`/`window._editImages`；
  6. 分步 evaluate 返回值要 Object.assign 合并，否则断言空跑不报错。

## 花色价格速查页（2026-09-04，commit 5cd5e16）
- 菜单「💰 花色价格速查」：直径分组 × 价格档两级分组，防低价错标高价花色；未打标落「⏳ 待分组」「❓ 未标价格」。
- 数据：`pattern_assets.price_tier`/`diam_group` + `pattern_categories` 扩展 `price`/`diam_group` 类型（档位右键/合并对话框自维护）；迁移 SQL `add_pattern_price_tier.sql`（幂等，直径≥14.5 自动预填大直径）。
- 管理员批量勾选打标；客服只读；花色素材页筛选行 + 编辑弹窗（ef-price/ef-diamgroup）同步支持两字段。
