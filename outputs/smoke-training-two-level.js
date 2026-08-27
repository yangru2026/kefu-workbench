// 培训资料两级分类 冒烟测试 v2（注入两级假数据，模拟 SQL 执行后状态）
const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: path,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_NAME_NOT_RESOLVED') && !m.text().includes('favicon')) errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  await page.evaluate(() => {
    const nav = document.querySelector('.nav-item[data-page="training"]');
    if (nav) nav.click();
  });
  await new Promise(r => setTimeout(r, 2500));

  // 注入两级假数据（模拟 SQL 执行后）
  await page.evaluate(() => {
    trainingCategories = [
      { id: 'g1', name: '品牌背景和定位', sort_order: 100, parent_id: '' },
      { id: 'g2', name: '基础知识', sort_order: 200, parent_id: '' },
      { id: 'g3', name: 'ERP操作', sort_order: 300, parent_id: '' },
      { id: 'g4', name: '店铺产品', sort_order: 400, parent_id: '' },
      { id: 's1', name: '弥生', sort_order: 110, parent_id: '品牌背景和定位' },
      { id: 's2', name: '极氧', sort_order: 120, parent_id: '品牌背景和定位' },
      { id: 's3', name: '美瞳抛型', sort_order: 210, parent_id: '基础知识' },
      { id: 's4', name: '材质', sort_order: 220, parent_id: '基础知识' },
      { id: 's5', name: '直径·基弧·透氧', sort_order: 230, parent_id: '基础知识' },
      { id: 's6', name: '含水·度数换算', sort_order: 240, parent_id: '基础知识' },
      { id: 's7', name: '查询订单', sort_order: 310, parent_id: 'ERP操作' },
      { id: 's8', name: '驳回审核', sort_order: 320, parent_id: 'ERP操作' },
      { id: 's9', name: '查询库存', sort_order: 330, parent_id: 'ERP操作' },
      { id: 's10', name: '抖音1店', sort_order: 410, parent_id: '店铺产品' }
    ];
    trainingData = [
      { id: 'm1', title: '弥生品牌故事', url: 'https://x.com/1', tags: ['入门'], group_name: '品牌背景和定位', category: '弥生', brand: '弥生', description: '弥生品牌创立于 2014 年，主打自然清透系美瞳。\n重点：目标人群为 18-28 岁年轻女性，核心卖点是「舒适度+日常通勤」。' },
      { id: 'm2', title: '极氧品牌定位', url: 'https://x.com/2', tags: [], group_name: '品牌背景和定位', category: '极氧', brand: '极氧' },
      { id: 'm3', title: '日抛和月抛的区别', url: 'https://x.com/3', tags: ['抛型'], group_name: '基础知识', category: '美瞳抛型', brand: '' },
      { id: 'm4', title: '硅水凝胶材质讲解', url: 'https://x.com/4', tags: ['材质'], group_name: '基础知识', category: '材质', brand: '' },
      { id: 'm5', title: '订单查询操作步骤', url: 'https://x.com/5', tags: ['ERP'], group_name: 'ERP操作', category: '查询订单', brand: '' },
      { id: 'm6', title: '老资料无大类', url: 'https://x.com/6', tags: [], group_name: null, category: '旧分类', brand: '' }
    ];
    trainingGroup = '全部';
    trainingSubcatFilter = '全部';
  });

  // 渲染「全部」模式
  await page.evaluate(() => renderTraining());
  await new Promise(r => setTimeout(r, 500));

  const allMode = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#training-content .train-card')];
    return cards.map(c => {
      const title = c.querySelector('.train-card-header h3')?.textContent;
      const count = c.querySelector('.train-card-count')?.textContent;
      const subs = [...c.querySelectorAll('.train-sub-title')].map(s => s.textContent);
      const links = [...c.querySelectorAll('.train-link-item a')].map(a => a.textContent);
      return { title, count, subs, links };
    });
  });
  console.log('== 「全部」模式卡片 ==');
  allMode.forEach(c => console.log(JSON.stringify(c)));

  // 切换到「基础知识」大类
  await page.evaluate(() => setTrainingGroup('基础知识'));
  await new Promise(r => setTimeout(r, 500));

  const groupMode = await page.evaluate(() => {
    const subTabs = document.getElementById('training-subcat-tabs').innerText;
    const cards = [...document.querySelectorAll('#training-content .train-card')].map(c => ({
      title: c.querySelector('.train-card-header h3')?.textContent,
      count: c.querySelector('.train-card-count')?.textContent,
      links: [...c.querySelectorAll('.train-link-item a')].map(a => a.textContent)
    }));
    return { subTabs, cards };
  });
  console.log('== 选中「基础知识」==');
  console.log('小类 Tab: ' + groupMode.subTabs);
  groupMode.cards.forEach(c => console.log(JSON.stringify(c)));

  // 选中小类「材质」
  await page.evaluate(() => setTrainingSubcat('材质'));
  await new Promise(r => setTimeout(r, 400));
  const subMode = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#training-content .train-card')].map(c => ({
      title: c.querySelector('.train-card-header h3')?.textContent,
      links: [...c.querySelectorAll('.train-link-item a')].map(a => a.textContent)
    }));
    return cards;
  });
  console.log('== 选中小类「材质」==');
  subMode.forEach(c => console.log(JSON.stringify(c)));

  // 验证编辑弹窗联动
  await page.evaluate(() => openTrainingEditor(null));
  await new Promise(r => setTimeout(r, 400));
  const editor = await page.evaluate(() => {
    const g = document.getElementById('tf-group');
    const c = document.getElementById('tf-cat');
    const gOptions = [...g.options].map(o => o.text);
    const cOptions = [...c.options].map(o => o.text);
    // 切换大类到 ERP操作
    g.value = 'ERP操作';
    syncTrainingSubcats();
    const cOptions2 = [...document.getElementById('tf-cat').options].map(o => o.text);
    return { gOptions, cOptions, cOptions2 };
  });
  console.log('== 编辑弹窗联动 ==');
  console.log('大类选项: ' + editor.gOptions.join(','));
  console.log('初始小类选项: ' + editor.cOptions.join(','));
  console.log('切到ERP后小类选项: ' + editor.cOptions2.join(','));
  await page.evaluate(() => closeModal('mod-training'));

  // 验证知识卡：切到 美瞳抛型 并注入 knowledge 假数据
  await page.evaluate(() => {
    trainingKnowledge = [
      { subcat:'美瞳抛型', section_type:'overview', title:'抛型对比总览', icon:'👁️', content:{items:[{icon:'👁️',name:'日抛',desc:'佩戴 1 天，当天丢弃'},{icon:'🌙',name:'月抛',desc:'约 30 天，需每日护理'},{icon:'🍃',name:'季抛',desc:'约 90 天'},{icon:'🌿',name:'半年抛',desc:'约 180 天'},{icon:'🗓️',name:'年抛',desc:'约 365 天'}]}, sort_order:10 },
      { subcat:'美瞳抛型', section_type:'cards', title:'佩戴与护理要点', icon:'💡', content:{items:[{title:'建议佩戴时长',body:'每日不超过 8 小时，睡眠游泳时取下。'},{title:'护理要求',body:'长周期抛需每日揉搓清洗、浸泡至少 4 小时。'}]}, sort_order:20 },
      { subcat:'美瞳抛型', section_type:'steps', title:'长周期抛日常护理步骤', icon:'🧴', content:{items:[{title:'摘镜洗手',body:'洗净双手并擦干。'},{title:'揉搓清洗',body:'揉搓正反面各 10 秒。'},{title:'浸泡保存',body:'浸泡至少 4 小时。'}]}, sort_order:30 }
    ];
    setTrainingGroup('基础知识');
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => setTrainingSubcat('美瞳抛型'));
  await new Promise(r => setTimeout(r, 500));
  const know = await page.evaluate(() => {
    const k = document.querySelector('.train-knowledge');
    return k ? k.innerText.replace(/\n+/g, ' | ').slice(0, 500) : '❌ 无知识卡';
  });
  console.log('== 美瞳抛型知识卡 ==');
  console.log(know);

  await page.screenshot({ path: 'outputs/training-knowledge.png' });
  console.log('知识卡截图已保存');

  // 验证品牌资料卡片图标（弥生/极氧不再用花朵）
  await page.evaluate(() => {
    setTrainingGroup('品牌背景和定位');
  });
  await new Promise(r => setTimeout(r, 300));
  const brandCards = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.train-link-item')];
    return cards.map(c => ({
      icon: c.querySelector('.train-card-icon')?.innerText || '',
      title: c.querySelector('.train-card-title-wrap a')?.innerText || ''
    }));
  });
  console.log('== 品牌资料卡片图标 ==');
  console.log(brandCards.map(c => c.icon + ' ' + c.title).join(' | '));
  await page.screenshot({ path: 'outputs/training-two-level.png' });
  console.log('品牌卡片截图已保存');

  // 验证卡片点击弹窗显示注解
  await page.evaluate(() => {
    setTrainingGroup('品牌背景和定位');
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => setTrainingSubcat('弥生'));
  await new Promise(r => setTimeout(r, 300));
  const detail = await page.evaluate(() => {
    const card = document.querySelector('.train-link-item');
    if (!card) return { ok:false, reason:'无卡片' };
    card.click();
    const modal = document.getElementById('mod-train-detail');
    const shown = modal.classList.contains('show');
    const title = document.getElementById('mod-train-detail-title').innerText;
    const body = document.getElementById('mod-train-detail-body').innerText;
    const openBtn = document.getElementById('mod-train-detail-open');
    return { ok:true, shown, title, bodyLen: body.length, openBtnShown: openBtn.style.display !== 'none' };
  });
  console.log('== 卡片点击弹窗 ==');
  console.log(JSON.stringify(detail));
  await page.screenshot({ path: 'outputs/training-detail.png' });
  console.log('详情弹窗截图已保存');
  // 关闭弹窗
  await page.evaluate(() => closeModal('mod-train-detail'));

  console.log('\n== 错误收集 ==');
  // 忽略本地无 training_knowledge 表的预期错误（线上 SQL 执行后不会出现）
  const realErrors = errors.filter(e => !e.includes('知识卡加载失败'));
  console.log(realErrors.length ? realErrors.join('\n') : '✅ 无 console/page 错误（已忽略本地无表的预期错误）');

  await browser.close();
  process.exit(realErrors.length ? 1 : 0);
})();
