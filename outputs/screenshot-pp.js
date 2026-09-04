const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://127.0.0.1:8123/index.html';
(async()=>{
  const browser = await puppeteer.launch({executablePath:path, headless:'new', args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']});
  const page = await browser.newPage();
  await page.setViewport({width:1440, height:1000, deviceScaleFactor:1});
  page.on('dialog', d=>d.accept());
  await page.goto(BASE, {waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,1500));
  await page.evaluate(()=>{
    const now = new Date().toISOString();
    const mk=(id,brand,type,name,opt={})=>({
      id, brand, type, name, series:opt.series||'倾慕系列', color:opt.color||'棕色系',
      diameter:opt.diameter||'14.2', color_diameter:'13.5', material:'硅水凝胶', oxygen:'', water:'',
      base_curve:'8.6', fixed_axis:'', spec:'', price_tier:opt.price_tier||'', diam_group:opt.diam_group||'',
      lens_img:'', eye_img:'', lens_imgs:[], eye_imgs:[], thumb_eye_url:'', thumb_lens_url:'',
      description:'推荐话术', sort_order:opt.sort_order||0, is_discontinued:!!opt.disc, created_at:opt.created_at||now
    });
    const names=['奶茶棕','小鹿棕','雾灰甜茶','微醺酒红','云雾灰','冰川蓝','樱语粉','黑巧慕斯','琥珀日落','薄荷奶绿','焦糖玛奇朵','雾霾蓝灰','粉紫恋人','橄榄绿','蜜桃乌龙','烟熏紫灰','北海道奶蓝','玫瑰豆沙','青提苏打','月夜黑耀','奶油杏子','海盐蓝','暮色玫瑰','森屿绿','香芋波波','星光紫','初雪白','琥珀枫叶','蜜橘汽水','静夜蓝'];
    const tiers=['29.9元/副','49.9元/副','59.9元/副','69元/副'];
    const groups=['小直径','小直径','大直径'];
    const brands=['弥生','极氧'];
    const rows=names.map((n,i)=>mk('a'+(i+1), brands[i%2], i%2?'月抛':'日抛', n, {
      price_tier: i<26 ? tiers[i%4] : '', diam_group: i<26 ? groups[i%3] : '',
      diameter: groups[i%3]==='大直径' ? '14.5' : '14.2', disc: i===26
    }));
    window.__rows = rows;
    patternCategories = [
      {id:'p1',category_type:'price',name:'29.9元/副',sort_order:1},
      {id:'p2',category_type:'price',name:'49.9元/副',sort_order:2},
      {id:'p3',category_type:'price',name:'59.9元/副',sort_order:3},
      {id:'p4',category_type:'price',name:'69元/副',sort_order:4},
      {id:'g1',category_type:'diam_group',name:'小直径',sort_order:1},
      {id:'g2',category_type:'diam_group',name:'大直径',sort_order:2},
      {id:'t1',category_type:'type',name:'日抛',sort_order:1},
      {id:'b1',category_type:'brand',name:'弥生',sort_order:1},
    ];
    // 屏蔽加载，避免真实后端覆盖 mock
    window.loadPatternsFromDB = async ()=>{ patternData = buildPatternTree(window.__rows || []); };
    window.loadPatternCategories = async ()=>{};
    currentProfile = { role:'admin', name:'杨茹' };
    patternData = buildPatternTree(rows);
    ppSel.clear();
    const sq=document.getElementById('pp-search'); if(sq) sq.value='';
    const sd=document.getElementById('pp-show-disc'); if(sd) sd.checked=false;
    ppRenderLimit = PP_PAGE_SIZE;
    // 通过真实入口进入弥生价格速查（switchPage 别名路由）→ 第一层：价格档卡片
    switchPage('price-miyang');
  });
  await new Promise(r=>setTimeout(r,600));
  await page.screenshot({path:'outputs/pp-page-preview.png', fullPage:false});
  // 第二层：进入 29.9 档，展示档内花色按直径分组
  await page.evaluate(()=>{ openPpTier('29.9元/副'); });
  await new Promise(r=>setTimeout(r,600));
  await page.screenshot({path:'outputs/pp-tier-preview.png', fullPage:false});
  await browser.close();
  console.log('SHOT_OK');
  process.exit(0);
})().catch(e=>{ console.error('FATAL', e && e.message || e); process.exit(2); });
