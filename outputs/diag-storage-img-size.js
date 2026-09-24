// ⚠️ Token 一律走环境变量，禁止硬编码（会被 GitHub Secret Scanning 拦下推送）
// 用法：SBP_TOKEN=sbp_xxx node outputs/diag-storage-img-size.js
const TOKEN=process.env.SBP_TOKEN;
if(!TOKEN){console.error('缺少环境变量 SBP_TOKEN');process.exit(1);}
const REF='ienmejlxukhrxjjxvfqf';
(async()=>{
  const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',
    headers:{'Authorization':`Bearer ${TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify({query:`select name, eye_img, lens_img from pattern_assets
      where (coalesce(thumb_eye_url,'')='' or coalesce(thumb_lens_url,'')='') and (eye_img like 'http%' or lens_img like 'http%')`})});
  const rows=await r.json();
  const urls=[];
  rows.forEach(x=>{[x.eye_img,x.lens_img].forEach(u=>{if(u&&u.startsWith('http'))urls.push(u);});});
  console.log('待测 Storage 图数量:',urls.length);
  let total=0; const sizes=[];
  await Promise.all(urls.map(async(u)=>{
    try{
      const h=await fetch(u,{method:'HEAD'});
      const len=parseInt(h.headers.get('content-length')||'0',10);
      sizes.push(len); total+=len;
    }catch(e){ sizes.push(-1); }
  }));
  sizes.sort((a,b)=>b-a);
  const big=sizes.filter(s=>s>300000).length;
  const huge=sizes.filter(s=>s>800000).length;
  console.log('总大小: '+(total/1048576).toFixed(2)+' MB | 平均: '+(total/sizes.length/1024).toFixed(0)+' KB');
  console.log('最大 5 张(KB):', sizes.slice(0,5).map(s=>(s/1024).toFixed(0)).join(', '));
  console.log('>300KB 张数:',big,' >800KB 张数:',huge);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
