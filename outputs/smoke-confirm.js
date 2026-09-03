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

  const info = await page.evaluate(()=>{
    // 模拟一个普通客服登录（示例客服A）
    currentAuthUser = {name:'示例客服A', phone:'', id:'demo-uuid-1'};
    isAdmin = false;
    qcConfirmations = [];
    const asSubject = confirmControlHtml({id:9000000001, staff:'示例客服A'});
    const asOther = confirmControlHtml({id:9000000002, staff:'示例客服B'});
    // 模拟已确认
    qcConfirmations = [{record_id:9000000003, staff:'示例客服A', confirmed_at:'2026-09-03T10:00:00Z'}];
    const asConfirmed = confirmControlHtml({id:9000000003, staff:'示例客服A'});
    // 管理员视角
    isAdmin = true;
    qcConfirmations = [{record_id:9000000003, staff:'示例客服A', confirmed_at:'2026-09-03T10:00:00Z'}];
    const asAdmin = confirmControlHtml({id:9000000003, staff:'示例客服A'});
    return {asSubject, asOther, asConfirmed, asAdmin};
  });

  // 表格是否有「确认」列
  await page.evaluate(()=>{ isAdmin=false; currentAuthUser={name:'示例客服A',phone:'',id:'x'}; renderRecords(); });
  await sleep(150);
  const tableHasCol = await page.evaluate(()=>{
    const ths=[...document.querySelectorAll('table.grid thead th')].map(t=>t.textContent.trim());
    return ths.includes('确认');
  });

  await browser.close();
  const real=errs.filter(e=>!/Failed to load resource/.test(e));
  const report={info, tableHasCol, realErrors:real};
  console.log(JSON.stringify(report,null,2));
  const ok = info.asSubject.includes('本人确认已知晓')
    && !info.asOther.includes('本人确认')
    && info.asConfirmed.includes('本人已确认')
    && info.asAdmin.includes('已确认')
    && tableHasCol && real.length===0;
  console.log(ok?'CONFIRM_OK':'CONFIRM_FAIL');
  process.exit(ok?0:1);
})().catch(e=>{ console.error('FATAL',e.message); process.exit(2); });
