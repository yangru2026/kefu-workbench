// 工作表格页（本地）冒烟：卡片渲染 + 点击跳转 + 截图
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=process.cwd(),PORT=8143,EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EXPECT='https://yow5cuygtx.feishu.cn/wiki/IeBRwF32Vi09Dmk1otYc4pganHg?sheet=c329af';
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'};
function startServer(){return new Promise(r=>{const s=http.createServer((q,res)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/favicon.ico'){res.writeHead(204);res.end();return;}if(u==='/')u='/diversion.html';const fp=path.join(ROOT,u);if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'});fs.createReadStream(fp).pipe(res);});s.listen(PORT,()=>r(s));});}
(async()=>{
  const srv=await startServer();
  const browser=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errs.push(m.text());});
  await page.goto(`http://127.0.0.1:${PORT}/diversion.html`,{waitUntil:'domcontentloaded'});
  const info=await page.evaluate(()=>({
    title:document.title,h1:document.querySelector('.topbar h1').textContent,
    cards:document.querySelectorAll('.sheet-card').length,
    cardTitle:(document.querySelector('.sheet-card h2')||{}).textContent,
    btnText:(document.querySelector('.sheet-card .open')||{}).textContent,
    btnDisabled:document.querySelector('.sheet-card .open').disabled,
    note:document.querySelector('.note').textContent.trim(),
  }));
  console.log(JSON.stringify(info,null,2));
  await page.evaluate(()=>{window.__opened=null;window.open=u=>{window.__opened=u;return null;};});
  await page.click('.sheet-card .open');
  const opened=await page.evaluate(()=>window.__opened);
  console.log('打开地址:',opened);
  await page.setViewport({width:1080,height:900});
  await page.screenshot({path:'outputs/smoke-worksheets.png',fullPage:true});
  await browser.close();srv.close();
  const ok=info.cards>=1&&!info.btnDisabled&&opened===EXPECT&&errs.length===0;
  console.log('JS报错:',errs.length?errs:'无');
  console.log(ok?'✅ 冒烟通过':'❌ 冒烟异常');
  process.exit(ok?0:1);
})().catch(e=>{console.error('崩溃:',e.message);process.exit(1);});
