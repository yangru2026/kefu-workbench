# 尤赫客服工作台 - 项目记忆

## 已完成功能
- **客服信息管理** (2026-07-30): 侧边栏「📋 客服信息」入口，管理员可编辑、搜索、复制、导出CSV。新增 Supabase 表 overtime_records 和 compensatory_leave_records，加班调休按小时累计，逐笔记录日期和小时数，调休从累计加班中扣除，实时显示剩余可调时长。
- **培训资料 & 花色素材实时同步** (2026-07-30): 迁移到 Supabase（training_materials + pattern_assets 表），管理员可直接在页面上增删改，所有客服实时更新，不再需要导出 config.json 部署。
- **培训资料分类管理** (2026-07-30): training_categories 表，管理员可增删改分类，级联更新资料 category 字段，实时同步。
- **花色素材分类管理** (2026-07-30): pattern_categories 表，四种维度（品牌/抛型/系列/色系）均可管理，级联更新 pattern_assets 对应字段，实时同步。右侧菜单改为右键触发。
- **质检工具接入** (2026-07-31): 侧边栏「🔍 质检工具」入口，独立 qc.html (iframe 内嵌)，数据存储升级到 Supabase（qc_records 表 + qc-images Storage bucket），全员可查看、管理员可增删改。功能：录入/筛选/标记讲解/编辑/删除/讲解模式/质检分析/导出CSV/图片粘贴预览缩放。
- **性能优化** (2026-07-31): 首屏懒加载（tesseract.js 改为按需加载）、页面切换按需加载数据、花色搜索防抖 250ms、质检页复用父窗口 supabase client。
- **花色下架标记** (2026-07-31): pattern_assets 新增 is_discontinued 字段，管理员可标记下架/取消下架，自动生成「📦 下架花色」分类。
- **飞书多维表格同步** (2026-07-31): Supabase Edge Function (feishu-sync) 接收飞书事件订阅/手动触发，拉取多维表格记录同步到 pattern_assets。工作台花色素材页新增「🔄 从飞书同步」按钮(admin-only)。需执行 feishu_sync_migration.sql，部署指南见 feishu-sync-deploy-guide.md。
- **花色素材页加载性能优化** (2026-08-08): 三层方案全做。**A 修代码bug**：`app.js` 第14行 onSupabaseReady 重复调 loadPatternsFromDB+render，进入花色页重复 render 2 遍；**B 缩略图**（核心，357张原图 66.3MB → WebP 缩略图 11.3MB 节省 83%）：`generate_thumbnails.py` 批量生成 + 数据库加 `thumb_eye_url` / `thumb_lens_url` + renderPatterns 默认用缩略图 + hover 用 `data-lens-src` 延迟加载 + 前6张 `fetchpriority="high"` + `decoding="async"`；**C 分页**：每页20个 + "加载更多"按钮 + 切换筛选自动重置。**预期首屏从 8秒 → 1-1.5秒**。需执行 add_thumb_columns.sql。
- **花色素材四项改进** (2026-08-08): ①Lightbox大图加载优化（限制900px+超时提示+重试按钮）；②卡片下架标记（meta-row标签+名称删除线）；③直径分类维度（第5维度，品牌>抛型>直径>系列>色系>状态，add_diameter_category.sql）；④色系分类合并整理（merge_color_categories.sql 将60+非标准值归一到9个标准分类，前端删除色系时弹出合并对话框支持"合并到其他色系"）。
- **花色素材继续优化** (2026-08-08): ①Lightbox中图加速（900px WebP，357张27.9MB，优先加载中图失败回退原图，generate_large_images.py）；②直径值去重归一（normalize_diameter.sql 把14.5mm/14.5统一为14.5）；③删除分类通用合并对话框（直径/抛型/系列/色系删除时都支持合并到其他分类）；④卡片管理按钮对管理员默认可见（无需先开"管理模式"即可标记下架/编辑/删除）。
- **花色素材问题修复** (2026-08-08): ①提供 add_discontinued_column.sql 添加 is_discontinued 字段解决下架标记失败；②修复 normalize_diameter.sql 的 CHECK 约束错误；③图片 URL 统一加 `?v=2` 缓存版本号强制刷新，hover lens 优先加载中图。
- **Lightbox 高清图加载慢彻底解决** (2026-08-08): 三管齐下：①中图从 900px/quality82 降到 600px/quality70，357张从 27.9MB → 11.8MB（平均34KB）；②全站花色图片 URL 走 jsDelivr CDN 加速（国内节点快于 GitHub Pages）；③lightbox 交互重构：点击瞬间直接显示已缓存缩略图，后台静默加载高清中图，加载完淡入替换，失败保持缩略图不转圈。
- **Lightbox 大图清晰度修复** (2026-08-08): 600px 中图在 900px lightbox 容器内被放大导致模糊。重新生成 **1200px/quality 82** 高清中图，357张共36.3MB（平均104KB），1200px 超过容器尺寸保证高清不模糊；中图 URL 加 `?v=3` 版本号强制刷新 jsDelivr 旧缓存。

## 待开发功能清单

以下功能已规划，待后续逐一开发完善：

1. **周报** - 每周数据汇总报告
2. **售前月度数据汇总** - 月度售前数据统计与分析
3. **积分卡** - 客服积分/绩效卡
4. ~~**质检工具接入** - 接入质检相关工具或系统~~ ✅ 已完成
5. **权限开放功能** - 更细粒度的权限控制
6. **审单统计功能** - 订单审核统计

## 技术栈
- 前端：原生 HTML/CSS/JS，部署于 GitHub Pages
- 后端：Supabase (ienmejlxukhrxjjxvfqf.supabase.co)
- 访问地址：https://yangru2026.github.io/kefu-workbench/

---

## 辽哥健身房（微信小程序）
- 本地：`fitness-miniapp/`
- 技术栈：微信小程序原生框架（WXML + WXSS + JS）
- AppID：wx4d7fb2ba6a586905
- 动作GIF来源：jsDelivr CDN (ExerciseGymGifsDB)
- 动作视频来源：Cloudflare R2 CDN (free-exercise-db-with-videos, 1080p MP4)
- 视频CDN域名：pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev（需在微信后台配置 downloadFile 合法域名）
- 5 Tab 结构：训练/跟练/计时/饮食/我的
- v2.0 功能：模板计划+自由训练+居家模板、跟练播放器、饮食记录、体重BMI、社交分享
- v2.2 新增功能：
  - 饮食拍照识别热量（百度AI菜品识别API，200+菜品热量库兜底）
  - 运动卡路里自动记录（MET代谢当量公式，50+动作MET值）
  - 体重维度记录（胸/腰/臀/大腿/臂围）+ Canvas体重趋势折线图
- 视频教程：81%动作有1080p视频，无视频的动作回退GIF动图
- 真人视频管理：支持自定义上传真人示范视频（云存储URL或本地相册）
- B站帕梅拉视频：10个跟练课程接入帕梅拉真人完整视频链接
