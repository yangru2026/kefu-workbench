# 尤赫客服工作台 - 项目记忆

## 已完成功能
- **客服信息管理** (2026-07-30): 侧边栏「📋 客服信息」入口，管理员可编辑、搜索、复制、导出CSV。新增 Supabase 表 overtime_records 和 compensatory_leave_records，加班调休按小时累计，逐笔记录日期和小时数，调休从累计加班中扣除，实时显示剩余可调时长。
- **培训资料 & 花色素材实时同步** (2026-07-30): 迁移到 Supabase（training_materials + pattern_assets 表），管理员可直接在页面上增删改，所有客服实时更新，不再需要导出 config.json 部署。
- **培训资料分类管理** (2026-07-30): training_categories 表，管理员可增删改分类，级联更新资料 category 字段，实时同步。
- **花色素材分类管理** (2026-07-30): pattern_categories 表，四种维度（品牌/抛型/系列/色系）均可管理，级联更新 pattern_assets 对应字段，实时同步。右侧菜单改为右键触发。
- **质检工具接入** (2026-07-31): 侧边栏「🔍 质检工具」入口，独立 qc.html (iframe 内嵌)，数据存储升级到 Supabase（qc_records 表 + qc-images Storage bucket），全员可查看、管理员可增删改。功能：录入/筛选/标记讲解/编辑/删除/讲解模式/质检分析/导出CSV/图片粘贴预览缩放。

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
