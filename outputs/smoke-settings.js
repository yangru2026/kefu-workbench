const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://127.0.0.1:8123/qc-v2.html';
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const errs=[];
  const browser = await puppeteer.launch({executablePath:path, headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.on('console', m=>{ if(m.type()==='error'){ const t=m.text(); if(!/favicon/i.test(t)) errs.push('CONSOLE:'+t); }});
  page.on('pageerror', e=>errs.push('PAGEERROR:'+e.message));
  page.on('response', r=>{ const s=r.status(); if(s>=400 && !/favicon/i.test(r.url())) errs.push('HTTP'+s+':'+r.url()); });

  await page.goto(BASE+'?demo', {waitUntil:'networkidle0'});
  await sleep(400);

  // 1) 基础数据按钮在 DEMO（管理员）下可见
  const btnVisible = await page.evaluate(()=>{
    const b=document.getElementById('btnSettings');
    return b && b.style.display!=='none' && !b.disabled;
  });

  // 2) 打开弹窗
  await page.evaluate(()=>openSettingsModal()); await sleep(200);
  const modalInfo = await page.evaluate(()=>({
    open: document.getElementById('settingsModal').classList.contains('active'),
    staffList: !!document.getElementById('setStaffList'),
    shopList: !!document.getElementById('setShopList'),
    staffInput: !!document.getElementById('setStaffInput'),
    shopInput: !!document.getElementById('setShopInput'),
    staffTags: document.querySelectorAll('#setStaffList .tag').length,
    shopTags: document.querySelectorAll('#setShopList .tag').length
  }));

  // 3) 空输入点添加 → 预期「请输入名称」提示
  await page.evaluate(()=>{ document.getElementById('setStaffInput').value=''; addOption('staff'); });
  await sleep(100);
  const emptyToast = await page.evaluate(()=>document.getElementById('toast').textContent);

  // 4) DEMO 下点批量添加 → 预期「演示模式不可保存」守卫
  await page.evaluate(()=>{ document.getElementById('setStaffInput').value='测试客服A,测试客服B\n测试客服C'; addBatchOptions('staff'); });
  await sleep(100);
  const demoToast = await page.evaluate(()=>document.getElementById('toast').textContent);

  // 5) 批量识别预览
  await page.evaluate(()=>{ document.getElementById('setShopInput').value='抖音5店，小红书店 京东店\n天猫店'; parseOptionPreview('shop'); });
  await sleep(100);
  const previewTags = await page.evaluate(()=>document.querySelectorAll('#setShopPreview .tag').length);

  // 6) 彩色下拉组件 HTML 生成函数（客服/店铺）
  const selectHtml = await page.evaluate(()=>{
    staffOptions=['示例客服A','示例客服B']; shopOptions=['抖音1店','淘宝旗舰店'];
    return {
      staff: staffSelectHtml('示例客服A'),
      shop: shopSelectHtml(''),
      sev: sevPillsHtml('严重'),
      tag: tagChipHtml('态度问题', true)
    };
  });

  await browser.close();
  const real=errs.filter(e=>!/Failed to load resource/.test(e));
  const report={
    btnVisible, modalInfo, emptyToast, demoToast,
    staffIsColorSelect: selectHtml.staff.includes('class="color-select"') && selectHtml.staff.includes('id="e_staff"') && selectHtml.staff.includes('示例客服A'),
    shopIsColorSelect: selectHtml.shop.includes('class="color-select"') && selectHtml.shop.includes('id="e_shop"'),
    sevHasPills: selectHtml.sev.includes('class="pill-row"') && selectHtml.sev.includes('严重'),
    tagHasColor: selectHtml.tag.includes('background') && selectHtml.tag.includes('态度问题'),
    realErrors:real
  };
  report.previewTags = previewTags;
  console.log(JSON.stringify(report,null,2));
  const ok = btnVisible && modalInfo.open && modalInfo.staffList && modalInfo.shopList && modalInfo.staffInput && modalInfo.shopInput
    && modalInfo.staffTags>0 && modalInfo.shopTags>0
    && /请输入名称/.test(emptyToast) && /演示模式/.test(demoToast)
    && previewTags===4
    && report.staffIsColorSelect && report.shopIsColorSelect && report.sevHasPills && report.tagHasColor && real.length===0;
  console.log(ok?'SETTINGS_OK':'SETTINGS_FAIL');
  process.exit(ok?0:1);
})().catch(e=>{ console.error('FATAL',e.message); process.exit(2); });
