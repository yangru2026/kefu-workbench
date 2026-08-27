// 售前话术「分组」三层维度 冒烟测试（注入带 script_group 的假数据）
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
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    trainingCategories = [
      { id: 's0', name: '售前话术', sort_order: 500, parent_id: '' },
      { id: 's0a', name: '佩戴问题', sort_order: 510, parent_id: '售前话术' },
      { id: 's0b', name: '产品咨询', sort_order: 520, parent_id: '售前话术' }
    ];
    trainingScripts = [
      { id: 'sc1', category: '售前话术', subcategory: '佩戴问题', script_group: '通用', title: '新客不会佩戴',
        styles: { '标准':'洗手对镜戴。','亲切':'宝别慌～','简短':'洗手戴。','专业':'拉开眼睑。','安抚':'练几次就好。' }, tags: ['新手'], sort_order: 10 },
      { id: 'sc2', category: '售前话术', subcategory: '佩戴问题', script_group: '一组', title: '镜片磨眼',
        styles: { '标准':'取下重洗。','亲切':'戴反啦。','简短':'重戴。','专业':'','安抚':'' }, tags: ['磨眼'], sort_order: 20 },
      { id: 'sc3', category: '售前话术', subcategory: '产品咨询', script_group: '二组', title: '花色怎么选',
        styles: { '标准':'按瞳色选。','亲切':'帮你搭～','简短':'自然款日常。','专业':'结合虹膜。','安抚':'' }, tags: ['花色'], sort_order: 10 },
      { id: 'sc4', category: '售前话术', subcategory: '产品咨询', script_group: '三组', title: '度数怎么算',
        styles: { '标准':'框架减25。','亲切':'我帮你算。','简短':'减25。','专业':'等效球镜。','安抚':'' }, tags: ['度数'], sort_order: 20 }
    ];
    trainingGroup = '售前话术';
    trainingSubcatFilter = '全部';
    trainingScriptGroup = '全部';
  });

  await page.evaluate(() => renderTraining());
  await new Promise(r => setTimeout(r, 600));

  // 1) 第二行 Tab 应为分组（全部/通用/一组/二组/三组）
  const tabs = await page.evaluate(() => {
    return document.getElementById('training-subcat-tabs').innerText.replace(/\n/g, '|');
  });
  console.log('== 第二行分组Tab ==');
  console.log('Tab: ' + tabs);

  // 2) 全部模式：按话题分组，卡片带分组角标
  const allMode = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#training-content .train-card')].map(c => ({
      topic: c.querySelector('.train-card-header h3')?.textContent,
      items: [...c.querySelectorAll('.train-link-item')].map(it => ({
        title: it.querySelector('.train-card-title-wrap a')?.textContent,
        grp: it.querySelector('.sc-group-badge')?.textContent
      }))
    }));
    return cards;
  });
  console.log('== 全部模式（按话题分组 + 分组角标） ==');
  allMode.forEach(c => console.log(JSON.stringify(c)));

  // 3) 点击「一组」分组 Tab → 仅显示一组
  await page.evaluate(() => setTrainingScriptGroup('一组'));
  await new Promise(r => setTimeout(r, 500));
  const grpMode = await page.evaluate(() => {
    const badges = [...document.querySelectorAll('#training-content .sc-group-badge')].map(b => b.textContent);
    const titles = [...document.querySelectorAll('#training-content .train-link-item .train-card-title-wrap a')].map(a => a.textContent);
    const activeTab = [...document.querySelectorAll('#training-subcat-tabs .training-cat-tab')].find(t => t.classList.contains('active'))?.textContent;
    return { badges, titles, activeTab };
  });
  console.log('== 仅「一组」筛选 ==');
  console.log('激活Tab: ' + grpMode.activeTab + ' | 卡片标题: ' + JSON.stringify(grpMode.titles) + ' | 角标: ' + JSON.stringify(grpMode.badges));

  // 4) 编辑弹窗含分组 select，默认 一组（因当前 trainingScriptGroup=一组）
  await page.evaluate(() => openScriptEditor(null));
  await new Promise(r => setTimeout(r, 400));
  const editor = await page.evaluate(() => {
    const sel = document.getElementById('sf-group');
    return { hasGroup: !!sel, options: sel ? [...sel.options].map(o => o.value) : [], defaultVal: sel ? sel.value : null };
  });
  console.log('== 编辑弹窗分组字段 ==');
  console.log('含分组select: ' + editor.hasGroup + ' | 选项: ' + editor.options.join(',') + ' | 默认值: ' + editor.defaultVal);

  // 5) 模拟保存读取 script_group
  const saved = await page.evaluate(() => {
    document.getElementById('sf-sub').value = '佩戴问题';
    document.getElementById('sf-title').value = '测试场景';
    document.getElementById('sf-group').value = '三组';
    document.getElementById('sf-style-标准').value = 'x';
    // 拦截数据库写入，直接验证 saveScript 组装的 data
    let captured = null;
    const origFrom = supabase.from.bind(supabase);
    supabase.from = (t) => { captured = { table: t }; return origFrom(t); };
    saveScript();
    return captured;
  });
  console.log('== saveScript 组装（拦截DB写入） ==');
  console.log('写入表: ' + (saved ? saved.table : 'null'));

  await page.evaluate(() => closeModal('mod-script'));
  await new Promise(r => setTimeout(r, 300));

  // 6) 详情弹窗分组角标
  await page.evaluate(() => { setTrainingScriptGroup('全部'); openScriptDetail(window._scriptRefs['sc3']); });
  await new Promise(r => setTimeout(r, 400));
  const detail = await page.evaluate(() => ({
    shown: document.getElementById('mod-script-detail').classList.contains('show'),
    title: document.getElementById('mod-script-detail-title').innerText
  }));
  console.log('== 详情弹窗分组角标 ==');
  console.log('显示: ' + detail.shown + ' | 标题含角标: ' + detail.title);
  await page.screenshot({ path: 'outputs/scripts-group.png' });

  console.log('\n== 控制台/页面错误 ==');
  console.log(errors.length ? errors.join('\n') : '✅ 无错误');

  await browser.close();
})();
