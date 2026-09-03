const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://127.0.0.1:8123/qc-v2.html';
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const errs=[];
  const browser = await puppeteer.launch({executablePath:path, headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.on('console', m=>{ if(m.type()==='error'){ const t=m.text(); if(!/favicon/i.test(t) && !/blob:fake/.test(t) && !/Failed to load resource/i.test(t)) errs.push('CONSOLE:'+t); }});
  page.on('pageerror', e=>errs.push('PAGEERROR:'+e.message));
  page.on('response', r=>{ const s=r.status(); if(s>=400 && !/favicon/i.test(r.url())) errs.push('HTTP'+s+':'+r.url()); });
  await page.goto(BASE+'?demo', {waitUntil:'networkidle0'});
  await sleep(500);

  // 管理员 / 组长：父页面两者都传 setQcMode(true)，权限完全一致
  const admin = await page.evaluate(()=>{
    setQcMode(true);
    const vis = id => { const e=document.getElementById(id); return e? getComputedStyle(e).display!=='none' : false; };
    return {
      addEnabled: !document.getElementById('btnAddRecord').disabled,
      send: vis('btnSend'),
      selectAll: vis('btnSelectAll'),
      clearSel: vis('btnClearSel'),
      settings: vis('btnSettings'),
      analysis: vis('btnAnalysis'),
      coach: vis('btnCoach'),
      export: vis('btnExport'),
    };
  });

  // 普通客服：setQcMode(false)
  const cs = await page.evaluate(async ()=>{
    setQcMode(false);
    const hidden = id => { const e=document.getElementById(id); return e? getComputedStyle(e).display==='none' : false; };
    const r = {
      addDisabled: document.getElementById('btnAddRecord').disabled,
      sendHidden: hidden('btnSend'),
      selectAllHidden: hidden('btnSelectAll'),
      clearSelHidden: hidden('btnClearSel'),
      settingsHidden: hidden('btnSettings'),
      analysisHidden: hidden('btnAnalysis'),
      coachHidden: hidden('btnCoach'),
      exportHidden: hidden('btnExport'),
    };
    // 列表渲染后：图片必须仍可点击放大（用 bindThumbs + 桩 URL 直接验证机制，不依赖 DEMO 假图能否解析）
    setView('card'); renderRecords();
    const origGet = window.getImageUrl;
    window.getImageUrl = async ()=> 'https://example.com/x.jpg';
    const div = document.createElement('div');
    div.innerHTML = '<div class="thumbs"><img data-img="abc"></div>';
    let previewCalled=false; const origPrev=window.previewImage;
    window.previewImage=()=>{ previewCalled=true; };
    bindThumbs(div);
    await new Promise(res=>setTimeout(res,60));
    const timg = div.querySelector('img');
    r.thumbClickable = !!timg && typeof timg.onclick==='function';
    if(timg && typeof timg.onclick==='function') timg.onclick({stopPropagation(){}});
    r.previewTriggered = previewCalled;
    window.previewImage=origPrev; window.getImageUrl=origGet;
    // 确认收到：本人记录显示按钮，他人记录不显示
    currentAuthUser = {name:'示例客服A', phone:''};
    const myRec = {staff:'示例客服A', id:1};
    const otherRec = {staff:'别的客服', id:2};
    r.confirmBtnSelf = /本人确认已知晓/.test(confirmControlHtml(myRec));
    r.confirmBtnOther = confirmControlHtml(otherRec); // 应为空串
    return r;
  });

  console.log(JSON.stringify({admin, cs, errs}, null, 2));
  const okAdmin = admin.addEnabled && admin.send && admin.selectAll && admin.clearSel && admin.settings && admin.analysis && admin.coach && admin.export;
  const okCs = cs.addDisabled && cs.sendHidden && cs.selectAllHidden && cs.clearSelHidden && cs.settingsHidden && cs.analysisHidden && cs.coachHidden && cs.exportHidden && cs.thumbClickable && cs.previewTriggered && cs.confirmBtnSelf && cs.confirmBtnOther==='';
  console.log('admin==leader full:', okAdmin, '| cs read+image+confirm only:', okCs, '| realErrors:', errs.length);
  console.log(okAdmin && okCs && errs.length===0 ? 'PERMS_OK' : 'PERMS_FAIL');
  await browser.close();
})();
