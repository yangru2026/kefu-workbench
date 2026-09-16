// 调休申请每月 2 次上限冒烟：mock supabase，验证表单提示与提交拦截
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=process.cwd(),PORT=8153,EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
function startServer(){return new Promise(r=>{const s=http.createServer((q,res)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(ROOT,u);if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'});fs.createReadStream(fp).pipe(res);});s.listen(PORT,()=>r(s));});}

const STUB=`
function makeChain(t){
  var data;
  if (t==='profiles') data={id:'u1',name:'测试客服',real_name:'测试客服',role:'cs',status:'active'};
  else if (t==='cs_requests') { var n=window.__REQ_COUNT__||0; data=[]; for(var i=0;i<n;i++) data.push({id:'r'+i,type:'compensatory_leave',requester_id:'u1',requester_name:'测试客服',status:i===0?'approved':'pending',target_date:'2026-09-1'+(i+1),hours:2,reason:'x',shift_from:'早班',created_at:'2026-09-12T0'+i+':00:00Z'}); }
  else if (t==='overtime_records') data=[{hours:8}];
  else if (t==='compensatory_leave_records') data=[{hours:2}];
  else if (t==='schedule_data') data=null;
  else data=[];
  var o={}; o.then=function(res){return res({data:data,error:null});};
  ['select','order','eq','neq','in','gt','gte','lt','lte','limit','range','single','maybeSingle','match','filter','ilike','or','not','is','contains','textSearch'].forEach(function(k){o[k]=function(){return makeChain(t);};});
  o.insert=function(){return makeChain(t);};
  o.upsert=function(){return makeChain(t);};
  o.update=function(){return makeChain(t);};
  o.delete=function(){return makeChain(t);};
  return o;
}
window.__REQ_COUNT__=2;
window.__INSERTS__=[];
window.supabase={createClient:function(){
  var session={user:{id:'u1',email:'cs@test.com',app_metadata:{},user_metadata:{}}};
  return {
    auth:{
      getSession:async()=>({data:{session:session},error:null}),
      getUser:async()=>({data:{user:session.user},error:null}),
      onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}};},
      signInWithPassword:async()=>({data:{user:session.user,session:session},error:null}),
      signUp:async()=>({data:{user:session.user,session:session},error:null}),
      signOut:async()=>({error:null})
    },
    from:function(t){
      if(t==='cs_requests'){ var base=makeChain(t); var o=Object.create(base);
        o.insert=function(row){window.__INSERTS__.push(row);return makeChain(t);};
        return o; }
      return makeChain(t);
    },
    channel:function(){var c={on:function(){return c;},subscribe:function(){return c;},unsubscribe:function(){return c;}};return c;},
    removeChannel:function(){},
    storage:{from:function(){return {upload:async()=>({error:null}),remove:async()=>({error:null}),getPublicUrl:function(){return {data:{publicUrl:''}};},list:async()=>({data:[],error:null})};}}
  };
}};`;

function evalT(page,fn,ms,...args){return Promise.race([page.evaluate(fn,...args).then(v=>({ok:true,v})).catch(e=>({ok:false,e:String(e)})),new Promise(r=>setTimeout(()=>r({ok:false,timeout:true}),ms)).then(x=>x&&x.timeout?{ok:false,timeout:true}:x)]);}
const log=(...a)=>process.stdout.write(a.join(' ')+'\n');

(async()=>{
  const server=await startServer();
  const browser=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']});
  const page=await browser.newPage();
  const errs=[]; const dialogs=[];
  page.on('dialog',d=>{dialogs.push(d.message().slice(0,40));try{d.accept();}catch(e){}});
  page.on('pageerror',e=>errs.push('PAGEERR '+String(e)));
  page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE_ERR '+m.text().slice(0,160));});
  await page.setRequestInterception(true);
  page.on('request',req=>{
    const u=req.url();
    if(u.includes('vendor/supabase.min.js') || u.includes('cdn.jsdelivr.net/npm/@supabase') || u.includes('unpkg.com/@supabase') || u.includes('registry.npmmirror.com/@supabase')){
      req.respond({status:200,headers:{'Content-Type':'application/javascript'},body:STUB}); return;
    }
    if(u.includes('xlsx')){ req.respond({status:200,headers:{'Content-Type':'application/javascript'},body:'window.XLSX={utils:{book_new:function(){return{};},json_to_sheet:function(){return{};},book_append_sheet:function(){}},writeFile:function(){}};'}); return; }
    if(u.includes('supabase.co')){ req.respond({status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},body:'[]'}); return; }
    if(u.includes('unpkg.com')||u.includes('cdn.jsdelivr.net')||u.includes('npmmirror')){ req.respond({status:200,headers:{'Content-Type':'application/javascript'},body:'/*stub*/'}); return; }
    req.continue();
  });
  await page.goto(`http://localhost:${PORT}/index.html`,{waitUntil:'domcontentloaded',timeout:30000});
  // 等登录态就绪
  let ready=false;
  for(let i=0;i<80;i++){
    const s=await evalT(page,()=>({u:(typeof currentUser!=='undefined'&&!!currentUser)}),1500);
    if(s.ok&&s.v.u){ready=true;break;}
    await new Promise(r=>setTimeout(r,250));
  }
  log('ready=',ready);
  // 进入申请审批页 → 调休申请 tab（本月已有 2 条 → 应禁用提交）
  const t1=await evalT(page,()=>{switchPage('requests');switchReqType('compensatory_leave');return 'switched';},8000);
  await new Promise(r=>setTimeout(r,1500));
  const t1b=await evalT(page,()=>{
    const btn=document.getElementById('req-submit-btn-leave');
    const hint=document.getElementById('req-remain-hint');
    const hours=document.getElementById('req-hours');
    return {btnText:btn?btn.textContent:'',btnDisabled:btn?btn.disabled:null,
      hint:hint?hint.textContent:'',hoursDisabled:hours?hours.disabled:null};
  },6000);
  log('T1 已满2次=',JSON.stringify(t1),JSON.stringify(t1b));
  // T2 降为 1 条 → 恢复可提交，提示 1/2
  const t2=await evalT(page,()=>{window.__REQ_COUNT__=1;switchReqType('compensatory_leave');return 're-render';},6000);
  await new Promise(r=>setTimeout(r,1200));
  const t2b=await evalT(page,()=>{
    const btn=document.getElementById('req-submit-btn-leave');
    const hint=document.getElementById('req-remain-hint');
    return {btnText:btn?btn.textContent:'',btnDisabled:btn?btn.disabled:null,hint:hint?hint.textContent:''};
  },6000);
  log('T2 仅1次=',JSON.stringify(t2),JSON.stringify(t2b));
  // T3 强制走 submitRequest 校验（清空计数为 2 → 应被 toast 拦截，无 insert）
  const t3=await evalT(page,()=>{
    window.__REQ_COUNT__=2;
    document.getElementById('req-hours').value='2';
    document.getElementById('req-reason').value='测试';
    return submitRequest().then(()=>({inserts:(window.__INSERTS__||[]).length,toast:document.getElementById('toast').textContent}));
  },8000);
  log('T3 提交拦截=',JSON.stringify(t3));
  // T4 计数清 0 → 提交放行（有 insert）
  const t4=await evalT(page,()=>{
    window.__REQ_COUNT__=0;
    return submitRequest().then(()=>({inserts:(window.__INSERTS__||[]).length,toast:document.getElementById('toast').textContent}));
  },8000);
  log('T4 提交放行=',JSON.stringify(t4));
  const realErrs=errs.filter(e=>!/Failed to load resource/.test(e)&&!/net::ERR_NAME_NOT_RESOLVED/.test(e));
  log('REAL ERRORS:',realErrs.length?JSON.stringify(realErrs.slice(0,4)):'none');
  const pass = ready
    && t1.ok && t1b.ok && t1b.v.btnDisabled===true && t1b.v.btnText.includes('已用完') && t1b.v.hint.includes('2/2') && t1b.v.hoursDisabled===true
    && t2b.ok && t2b.v.btnDisabled===false && t2b.v.btnText.includes('提交') && t2b.v.hint.includes('1/2')
    && t3.ok && t3.v && t3.v.inserts===0 && t3.v.toast.includes('上限')
    && t4.ok && t4.v && t4.v.inserts===1
    && realErrs.length===0;
  log('\n==== '+(pass?'PASS ✅':'FAIL ❌')+' ====');
  await browser.close();server.close();process.exit(pass?0:1);
})().catch(e=>{log('FATAL',String(e));process.exit(3);});
