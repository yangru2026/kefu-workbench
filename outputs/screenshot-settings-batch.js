const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
(async()=>{
  const browser = await puppeteer.launch({executablePath:path, headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.setViewport({width:800,height:700});
  await page.goto('http://127.0.0.1:8123/qc-v2.html?demo', {waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,400));
  await page.evaluate(()=>{openSettingsModal(); document.getElementById('setStaffInput').value='小王,小李\n小张 小周'; parseOptionPreview('staff');});
  await new Promise(r=>setTimeout(r,300));
  const modal = await page.$('#settingsModal .modal');
  const out = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/settings-batch-paste.png';
  await modal.screenshot({path:out});
  await browser.close();
  console.log('saved',out);
})();
