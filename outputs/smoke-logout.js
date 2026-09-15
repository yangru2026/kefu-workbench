// 退出登录冒烟：mock supabase-js，验证侧边栏/导航退出入口与退出后状态
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=process.cwd(),PORT=8149,EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
function startServer(){return new Promise(r=>{const s=http.createServer((q,res)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(ROOT,u);if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'});fs.createReadStream(fp).pipe(res);});s.listen(PORT,()=>r(s));});}

const STUB=`
window.__SIGNOUTS__=0;
function makeChain(t){
  var data = (t==='profiles') ? {id:'u1',name:'测试客服',real_name:'测试客服',role:'admin',status:'active'} : [];
  var o={}; o.then=function(res){return res({data:data,error:null});};
  ['select','order','eq','neq','in','gt','gte','lt','lte','limit','range','single','maybeSingle','match','filter','ilike','or','not','is','contains','textSearch'].forEach(function(k){o[k]=function(){return makeChain(t);};});
  o.insert=function(){return makeChain(t);};
  o.upsert=function(){return makeChain(t);};
  o.update=function(){return makeChain(t);};
  o.delete=function(){return makeChain(t);};
  return o;
}
window.supabase={createClient:function(){
  var session={user:{id:'u1',email:'admin@test.com',app_metadata:{role:'admin'},user_metadata:{}}};
  return {
    auth:{
      getSession:async()=>({data:{session:session},error:null}),
      getUser:async()=>({data:{user:session.user},error:null}),
      onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}};},
      signInWithPassword:async()=>({data:{user:session.user,session:session},error:null}),
      signUp:async()=>({data:{user:session.user,session:session},error:null}),
      signOut:async()=>{window.__SIGNOUTS__++;return {error:null};}
    },
    from:function(t){return makeChain(t);},
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
    const s=await evalT(page,()=>({u:(typeof currentUser!=='undefined'&&!!currentUser),name:document.getElementById('visitor-name')?document.getElementById('visitor-name').textContent:''}),1500);
    if(s.ok&&s.v.u&&s.v.name&&s.v.name!=='访客'){ready=true;break;}
    await new Promise(r=>setTimeout(r,250));
  }
  log('ready=',ready);
  // T1 登录态：退出入口可见
  const t1=await evalT(page,()=>{
    const vis=id=>{const e=document.getElementById(id);return e?getComputedStyle(e).display!=='none':null;};
    return {logoutNav:vis('nav-logout'),loginNav:vis('nav-login'),quitBtn:vis('user-quit'),
      name:document.getElementById('visitor-name').textContent,
      logoutHref:document.getElementById('nav-logout')?document.getElementById('nav-logout').dataset.page:null,
      label:document.getElementById('nav-logout')?document.getElementById('nav-logout').textContent.trim():''};
  },5000);
  log('T1 登录态=',JSON.stringify(t1));
  // T2 点导航「退出登录」→ confirm 通过 → signOut 被调用
  const t2=await evalT(page,()=>{document.getElementById('nav-logout').click();return 'clicked';},5000);
  await new Promise(r=>setTimeout(r,1200));
  const t2b=await evalT(page,()=>({
    signOuts:window.__SIGNOUTS__||0,
    curUser:(typeof currentUser!=='undefined'&&currentUser)?currentUser.id:null,
    name:document.getElementById('visitor-name').textContent,
    logoutNav:(function(){const e=document.getElementById('nav-logout');return e?getComputedStyle(e).display!=='none':null;})(),
    loginNav:(function(){const e=document.getElementById('nav-login');return e?getComputedStyle(e).display!=='none':null;})(),
    quitBtn:(function(){const e=document.getElementById('user-quit');return e?getComputedStyle(e).display!=='none':null;})(),
    toast:document.getElementById('toast')?document.getElementById('toast').textContent:'',
    loginPageActive:!!(document.getElementById('page-login')&&document.getElementById('page-login').classList.contains('active'))
  }),5000);
  log('T2 点退出=',JSON.stringify(t2),JSON.stringify(t2b));
  log('dialogs=',JSON.stringify(dialogs));
  const realErrs=errs.filter(e=>!/Failed to load resource/.test(e));
  log('PAGE ERRORS:',errs.length?JSON.stringify(errs.slice(0,4)):'none');
  log('REAL ERRORS:',realErrs.length?JSON.stringify(realErrs.slice(0,4)):'none');
  const pass = ready
    && t1.ok && t1.v.logoutNav===true && t1.v.loginNav===false && t1.v.quitBtn===true && t1.v.name==='测试客服' && t1.v.logoutHref==='logout' && t1.v.label.includes('退出登录')
    && t2b.ok && t2b.v.signOuts===1 && t2b.v.curUser===null && t2b.v.name==='未登录' && t2b.v.logoutNav===false && t2b.v.loginNav===true && t2b.v.quitBtn===false && t2b.v.loginPageActive
    && dialogs.some(d=>d.includes('确定要退出登录'))
    && realErrs.length===0;
  log('\n==== '+(pass?'PASS ✅':'FAIL ❌')+' ====');
  await browser.close();server.close();process.exit(pass?0:1);
})().catch(e=>{log('FATAL',String(e));process.exit(3);});
