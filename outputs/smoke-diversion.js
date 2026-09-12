// 舆情转接登记页冒烟：离线 mock supabase，验证核心流程
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=process.cwd(),PORT=8141,EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'};
function startServer(){return new Promise(r=>{const s=http.createServer((q,res)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/diversion.html';const fp=path.join(ROOT,u);if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'});fs.createReadStream(fp).pipe(res);});s.listen(PORT,()=>r(s));});}
const STUB=`
window.supabase={createClient:function(){return {
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',app_metadata:{role:'admin'},email:'cs@test.com'}}}})},
  from:function(t){return makeChain(t);},
  storage:{from:function(b){return {upload:async()=>({error:null}),remove:async()=>({error:null})};}}
};}};
window.__INSERTS__=[];
function makeChain(t){
  var data = t==='profiles'?{role:'admin',real_name:'测试客服'}:(t==='diversion_transfers'?window.__SAMPLE__:[]);
  var o={}; o.then=function(res){return res({data:data,error:null});};
  ['select','order','eq','single','limit'].forEach(function(k){o[k]=function(){return makeChain(t);};});
  o.insert=function(row){window.__INSERTS__.push({table:t,row:row});return makeChain(t);};
  o.delete=function(){return makeChain(t);};
  return o;
}`;
function evalT(page,fn,ms,...args){return Promise.race([page.evaluate(fn,...args).then(v=>({ok:true,v})).catch(e=>({ok:false,e:String(e)})),new Promise(r=>setTimeout(()=>r({ok:false,timeout:true}),ms)).then(x=>x&&x.timeout?{ok:false,timeout:true}:x)]);}
const log=(...a)=>process.stdout.write(a.join(' ')+'\n');
const SAMPLE=[
  {id:'d1',cs_name:'飞飞',customer_info:'昵称小美 / 订单号 123',reason:'舆情问透氧',screenshots:['shots/a.png','shots/b.png'],created_at:'2026-09-12T09:00:00Z'},
  {id:'d2',cs_name:'七七',customer_info:'订单号 456',reason:'跨店问正品',screenshots:[],created_at:'2026-09-12T08:00:00Z'}
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
  await page.goto(`http://localhost:${PORT}/diversion.html`,{waitUntil:'domcontentloaded',timeout:20000});
  let ready=false;
  for(let i=0;i<60;i++){const s=await evalT(page,()=>({n:(typeof records!=='undefined'&&records)?records.length:0, cards:document.querySelectorAll('#list .rec').length, cs:document.getElementById('fCs')?document.getElementById('fCs').value:''}),1000,'snap');if(s.ok&&s.v.cards>=2){ready=true;break;}await new Promise(r=>setTimeout(r,250));}
  log('ready=',ready,' csNamePrefill=',JSON.stringify(await evalT(page,()=>document.getElementById('fCs').value,2000)));
  // T1 列表渲染 + 原因标签
  const t1=await evalT(page,()=>({recs:document.querySelectorAll('#list .rec').length,tags:document.querySelectorAll('.reason-tag').length,hasFb:!!document.querySelector('.reason-tag[data-reason="反馈建议类"]'),shopSel:document.getElementById('fShop').tagName,shopOpts:document.getElementById('fShop').options.length}),4000);
  log('T1 list/tags=',JSON.stringify(t1));
  // T2 选原因 + 加截图 + 提交
  const t2=await evalT(page,()=>{
    document.querySelector('.reason-tag[data-reason="舆情问透氧"]').click();
    document.getElementById('fInfo').value='昵称小红 / 订单号 999';
    document.getElementById('fShop').value='抖音1店';
    document.getElementById('fNick').value='可可';
    const f=new File([new Uint8Array([1,2,3])],'shot.png',{type:'image/png'});
    addShots([f]);
    return {reason:selReason,shots:newShots.length,shotCells:document.querySelectorAll('.shot-cell').length};
  },4000);
  log('T2 form=',JSON.stringify(t2));
  const t3=await evalT(page,()=>{document.getElementById('btnSave').click();return 'clicked';},6000);
  await new Promise(r=>setTimeout(r,1200));
  const t3b=await evalT(page,()=>({inserts:(window.__INSERTS__||[]).map(x=>({table:x.table,reason:x.row&&x.row.reason,shop:x.row&&x.row.shop,nick:x.row&&x.row.diversion_nick,shots:x.row&&x.row.screenshots&&x.row.screenshots.length})),formReset:newShots.length===0&&selReason===''}),4000);
  log('T3 save=',JSON.stringify(t3),' result=',JSON.stringify(t3b));
  // T4 搜索过滤
  const t4=await evalT(page,()=>{const i=document.getElementById('searchInput');i.value='飞飞';i.dispatchEvent(new Event('input'));return {visible:document.querySelectorAll('#list .rec').length};},4000);
  log('T4 search 飞飞=',JSON.stringify(t4));
  const t4b=await evalT(page,()=>{const i=document.getElementById('searchInput');i.value='';i.dispatchEvent(new Event('input'));return document.querySelectorAll('#list .rec').length;},4000);
  log('T4b reset=',JSON.stringify(t4b));
  // T5 灯箱
  const t5=await evalT(page,()=>{const img=document.querySelector('#list .rec [data-act="shot"]');if(!img)return 'no-shot';img.click();return {active:document.getElementById('lightbox').classList.contains('active'),count:document.getElementById('galCount').textContent};},4000);
  log('T5 gallery=',JSON.stringify(t5));
  // T6 校验拦截：清空后直接提交应被拦
  const t6=await evalT(page,()=>{document.getElementById('fInfo').value='';selReason='';newShots=[];document.getElementById('btnSave').click();return 'clicked';},4000);
  const t6b=await evalT(page,()=>({inserts:(window.__INSERTS__||[]).length,toast:document.getElementById('toast').textContent}),4000);
  log('T6 validate=',JSON.stringify(t6),JSON.stringify(t6b));
  const realErrs=errs.filter(e=>!/Failed to load resource/.test(e));
  log('PAGE ERRORS:',errs.length?JSON.stringify(errs):'none');
  log('REAL ERRORS:',realErrs.length?JSON.stringify(realErrs):'none');
  const pass = ready && t1.ok && t1.v.recs===2 && t1.v.tags===3 && t1.v.hasFb && t1.v.shopSel==='SELECT' && t1.v.shopOpts===12
    && t2.ok && t2.v.reason==='舆情问透氧' && t2.v.shotCells===1
    && t3b.ok && t3b.v.inserts.length===1 && t3b.v.inserts[0].reason==='舆情问透氧' && t3b.v.inserts[0].shop==='抖音1店' && t3b.v.inserts[0].nick==='可可' && t3b.v.inserts[0].shots===1 && t3b.v.formReset
    && t4.ok && t4.v.visible===1 && t4b.ok && t4b.v===2
    && t5.ok && t5.v.active && t5.v.count==='1 / 2'
    && t6b.ok && t6b.v.inserts===1 && realErrs.length===0;
  log('\n==== '+(pass?'PASS ✅':'FAIL ❌')+' ====');
  await browser.close();server.close();process.exit(pass?0:1);
})().catch(e=>{log('FATAL',String(e));process.exit(3);});
