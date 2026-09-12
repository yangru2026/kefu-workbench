# 尤赫客服工作台 - 项目记忆

## 主题配色（2026-09-09 换版）
- 全站主题：**翡翠绿 #10B981 主色 + 白底浅色侧边栏 + 冷白背景 #F7F9F8**（旧版灰调草木绿+深橄榄侧边栏已废弃）；全部集中在 index.html `:root` CSS 变量。
- 换侧边栏底色的坑：先 `grep var(--sidebar-bg)`，凡配 `color:#fff` 的组件（排班表头、qc-topbar 等）必须同步改，否则白底白字。
- qc.html / qc-v2 / cs-qc 等独立质检页仍是旧绿主题，未同步。

## 已完成功能摘要
- **客服信息管理**：Supabase 表 `cs_info` + 加班/调休小时累计（`overtime_records`/`compensatory_leave_records`）。
- **培训资料 & 花色素材**：迁移到 Supabase（`training_materials`/`pattern_assets`/`training_categories`/`pattern_categories`），管理员页面直接维护，全员实时同步。
- **质检工具**：`qc_records` + `qc-images` Storage，支持录入/筛选/讲解/编辑/删除/导出。
- **花色素材性能**：缩略图/中图（1200px WebP）+ jsDelivr CDN + 分页/懒加载。
- **花色素材同步**：飞书附件自动下载上传到 Supabase Storage（`pattern-images` bucket）；新增 `base_curve`/`fixed_axis`、`is_discontinued`、新款🆕标签。
- **飞书多表同步**：排班表/客服排名/售前月度/连带成交均接入 Supabase，支持 Excel 导入。
- **客服申请审批**：`cs_requests` 表，审批通过后自动联动排班/加班/调休。
- **连带成交**（已下线，2026-09-12）：`cross_sales` 表数据保留；导航入口已被「舆情转接」替代，页面 DOM/JS 仍在 index.html 未删，需要恢复随时可改回。
- **舆情转接登记**（2026-09-12，commit 72f3c8a）：`diversion.html`（iframe 接入，菜单 🔄 舆情转接）规范分流号使用——仅「舆情问透氧/跨店问正品」可转，登记客服/客户昵称或订单号/原因标签/聊天截图（必传≥1，支持粘贴）；表 `diversion_transfers`（screenshots text[]）+ bucket `diversion-images`，SQL `create_diversion_transfers.sql`（茹姐需 SQL Editor 跑一次）；登录可查可登记、删除仅 admin。
- **赠品编码查询**（2026-09-09）：`gift.html`（iframe 接入，菜单 🎁 赠品编码）卡片视图 + 搜索 + 点编码复制；表 `gift_codes`（`image_paths text[]` 多图数组 + 兼容旧 `image_path`）、图片 bucket `gift-images`，建表 SQL `create_gift_codes.sql` + 存量迁移 `add_gift_image_paths.sql`（茹姐需在 Supabase SQL Editor 各跑一次）；编辑弹窗支持多图（多选/粘贴/删除/排序）、卡片点开为带左右切换的灯箱；**改文字闪退已修**：第一轮 paste 监听仅拦截图片、文字粘贴放行，第二轮弹窗布局由 flex 居中改为顶部留白，避免输入法/焦点变化导致 iframe 内重排闪烁；仅 admin 可写（要开放 leader 改 `isAdmin = (role === 'admin')`）。

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

## 花色素材图片链路
- 本地：`fitness-miniapp/`
- AppID：`wx4d7fb2ba6a586905`
- 状态：主体认证已完成（30元），ICP 备案待推进。

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
