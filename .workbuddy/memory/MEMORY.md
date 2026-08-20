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

## 花色素材图片链路
- 旧花色：GitHub Pages `/patterns/` → jsDelivr CDN；中图 `/patterns/hd/*.webp?v=3`（1200px/quality 82）。
- 新花色（飞书附件同步）：Supabase Storage `pattern-images` bucket，公开 URL；单张常 1MB+，国内访问慢（6s+）。
- **已知问题**：Supabase Storage 未启用 Image Transformations，无法动态生成中图；lightbox 大图需走原图。

## 辽哥健身房（微信小程序）
- 本地：`fitness-miniapp/`
- AppID：`wx4d7fb2ba6a586905`
- 状态：主体认证已完成（30元），ICP 备案待推进。

## 前端改动验证方法（本沙箱可复用）
- **语法检查**：`node -e "..."` 提取 inline `<script>` 逐段 `new Function(m[1])` 校验。
- **无头浏览器冒烟测试**：`puppeteer-core`（绝对路径 require）+ Edge headless，本地起服务加载页面检查 `console`/`pageerror`。
- **线上验证**：以 `git push` 成功 + 本地冒烟测试为准，勿因本沙箱外网慢而误判未部署。
