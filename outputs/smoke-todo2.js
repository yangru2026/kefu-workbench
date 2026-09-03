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

  // Part A: DEMO 页面 —— 普通客服 + 待确认模式：日期倒序 + 超 N 天标红加急 + 提醒条含「加急」
  await page.goto(BASE+'?demo', {waitUntil:'networkidle0'});
  await sleep(600);
  const partA = await page.evaluate(()=>{
    const ymd=d=>{const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());};
    const mk=(id,d)=>({id,staff:'示例客服A',date:d,shop:'抖音1店',status:'pending',severity:'一般',tags:['话术问题'],problem:'问题',correct:'正确',scene_images:[],reply_images:[],knowledge_images:[]});
    const oldD=ymd(new Date(Date.now()-10*86400000));
    const newD=ymd(new Date(Date.now()-1*86400000));
    records=[mk(1,oldD), mk(2,newD), {id:3,staff:'别的客服',date:newD,shop:'抖音2店',status:'pending',severity:'一般',tags:[],problem:'p',correct:'c',scene_images:[],reply_images:[],knowledge_images:[]}];
    qcConfirmations=[];
    setQcMode(false);
    currentAuthUser={name:'示例客服A',phone:''};
    qcTodoMode=true;
    setView('card'); renderRecords();
    const list=getFiltered();
    const sortedDesc = list.length===2 && list[0].id===2 && list[1].id===1;
    const urgentPills=document.querySelectorAll('#recordList .urgent-pill').length;
    const todoPills=document.querySelectorAll('#recordList .todo-pill').length;
    const text=document.getElementById('qcTodoText').textContent;
    const overdueDaysOld = qcPendingDays(records[0]);
    return {listLen:list.length, sortedDesc, urgentPills, todoPills, text, overdueDaysOld};
  });

  // Part B: 非 DEMO 页面 —— 客服确认后，组长/管理员收到站内通知
  await page.goto(BASE, {waitUntil:'domcontentloaded'});
  await sleep(900);
  const partB = await page.evaluate(async ()=>{
    const inserts=[];
    window.supabase={ from:(t)=>({
      insert:(row)=>{ inserts.push({table:t,row}); return Promise.resolve({error:null}); },
      select:()=>({ in:()=>Promise.resolve({data:[{id:'aid1'},{id:'aid2'}],error:null}) }),
      eq:()=>Promise.resolve({data:null,error:null}),
      single:()=>Promise.resolve({data:null,error:null})
    }) };
    currentAuthUser={name:'示例客服A',phone:'',id:'cs1'};
    records=[{id:1,staff:'示例客服A',date:'2026-09-01',shop:'抖音1店',status:'pending',severity:'一般',tags:[],problem:'p',correct:'c',scene_images:[],reply_images:[],knowledge_images:[]}];
    qcConfirmations=[];
    await confirmRecord(1);
    const notif=inserts.find(i=>i.table==='notifications');
    const conf=inserts.find(i=>i.table==='qc_confirmations');
    return {notifExists:!!notif, notifContent: notif?notif.row.content:'', notifCount: inserts.filter(i=>i.table==='notifications').length, confExists:!!conf};
  });

  console.log(JSON.stringify({partA, partB, errs}, null, 2));
  const okA = partA.sortedDesc && partA.urgentPills===1 && partA.todoPills===2 && /加急/.test(partA.text) && partA.overdueDaysOld>=3;
  const okB = partB.notifExists && /示例客服A/.test(partB.notifContent) && partB.notifCount>=1 && partB.confExists;
  console.log('A 排序+加急+提醒:', okA, '| B 确认后通知组长/管理员:', okB, '| realErrors:', errs.length);
  console.log(okA && okB && errs.length===0 ? 'TODO2_OK' : 'TODO2_FAIL');
  await browser.close();
})();
