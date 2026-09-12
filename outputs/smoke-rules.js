// 平台规则页冒烟：离线 mock supabase，验证核心流程
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=process.cwd(),PORT=8143,EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'};
function startServer(){return new Promise(r=>{const s=http.createServer((q,res)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/rules.html';const fp=path.join(ROOT,u);if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'});fs.createReadStream(fp).pipe(res);});s.listen(PORT,()=>r(s));});}
const STUB=`
window.supabase={createClient:function(){return {
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',app_metadata:{role:'admin'},email:'admin@test.com'}}}})},
  from:function(t){return makeChain(t);},
  storage:{from:function(b){return {upload:async()=>({error:null}),remove:async()=>({error:null})};}}
};}};
window.__INSERTS__=[];window.__DELETES__=[];
function makeChain(t){
  var data = t==='profiles'?{role:'admin'}:(t==='platform_rules'?window.__SAMPLE__:[]);
  var o={}; o.then=function(res){return res({data:data,error:null});};
  ['select','order','eq','single','limit'].forEach(function(k){o[k]=function(){return makeChain(t);};});
  o.insert=function(row){window.__INSERTS__.push({table:t,row:row});return makeChain(t);};
  o.update=function(row){window.__UPD__=row;return makeChain(t);};
  o.delete=function(){window.__DELETES__.push(t);return makeChain(t);};
  return o;
}`;
function evalT(page,fn,ms,...args){return Promise.race([page.evaluate(fn,...args).then(v=>({ok:true,v})).catch(e=>({ok:false,e:String(e)})),new Promise(r=>setTimeout(()=>r({ok:false,timeout:true}),ms)).then(x=>x&&x.timeout?{ok:false,timeout:true}:x)]);}
const log=(...a)=>process.stdout.write(a.join(' ')+'\n');
const SAMPLE=[
  {id:'r1',platform:'通用',level:'高压线',title:'严禁引导站外交易',content:'不得加微信/QQ',sort_order:1,created_at:'2026-09-12T01:00:00Z'},
  {id:'r2',platform:'通用',level:'提醒',title:'规范使用话术模板',content:'优先用标准话术',sort_order:10,created_at:'2026-09-12T02:00:00Z'},
  {id:'r3',platform:'抖音',level:'高压线',title:'严禁站外导流',content:'抖音私聊禁止微信号',sort_order:1,created_at:'2026-09-12T03:00:00Z'},
  {id:'r4',platform:'拼多多',level:'重要',title:'注意平台处罚指标',content:null,sort_order:5,created_at:'2026-09-12T04:00:00Z'}
];
(async()=>{
  const server=await startServer();
  const browser=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']});
  const page=await browser.newPage();
  const errs=[];
  page.on('dialog',d=>{try{d.accept();}catch(e){}});
  page.on('pageerror',e=>errs.push('PAGEERR '+String(e)));
  page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE_ERR '+m.text().slice(0,160));});
  await page.evaluateOnNewDocument((s)=>{window.__SAMPLE__=s;},SAMPLE);
  await page.setRequestInterception(true);
  page.on('request',req=>{
    const u=req.url();
    if(u.includes('cdn.jsdelivr.net')){ req.respond({status:200,headers:{'Content-Type':'application/javascript'},body:STUB}); return; }
    if(u.includes('supabase.co')){ req.respond({status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},body:'[]'}); return; }
    req.continue();
  });
  await page.goto(`http://localhost:${PORT}/rules.html`,{waitUntil:'domcontentloaded',timeout:20000});
  let ready=false;
  for(let i=0;i<60;i++){const s=await evalT(page,()=>({chips:document.querySelectorAll('#pfChips .chip').length, cards:document.querySelectorAll('#list .rule').length, on:document.querySelector('#pfChips .chip.on')?document.querySelector('#pfChips .chip.on').dataset.pf:''}),1000);if(s.ok&&s.v.cards>=2){ready=true;break;}await new Promise(r=>setTimeout(r,250));}
  const badge=await evalT(page,()=>document.getElementById('roleBadge').textContent,2000);
  log('ready=',ready,' badge=',JSON.stringify(badge));
  // T1 默认平台=通用，高压线排在最前
  const t1=await evalT(page,()=>({
    cards:document.querySelectorAll('#list .rule').length,
    firstLv:document.querySelector('#list .rule')?document.querySelector('#list .rule').className:'',
    firstTitle:document.querySelector('#list .rule .rule-title')?document.querySelector('#list .rule .rule-title').textContent:'',
    editBtns:document.querySelectorAll('#list [data-act="edit"]').length
  }),4000);
  log('T1 list=',JSON.stringify(t1));
  // T2 切换平台 chip → 抖音
  const t2=await evalT(page,()=>{
    const chip=document.querySelector('#pfChips .chip[data-pf="抖音"]');
    if(!chip) return {err:'no chip'};
    chip.click();
    return {cards:document.querySelectorAll('#list .rule').length,
      pfTag:document.querySelector('#list .pf-tag')?document.querySelector('#list .pf-tag').textContent:'',
      title:document.querySelector('#list .rule-title')?document.querySelector('#list .rule-title').textContent:''};
  },4000);
  log('T2 chip切换抖音=',JSON.stringify(t2));
  // T3 搜索（跨平台）
  const t3=await evalT(page,()=>{const i=document.getElementById('searchInput');i.value='话术';i.dispatchEvent(new Event('input'));return {visible:document.querySelectorAll('#list .rule').length,title:document.querySelector('#list .rule-title')?document.querySelector('#list .rule-title').textContent:''};},4000);
  log('T3 search 话术=',JSON.stringify(t3));
  const t3b=await evalT(page,()=>{const i=document.getElementById('searchInput');i.value='';i.dispatchEvent(new Event('input'));return document.querySelectorAll('#list .rule').length;},4000);
  log('T3b reset=',JSON.stringify(t3b));
  // T4 空标题提交被拦截
  const t4=await evalT(page,()=>{document.getElementById('btnAdd').click();document.getElementById('fTitle').value='';document.getElementById('btnSave').click();return {modalOpen:document.getElementById('modalMask').classList.contains('active'),toast:document.getElementById('toast').textContent};},4000);
  log('T4 空标题拦截=',JSON.stringify(t4));
  // T5 新增规则：填表保存
  const t5=await evalT(page,()=>{
    document.getElementById('fPlatform').value='快手';
    document.getElementById('fLevel').value='高压线';
    document.getElementById('fTitle').value='严禁私下交易';
    document.getElementById('fContent').value='违规辞退';
    document.getElementById('btnSave').click();
    return 'submitted';
  },4000);
  await new Promise(r=>setTimeout(r,1000));
  const t5b=await evalT(page,()=>({inserts:(window.__INSERTS__||[]).map(x=>({table:x.table,pf:x.row.platform,lv:x.row.level,title:x.row.title,sort:x.row.sort_order})),modalClosed:!document.getElementById('modalMask').classList.contains('active')}),4000);
  log('T5 add=',JSON.stringify(t5),JSON.stringify(t5b));
  // T6 删除规则
  const t6=await evalT(page,()=>{const b=document.querySelector('#list [data-act="del"]');if(!b)return 'no-del-btn';b.click();return 'clicked';},4000);
  await new Promise(r=>setTimeout(r,800));
  const t6b=await evalT(page,()=>({deletes:(window.__DELETES__||[]).length}),4000);
  log('T6 delete=',JSON.stringify(t6),JSON.stringify(t6b));
  // T7 缓存写入
  const t7=await evalT(page,()=>{const c=localStorage.getItem('kefu_cache_platform_rules');if(!c)return 'no-cache';const o=JSON.parse(c);return {ver:o.ver,n:(o.data||[]).length};},4000);
  log('T7 cache=',JSON.stringify(t7));
  // T8 遮罩误关保护：输入框按下拖到遮罩松手不关闭；真点遮罩空白才关闭
  const t8=await evalT(page,()=>{
    const mask=document.getElementById('modalMask');
    const r={};
    // 场景1：mousedown 在输入框（选文字起点），click 落在遮罩（拖出弹窗松手）→ 不应关闭
    document.getElementById('btnAdd').click();
    document.getElementById('fTitle').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:200,clientY:200}));
    mask.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:20,clientY:20}));
    r.afterDrag=mask.classList.contains('active');
    // 场景2：mousedown 和 click 都在遮罩上且位置没动 → 关闭
    mask.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:20,clientY:20}));
    mask.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:20,clientY:20}));
    r.afterRealClick=mask.classList.contains('active');
    // 场景3：重新打开备用
    document.getElementById('btnAdd').click();
    return r;
  },4000);
  log('T8 maskGuard=',JSON.stringify(t8));
  const realErrs=errs.filter(e=>!/Failed to load resource/.test(e));
  log('PAGE ERRORS:',errs.length?JSON.stringify(errs):'none');
  log('REAL ERRORS:',realErrs.length?JSON.stringify(realErrs):'none');
  const pass = ready && t1.ok && t1.v.cards===2 && t1.v.firstLv.includes('lv-高压线') && t1.v.firstTitle==='严禁引导站外交易' && t1.v.editBtns===2
    && t2.ok && t2.v && !t2.v.err && t2.v.cards===1 && t2.v.title==='严禁站外导流'
    && t3.ok && t3.v.visible===1 && t3.v.title==='规范使用话术模板'
    && t3b.ok && t3b.v===1 /* T2 后仍在抖音平台，重置后显示抖音的 1 条 */
    && t4.ok && t4.v.modalOpen && t4.v.toast.includes('标题')
    && t5b.ok && t5b.v.inserts.length===1 && t5b.v.inserts[0].table==='platform_rules' && t5b.v.inserts[0].pf==='快手' && t5b.v.inserts[0].lv==='高压线' && t5b.v.inserts[0].title==='严禁私下交易' && typeof t5b.v.inserts[0].sort==='number' && t5b.v.modalClosed
    && t6.ok && t6.v==='clicked' && t6b.ok && t6b.v.deletes===1
    && t7.ok && t7.v && t7.v.ver==='v1'
    && t8.ok && t8.v.afterDrag===true && t8.v.afterRealClick===false
    && realErrs.length===0;
  log('\n==== '+(pass?'PASS ✅':'FAIL ❌')+' ====');
  await browser.close();server.close();process.exit(pass?0:1);
})().catch(e=>{log('FATAL',String(e));process.exit(3);});
