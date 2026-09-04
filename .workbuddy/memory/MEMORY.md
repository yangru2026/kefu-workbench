# 尤赫客服工作台 - 项目记忆

## 已完成功能摘要
- **客服信息管理**：Supabase 表 `cs_info` + 加班/调休小时累计（`overtime_records`/`compensatory_leave_records`）。
- **培训资料 & 花色素材**：迁移到 Supabase（`training_materials`/`pattern_assets`/`training_categories`/`pattern_categories`），管理员页面直接维护，全员实时同步。
- **质检工具**：`qc_records` + `qc-images` Storage，支持录入/筛选/讲解/编辑/删除/导出。
- **花色素材性能**：缩略图/中图（1200px WebP）+ jsDelivr CDN + 分页/懒加载。
- **花色素材同步**：飞书附件自动下载上传到 Supabase Storage（`pattern-images` bucket）；新增 `base_curve`/`fixed_axis`、`is_discontinued`、新款🆕标签。
- **飞书多表同步**：排班表/客服排名/售前月度/连带成交均接入 Supabase，支持 Excel 导入。
- **客服申请审批**：`cs_requests` 表，审批通过后自动联动排班/加班/调休。
- **连带成交**：`cross_sales` 表，按店铺/产品分组管理，支持页面协作权限。

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
