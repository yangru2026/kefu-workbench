const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://127.0.0.1:8123/qc-v2.html';
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const errs=[];
  const browser = await puppeteer.launch({executablePath:path, headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.on('console', m=>{ if(m.type()==='error'){ const t=m.text(); if(!/favicon/i.test(t) && !/blob:fake/.test(t)) errs.push('CONSOLE:'+t); }});
  page.on('pageerror', e=>errs.push('PAGEERROR:'+e.message));
  page.on('response', r=>{ const s=r.status(); if(s>=400 && !/favicon/i.test(r.url())) errs.push('HTTP'+s+':'+r.url()); });

  await page.goto(BASE+'?demo', {waitUntil:'networkidle0'});
  await sleep(400);

  // 1) 截图必填：新增记录，不传截图应被拦截；补图后应能通过校验
  const shotReq = await page.evaluate(async ()=>{
    openEditModal(null);
    document.getElementById('e_staff').value='示例客服A';
    document.getElementById('e_shop').value='抖音1店';
    document.getElementById('e_date').value='2026-09-03';
    document.getElementById('e_problem').value='测试问题';
    saveEdit();
    await new Promise(r=>setTimeout(r,100));
    const toastNoImg=document.getElementById('toast').textContent;
    // 补一张截图后再保存应通过校验（DEMO 分支不弹成功 toast，故校验 t2 不为「必填」提示）
    pendingUploads.scene.push({src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',file:null,isNew:false});
    document.getElementById('toast').textContent='';
    saveEdit();
    await new Promise(r=>setTimeout(r,150));
    const toastAfterImg=document.getElementById('toast').textContent;
    return {toastNoImg, toastAfterImg};
  });

  // 2) 全选 / 取消全选
  const sel = await page.evaluate(()=>{
    clearSelection(); const empty=selectedRecordIds.size;
    selectAllVisible(); const all=selectedRecordIds.size;
    clearSelection(); const cleared=selectedRecordIds.size;
    return {empty, all, cleared, total:getFiltered().length};
  });

  // 3) 导出 Excel 含图（直接验证 OOXML 结构 + 图片嵌入对应单元格）
  const exp = await page.evaluate(async ()=>{
    let captured=null;
    const origClick=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){};
    const oc=URL.createObjectURL; URL.createObjectURL=function(b){ captured=b; return 'blob:fake'; };
    const orv=URL.revokeObjectURL; URL.revokeObjectURL=function(){};
    // 直接调用带图导出：在第 2 行(0基 row=1) 第 9 列(0基 col=8 = 客户问题截图1) 放一张图
    const fakePng=new Uint8Array([0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0xFF,0xD9]);
    const header=['日期','客服','客户ID','店铺','问题分类','严重程度','状态','扣罚金额','客户问题截图1','客户问题截图2','客户问题截图3','问题表述','正确做法','知识点','知识点截图1','知识点截图2','知识点截图3','备注','讲解日期','讲解备注'];
    const dataRow=['2026-09-03','示例客服A','C-001','抖音1店','话术问题','一般','待讲解',0,'','','','','这是问题表述','正确做法','知识点','','','','','',  ''];
    downloadXLSXWithImages('t.xlsx', [header, dataRow], [{row:1,col:8,data:fakePng,ext:'jpg',cx:300000,cy:300000}]);
    await new Promise(r=>setTimeout(r,100));
    HTMLAnchorElement.prototype.click=origClick; URL.createObjectURL=oc; URL.revokeObjectURL=orv;
    const info={hasBlob:!!captured,size:captured?captured.size:0,type:captured?captured.type:''};
    if(captured){
      const buf=await captured.arrayBuffer();
      const txt=new TextDecoder().decode(buf);
      info.hasMedia=/xl\/media\/image1\.jpg/.test(txt);
      info.hasDrawing=/drawing1\.xml/.test(txt);
      info.hasAnchor=/oneCellAnchor/.test(txt);
      info.anchorCol8=/<xdr:col>8<\/xdr:col>/.test(txt);
      info.colWidth18=/width="18"/.test(txt);
      info.rowH100=/ht="100"/.test(txt);
    }
    return info;
  });

  // 4) 完整 exportXLSX 流程（注入可 fetch 的 PNG，验证端到端不报错且产生 blob）
  const flow = await page.evaluate(async ()=>{
    let captured=null;
    const origClick=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){};
    const oc=URL.createObjectURL; URL.createObjectURL=function(b){ captured=b; return 'blob:fake'; };
    const orv=URL.revokeObjectURL; URL.revokeObjectURL=function(){};
    records[0].scene_images=['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='];
    await exportXLSX();
    await new Promise(r=>setTimeout(r,300));
    HTMLAnchorElement.prototype.click=origClick; URL.createObjectURL=oc; URL.revokeObjectURL=orv;
    return {hasBlob:!!captured, size:captured?captured.size:0, type:captured?captured.type:'', name:captured?captured.type:''};
  });

  await browser.close();
  const report={shotReq, sel, exp, flow, realErrors:errs.filter(e=>!/Failed to load resource/.test(e))};
  console.log(JSON.stringify(report,null,2));
  const ok = shotReq.toastNoImg.indexOf('客户问题截图（必填）')>=0 && shotReq.toastAfterImg!=='客户问题截图（必填）'
    && sel.empty===0 && sel.all===sel.total && sel.cleared===0
    && exp.hasBlob && exp.hasMedia && exp.hasDrawing && exp.hasAnchor && exp.anchorCol8 && exp.colWidth18 && exp.rowH100
    && flow.hasBlob && /spreadsheetml/.test(flow.type||'')
    && report.realErrors.length===0;
  console.log(ok?'EXPORT_OK':'EXPORT_FAIL');
  process.exit(ok?0:1);
})().catch(e=>{ console.error('FATAL',e.message); process.exit(2); });
