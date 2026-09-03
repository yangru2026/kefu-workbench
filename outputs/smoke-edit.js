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
  await page.evaluate(()=>openEditModal());
  await sleep(200);

  const info = await page.evaluate(()=>{
    const labels = [...document.querySelectorAll('#editBody .fld label')].map(l=>l.textContent.trim());
    return {
      modalOpen: document.getElementById('editModal').classList.contains('active'),
      firstLabel: labels[0] || '',
      hasScenePaste: !!document.querySelector('#editBody .paste-zone[onpaste*="scene"]'),
      hasKnowledgePaste: !!document.querySelector('#editBody .paste-zone[onpaste*="knowledge"]'),
      hasReplyLabel: labels.some(t=>t.includes('客服回复截图')),
      hasSceneLabel: labels.some(t=>t.includes('客户问题截图')),
      hasKnowledgeLabel: labels.some(t=>t.includes('知识点配图')),
      staffInputExists: !!document.getElementById('e_staff'),
      shopInputExists: !!document.getElementById('e_shop'),
      problemExists: !!document.getElementById('e_problem'),
      correctExists: !!document.getElementById('e_correct'),
      knowledgeExists: !!document.getElementById('e_knowledge')
    };
  });

  await browser.close();
  const real=errs.filter(e=>!/Failed to load resource/.test(e));
  const report={info, realErrors:real};
  console.log(JSON.stringify(report,null,2));
  const ok = info.modalOpen && info.firstLabel.includes('客户问题截图') && info.hasScenePaste && info.hasKnowledgePaste
    && info.hasSceneLabel && info.hasKnowledgeLabel && !info.hasReplyLabel
    && info.staffInputExists && info.shopInputExists && info.problemExists && info.correctExists && info.knowledgeExists
    && real.length===0;
  console.log(ok?'EDIT_OK':'EDIT_FAIL');
  process.exit(ok?0:1);
})().catch(e=>{ console.error('FATAL',e.message); process.exit(2); });
