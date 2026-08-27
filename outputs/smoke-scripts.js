// 售前话术板块 冒烟测试（注入假数据，模拟 SQL 执行后状态）
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

  // 注入假数据（模拟 SQL 执行后：training_categories 含 售前话术 + 佩戴问题；training_scripts 有示例）
  await page.evaluate(() => {
    trainingCategories = [
      { id: 'g1', name: '品牌背景和定位', sort_order: 100, parent_id: '' },
      { id: 'g2', name: '基础知识', sort_order: 200, parent_id: '' },
      { id: 's0', name: '售前话术', sort_order: 500, parent_id: '' },
      { id: 's0a', name: '佩戴问题', sort_order: 510, parent_id: '售前话术' },
      { id: 's0b', name: '产品咨询', sort_order: 520, parent_id: '售前话术' }
    ];
    trainingScripts = [
      { id: 'sc1', category: '售前话术', subcategory: '佩戴问题', title: '新客不会佩戴/怕上手',
        styles: { '标准':'洗净手，指腹捏镜片，先右后左，对着镜子戴。', '亲切':'宝子别慌～第一次戴都这样，对着镜子慢慢来。', '简短':'洗净手→指腹捏→先右后左→对镜戴。', '专业':'佩戴前用无絮纸巾擦干手指，镜片置于食指指腹，另一只手拉开上下眼睑直视前方轻贴角膜。', '安抚':'理解第一次戴会紧张，练几次就顺手了，有任何不舒服随时找我～' },
        tags: ['新手','佩戴'], sort_order: 10 },
      { id: 'sc2', category: '售前话术', subcategory: '佩戴问题', title: '镜片磨眼/有异物感',
        styles: { '标准':'异物感可能是戴反或异物，取下重新清洗再佩戴。', '亲切':'宝是不是戴反啦？翻过来就舒服咯。', '简短':'取下→冲洗→确认正反面→重戴。', '专业':'', '安抚':'' },
        tags: ['磨眼','售后'], sort_order: 20 },
      { id: 'sc3', category: '售前话术', subcategory: '产品咨询', title: '花色怎么选',
        styles: { '标准':'根据瞳色和妆容选，自然款日常，混血款拍照。', '亲切':'宝想要日常还是上镜呀？我帮你搭～', '简短':'日常选自然款，拍照选混血款。', '专业':'结合虹膜直径与肤色推荐，避免直径过大显假。', '安抚':'' },
        tags: ['花色'], sort_order: 10 }
    ];
    trainingGroup = '售前话术';
    trainingSubcatFilter = '全部';
  });

  await page.evaluate(() => renderTraining());
  await new Promise(r => setTimeout(r, 600));

  const allMode = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#training-content .train-card')].map(c => ({
      title: c.querySelector('.train-card-header h3')?.textContent,
      count: c.querySelector('.train-card-count')?.textContent,
      items: [...c.querySelectorAll('.train-link-item')].map(it => ({
        title: it.querySelector('.train-card-title-wrap a')?.textContent,
        chips: [...it.querySelectorAll('.sc-chip')].map(ch => ch.textContent)
      }))
    }));
    const addRow = !!document.querySelector('.train-add-row');
    const subTabs = document.getElementById('training-subcat-tabs').innerText.replace(/\n/g,'|');
    const addBtn = document.getElementById('train-add-btn')?.textContent;
    const sub = document.getElementById('training-subtitle')?.textContent;
    return { cards, addRow, subTabs, addBtn, sub: sub.slice(0,40) };
  });
  console.log('== 售前话术「全部」模式 ==');
  console.log('小类Tab: ' + allMode.subTabs);
  console.log('顶部按钮文案: ' + allMode.addBtn + ' | 副标题: ' + allMode.sub);
  console.log('新增行存在: ' + allMode.addRow);
  allMode.cards.forEach(c => console.log(JSON.stringify(c)));

  // 点击 sc1 卡片 → 详情弹窗
  await page.evaluate(() => { openScriptDetail(window._scriptRefs['sc1']); });
  await new Promise(r => setTimeout(r, 500));
  const detail = await page.evaluate(() => {
    const shown = document.getElementById('mod-script-detail').classList.contains('show');
    const title = document.getElementById('mod-script-detail-title').innerText;
    const styles = [...document.querySelectorAll('#mod-script-detail-body .sc-style')].map(s => ({
      name: s.querySelector('.sc-style-name')?.textContent,
      hasCopy: !!s.querySelector('.sc-copy'),
      isEmpty: s.classList.contains('empty'),
      bodyLen: (s.querySelector('.sc-style-body')?.innerText || '').length
    }));
    return { shown, title, styles };
  });
  console.log('== 话术详情弹窗(sc1) ==');
  console.log('显示: ' + detail.shown + ' | 标题: ' + detail.title);
  detail.styles.forEach(s => console.log(JSON.stringify(s)));

  await page.screenshot({ path: 'outputs/scripts-detail.png' });
  await page.evaluate(() => closeModal('mod-script-detail'));
  await new Promise(r => setTimeout(r, 300));

  // 打开编辑弹窗（新增）→ 验证 5 个风格 textarea
  await page.evaluate(() => openScriptEditor(null));
  await new Promise(r => setTimeout(r, 400));
  const editor = await page.evaluate(() => {
    const tas = ['标准','亲切','简短','专业','安抚'].map(k => !!document.getElementById('sf-style-' + k));
    const sub = document.getElementById('sf-sub');
    const list = document.getElementById('sf-sub-list');
    return { tasAll: tas.every(Boolean), tas, subVal: sub?.value, listOptions: list ? [...list.options].map(o=>o.value) : [] };
  });
  console.log('== 话术编辑弹窗 ==');
  console.log('5个风格输入框: ' + JSON.stringify(editor.tas) + ' 全部存在: ' + editor.tasAll);
  console.log('小类输入框值: "' + editor.subVal + '" | datalist选项: ' + editor.listOptions.join(','));
  await page.evaluate(() => closeModal('mod-script'));
  await new Promise(r => setTimeout(r, 300));

  // 筛选到「产品咨询」小类
  await page.evaluate(() => setTrainingSubcat('产品咨询'));
  await new Promise(r => setTimeout(r, 400));
  const subMode = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#training-content .train-link-item')].map(it => it.querySelector('.train-card-title-wrap a')?.textContent);
    return items;
  });
  console.log('== 小类「产品咨询」筛选 ==');
  console.log('卡片: ' + JSON.stringify(subMode));

  // 回到全部并截图
  await page.evaluate(() => { setTrainingGroup('售前话术'); });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'outputs/scripts-list.png' });

  console.log('\n== 控制台/页面错误 ==');
  console.log(errors.length ? errors.join('\n') : '✅ 无错误');

  await browser.close();
})();
