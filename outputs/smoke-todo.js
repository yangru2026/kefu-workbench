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
  await sleep(600);

  // 普通客服视角：选一个 DEMO 里真实存在的客服名
  const cs = await page.evaluate(()=>{
    setQcMode(false);
    const staffName = records[0] ? records[0].staff : '示例客服A';
    currentAuthUser = {name:staffName, phone:''};
    qcConfirmations = []; qcTodoMode = false;
    setView('card'); renderRecords();
    const bar = document.getElementById('qcTodoBar');
    const barVisible = getComputedStyle(bar).display !== 'none';
    const text = document.getElementById('qcTodoText').textContent;
    const mine = records.filter(r=>r.staff===staffName && !getConfirm(r.id,staffName));
    const pills = document.querySelectorAll('#recordList .todo-pill').length;
    // 切换「查看待确认」
    toggleTodoMode();
    const filtered = getFiltered();
    const filteredAllMine = filtered.length>0 && filtered.every(r=>r.staff===staffName && !getConfirm(r.id,staffName));
    // 退出
    toggleTodoMode();
    const afterExit = getFiltered().length;
    return {staffName, barVisible, text, mineCount:mine.length, pills, filteredCount:filtered.length, filteredAllMine, afterExit, todoMode:qcTodoMode};
  });

  // 管理员视角：待办条必须隐藏
  const adminHidden = await page.evaluate(()=>{
    setQcMode(true);
    currentAuthUser = {name:'示例客服A', phone:''};
    qcTodoMode=false; renderRecords();
    return getComputedStyle(document.getElementById('qcTodoBar')).display==='none';
  });

  console.log(JSON.stringify({cs, adminHidden, errs}, null, 2));
  const okCs = cs.barVisible && /待你确认/.test(cs.text) && cs.pills===cs.mineCount && cs.mineCount>0 && cs.filteredAllMine && cs.afterExit>cs.filteredCount && cs.todoMode===false;
  const okAdmin = adminHidden===true;
  console.log('cs todo bar+pill+filter:', okCs, '| admin hidden:', okAdmin, '| realErrors:', errs.length);
  console.log(okCs && okAdmin && errs.length===0 ? 'TODO_OK' : 'TODO_FAIL');
  await browser.close();
})();
