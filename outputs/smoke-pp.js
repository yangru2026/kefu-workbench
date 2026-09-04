const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://127.0.0.1:8123/index.html';
const sleep = ms => new Promise(r=>setTimeout(r,ms));
// 看门狗：整体超时 45s 强制退出，便于区分「卡死」与「失败」
const wd = setTimeout(()=>{ console.log('WATCHDOG_TIMEOUT'); process.exit(3); }, 45000);
(async()=>{
  const errs=[];
  const browser = await puppeteer.launch({executablePath:path, headless:'new', args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']});
  const page = await browser.newPage();
  page.on('console', m=>{ if(m.type()==='error'){ const t=m.text(); if(!/favicon/i.test(t) && !/Failed to load resource/i.test(t) && !/blob:fake/i.test(t) && !/net::|ERR_|channel|WebSocket/i.test(t)) errs.push('CONSOLE:'+t); }});
  page.on('pageerror', e=>errs.push('PAGEERROR:'+e.message));
  // 关键：confirm 弹窗必须自动接受，否则 applyPatternBatchTag 的 await 永远不返回
  page.on('dialog', d=>{ d.accept(); });
  await page.goto(BASE, {waitUntil:'domcontentloaded'});
  await sleep(1500);

  const out = {};
  const ev = async (label, fn, ms=8000) => {
    try {
      const p = page.evaluate(fn);
      const timer = new Promise(res=>setTimeout(()=>res('__EV_TIMEOUT__'), ms));
      const r = await Promise.race([p, timer]);
      if (r === '__EV_TIMEOUT__') { out['_hang_' + label] = true; console.log('HANG at', label); return null; }
      if (r && typeof r === 'object' && !r.__skipMerge) Object.assign(out, r);   // 合并断言结果
      return r;
    } catch(e){ console.log('EV_ERR at', label, '::', (e && e.message) || e); out['_err_' + label] = true; return null; }
  };

  await ev('seed', ()=>{
    const now = new Date().toISOString();
    const mk=(id,brand,type,name,opt={})=>({
      id, brand, type, name, series:opt.series||'', color:opt.color||'棕色系',
      diameter:opt.diameter||'14.2', color_diameter:'13.5', material:'硅水凝胶', oxygen:'', water:'',
      base_curve:'8.6', fixed_axis:'', spec:'', price_tier:opt.price_tier||'', diam_group:opt.diam_group||'',
      lens_img:'', eye_img:'', lens_imgs:[], eye_imgs:[], thumb_eye_url:'', thumb_lens_url:'',
      description:'推荐话术', sort_order:opt.sort_order||0, is_discontinued:!!opt.disc, created_at:opt.created_at||now
    });
    const rows=[
      mk('a1','弥生','日抛','奶茶棕',{series:'倾慕系列',price_tier:'29.9元/副',diam_group:'小直径',created_at:now}),
      mk('a2','弥生','日抛','小鹿棕',{series:'倾慕系列',price_tier:'59.9元/副',diam_group:'小直径'}),
      mk('a3','极氧','月抛','云雾灰',{series:'星眸系列',price_tier:'49.9元/副',diam_group:'大直径',diameter:'14.5'}),
      mk('a4','弥生','半年抛','未标款',{}),
      mk('a5','弥生','月抛','老款棕',{series:'',price_tier:'69元/副',diam_group:'小直径',disc:true}),
      mk('a6','弥生','日抛','加测甲',{series:'倾慕系列',price_tier:'29.9元/副',diam_group:'小直径'}),
      mk('a7','弥生','日抛','加测乙',{series:'',price_tier:'29.9元/副'}),   // 待分组
      mk('a8','弥生','半年抛','加测丙',{series:'星眸系列',price_tier:'59.9元/副',diam_group:'大直径',diameter:'14.5'}),
    ];
    patternData = buildPatternTree(rows);
    window.__rows = rows;
    patternCategories = [
      {id:'p1',category_type:'price',name:'29.9元/副',sort_order:1},
      {id:'p2',category_type:'price',name:'49.9元/副',sort_order:2},
      {id:'p3',category_type:'price',name:'59.9元/副',sort_order:3},
      {id:'p4',category_type:'price',name:'69元/副',sort_order:4},
      {id:'g1',category_type:'diam_group',name:'小直径',sort_order:1},
      {id:'g2',category_type:'diam_group',name:'大直径',sort_order:2},
      {id:'t1',category_type:'type',name:'日抛',sort_order:1},
      {id:'t2',category_type:'type',name:'月抛',sort_order:2},
      {id:'t3',category_type:'type',name:'半年抛',sort_order:3},
      {id:'b1',category_type:'brand',name:'弥生',sort_order:1},
    ];
    currentProfile = null;              // 普通客服
    currentPage = 'pattern-price';
    ppBrandFilter = '弥生';             // 品牌由入口锁定（switchPage 别名），默认弥生
    ppDimView = null;                   // 第一层：四维度分区
    ppRenderLimit = PP_PAGE_SIZE;
    window.loadPatternCategories = async ()=>{};   // 屏蔽别名路由触发的真实网络请求
    ppSel.clear();
    const sq=document.getElementById('pp-search'); if(sq) sq.value='';
    const sd=document.getElementById('pp-show-disc'); if(sd) sd.checked=false;
    renderPatternPricePage();
    return { __skipMerge:true };
  });

  // ===== 第一层：四维度分区（客服视角） =====
  await ev('csFirstLayer', ()=>{
    const o={};
    const content=()=>document.getElementById('pp-content').textContent;
    o.treeFieldsOk = Object.values(patternData.brands).every(b=>Object.values(b).every(arr=>arr.every(p=>'priceTier' in p && 'diamGroup' in p && '_type' in p && 'series' in p)));
    o.dimTitleCount = document.querySelectorAll('#pp-content .pp-dim-title').length;   // 按抛型/按系列/按直径/按价格 = 4
    o.tierCardCount = document.querySelectorAll('#pp-content .pp-tiercard').length;
    // 弥生非下架 6 款：抛型2(日抛4/半年抛2) + 系列3(倾慕3/星眸1/未填2) + 直径3(小3/大1/待分组2) + 价格3(29.9:3/59.9:1/未标价1) = 11
    o.noCardsLayer1 = document.querySelectorAll('#pp-content .pp-card').length===0;   // 第一层不出现花色卡片
    o.noCheckbox = document.querySelectorAll('#pp-content .pp-check').length===0;
    o.noQuick = document.querySelectorAll('#pp-content .pp-quick').length===0;
    o.noPatternNames = !content().includes('奶茶棕') && !content().includes('小鹿棕') && !content().includes('未标款');
    o.no499 = !content().includes('49.9元/副');   // 极氧的花色不出现
    o.no69 = !content().includes('69元/副');
    o.discHidden = !content().includes('老款棕');
    // 价格 29.9 卡：共 3 款 + 直径徽标（小直径 2 + 未分 1）
    const card299 = [...document.querySelectorAll('#pp-content .pp-tiercard')].find(c=>c.querySelector('.pp-tiercard-price') && c.querySelector('.pp-tiercard-price').textContent==='29.9元/副');
    o.priceCard299Info = !!card299 && card299.textContent.includes('共 3 款') && card299.textContent.includes('小直径 2') && card299.textContent.includes('未分 1');
    // 抛型 日抛 卡：共 4 款
    const cardRi = [...document.querySelectorAll('#pp-content .pp-tiercard')].find(c=>c.querySelector('.pp-tiercard-price') && c.querySelector('.pp-tiercard-price').textContent==='日抛');
    o.typeCardInfo = !!cardRi && cardRi.textContent.includes('共 4 款');
    // 系列 未填系列 卡：共 2 款
    const cardNone = [...document.querySelectorAll('#pp-content .pp-tiercard')].find(c=>c.querySelector('.pp-tiercard-price') && c.querySelector('.pp-tiercard-price').textContent.includes('未填系列'));
    o.seriesNoneInfo = !!cardNone && cardNone.textContent.includes('共 2 款');
    const bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenCs = !bb || bb.style.display==='none';
    return o;
  });

  // ===== 明细层：按抛型 → 日抛（客服视角） =====
  await ev('csTypeDetail', ()=>{
    const o={};
    openPpDim('type','日抛');
    const content=()=>document.getElementById('pp-content').textContent;
    o.backBtn = !!document.querySelector('#pp-content .pp-back');
    o.typeTitleOk = content().includes('日抛') && content().includes('4 款');
    o.typePatterns = content().includes('奶茶棕') && content().includes('加测甲') && content().includes('加测乙');
    o.typeGroupsOk = content().includes('小直径') && content().includes('待分组（未标直径）');
    o.csTierNoCheckbox = document.querySelectorAll('#pp-content .pp-check').length===0;
    o.typeCards = document.querySelectorAll('#pp-content .pp-card').length;   // 4
    const bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenCsTier = !bb || bb.style.display==='none';
    ppBackToDims();
    o.backOk = ppDimView===null && document.querySelectorAll('#pp-content .pp-tiercard').length===11;
    return o;
  });

  // ===== 明细层：按直径 → 小直径（按价格档分组）+ 按价格 → 29.9（按直径分组） =====
  await ev('csDimDetail', ()=>{
    const o={};
    openPpDim('diam','小直径');
    const c1=document.getElementById('pp-content').textContent;
    o.diamGroupsByPrice = c1.includes('29.9元/副') && c1.includes('59.9元/副') && c1.includes('小鹿棕');
    o.diamCards = document.querySelectorAll('#pp-content .pp-card').length;   // 3
    ppBackToDims();
    openPpDim('price','29.9元/副');
    const c2=document.getElementById('pp-content').textContent;
    o.priceGroupsByDiam = c2.includes('小直径') && c2.includes('待分组（未标直径）') && !c2.includes('小鹿棕');
    o.priceCards = document.querySelectorAll('#pp-content .pp-card').length;  // 3
    ppBackToDims();
    return o;
  });

  // ===== 管理员：第一层批量条隐藏，明细内可见 + 已下架 =====
  await ev('adminTier', ()=>{
    const o={};
    currentProfile = { role:'admin', name:'杨茹' };
    renderPatternPricePage();
    let bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenL1 = !bb || bb.style.display==='none';   // 管理员在第一层也不显示批量条
    openPpDim('price','29.9元/副');
    bb = document.getElementById('pp-batch-bar');
    o.batchBarEl = !!bb;
    o.batchBarVisibleTier = bb && bb.style.display==='flex';
    o.adminChecks = document.querySelectorAll('#pp-content .pp-check').length;         // 3
    o.quickSelects = document.querySelectorAll('#pp-content .pp-quick select').length; // 6
    // 已下架：开启后第一层出现 月抛 卡与 69 档卡
    document.getElementById('pp-show-disc').checked = true;
    ppBackToDims();
    o.tierCardCountDisc = document.querySelectorAll('#pp-content .pp-tiercard').length;  // 13
    o.disc69Card = document.getElementById('pp-content').textContent.includes('69元/副');
    openPpDim('price','69元/副');
    o.discVisible = document.getElementById('pp-content').textContent.includes('老款棕');
    document.getElementById('pp-show-disc').checked = false;
    ppBackToDims();
    return o;
  });

  // ===== 档内分页（按抛型 → 日抛 4 款） =====
  await ev('tierPaging', ()=>{
    const o={};
    openPpDim('type','日抛');
    ppRenderLimit = 2;
    renderPatternPricePage();
    o.pagedCards = document.querySelectorAll('#pp-content .pp-card').length;          // 2
    o.loadMoreOk = /还有 2 款/.test((document.getElementById('pp-loadmore-btn')||{textContent:''}).textContent);
    ppLoadMore();
    o.afterMoreCards = document.querySelectorAll('#pp-content .pp-card').length;      // 4
    ppRenderLimit = PP_PAGE_SIZE;
    ppBackToDims();
    return o;
  });

  // ===== 双入口导航 + 别名路由重置回第一层 =====
  await ev('v2features', ()=>{
    const o={};
    o.oldNavGone = !document.querySelector('.nav-item[data-page="pattern-price"]');
    o.newNavCount = document.querySelectorAll('.nav-item[data-page="price-miyang"],.nav-item[data-page="price-jiyang"]').length;   // 2
    window.loadPatternCategories = async ()=>{};
    window.loadPatternsFromDB = async ()=>{ patternData = buildPatternTree(window.__rows || []); };
    // 模拟正在明细里浏览时点击另一品牌入口 → 应回到第一层
    ppDimView = { dim:'type', val:'日抛' };
    switchPage('price-jiyang');
    const h1 = document.querySelector('#page-pattern-price h1').textContent;
    const cj = document.getElementById('pp-content').textContent;
    o.aliasReset = ppDimView===null && ppBrandFilter==='极氧' && h1.includes('极氧');
    o.aliasJiyangOk = o.aliasReset && cj.includes('49.9元/副') && !cj.includes('29.9元/副') && !cj.includes('奶茶棕');
    o.tierCardsJiyang = document.querySelectorAll('#pp-content .pp-tiercard').length;   // 极氧仅 a3：4 个维度各 1 张卡
    o.navActiveJiyang = !!document.querySelector('.nav-item[data-page="price-jiyang"].active');
    switchPage('price-miyang');
    const cm = document.getElementById('pp-content').textContent;
    o.aliasMiyangOk = ppBrandFilter==='弥生' && cm.includes('29.9元/副') && !cm.includes('49.9元/副');
    o.navActiveMiyang = !!document.querySelector('.nav-item[data-page="price-miyang"].active');
    // 回归：switchPage 内部 refreshAdminUI 会重设批量条 → 第一层必须仍隐藏
    const bbL1 = document.getElementById('pp-batch-bar');
    o.aliasBarHiddenL1 = !bbL1 || bbL1.style.display==='none';
    return o;
  });

  // ===== 卡片快捷改档：跨档移动（管理员，按价格明细内） =====
  await ev('quickSet', async ()=>{
    const o={};
    const updates=[];
    const q = {
      _t:'', _rows:[],
      select(){ return this; }, order(){ return this; },
      then(res){ return Promise.resolve({data:this._rows, error:null}).then(res); },
      update(u){ const t=this._t; return {
        in:(col, vals)=>{ updates.push({u, col, vals}); return Promise.resolve({data:null,error:null}); },
        eq:(col, val)=>{ updates.push({u, col, val}); return Promise.resolve({data:null,error:null}); }
      }; }
    };
    window.supabase = { from:(t)=>{ q._t=t; q._rows = t==='pattern_categories' ? [] : (window.__rows || []); return q; } };
    window.loadPatternsFromDB = async ()=>{ patternData = buildPatternTree(window.__rows || []); };
    openPpDim('price','29.9元/副');
    await ppQuickSet('a6','price_tier','59.9元/副');   // a6 加测甲从 29.9 移到 59.9
    o.quickOk = updates.length===1 && updates[0].col==='id' && updates[0].val==='a6' && updates[0].u.price_tier==='59.9元/副';
    o.localSynced = (Object.values(patternData.brands).flatMap(b=>Object.values(b)).flat().find(p=>p._id==='a6')||{}).priceTier==='59.9元/副';
    o.movedOut = document.querySelectorAll('#pp-content .pp-card').length===2;   // a6 移出后 29.9 档剩 a1+a7
    return o;
  });

  // ===== 批量打标（按价格明细内，管理员） =====
  await ev('batchApply', async ()=>{
    const o={};
    const updates=[];
    const q = {
      _rows: [], _table: '',
      select(){ return this; }, order(){ return this; },
      then(res){ return Promise.resolve({data:this._rows, error:null}).then(res); },
      update(u){ const t=this._table; return { in:(col, vals)=>{ updates.push({table:t, u, ids: vals}); return Promise.resolve({data:null,error:null}); } }; }
    };
    window.supabase = { from:(t)=>{ q._table=t; q._rows = t==='pattern_categories' ? [] : (window.__rows || []); return q; } };
    window.loadPatternsFromDB = async ()=>{ patternData = buildPatternTree(window.__rows || []); };
    openPpDim('price','29.9元/副');
    ppSel.clear(); ppSel.add('a1');
    document.getElementById('pp-batch-price').value='69元/副';
    document.getElementById('pp-batch-diam').value='小直径';
    await applyPatternBatchTag();
    o.batchUpdateCount = updates.length;
    o.batchOk = updates.length===1 && updates[0].table==='pattern_assets' && updates[0].u.price_tier==='69元/副' && updates[0].u.diam_group==='小直径' && updates[0].ids.length===1 && updates[0].ids[0]==='a1';
    o.selClearedAfter = ppSel.size===0;
    return o;
  });

  await ev('searchEditor', ()=>{
    const o={};
    const rows = window.__rows || [];
    patternData = buildPatternTree(rows);
    patternCategories = [
      {id:'p1',category_type:'price',name:'29.9元/副',sort_order:1},
      {id:'p2',category_type:'price',name:'49.9元/副',sort_order:2},
      {id:'p3',category_type:'price',name:'59.9元/副',sort_order:3},
      {id:'p4',category_type:'price',name:'69元/副',sort_order:4},
      {id:'g1',category_type:'diam_group',name:'小直径',sort_order:1},
      {id:'g2',category_type:'diam_group',name:'大直径',sort_order:2},
      {id:'t1',category_type:'type',name:'日抛',sort_order:1},
      {id:'t2',category_type:'type',name:'月抛',sort_order:2},
      {id:'t3',category_type:'type',name:'半年抛',sort_order:3},
      {id:'b1',category_type:'brand',name:'弥生',sort_order:1},
    ];
    currentProfile = { role:'admin', name:'杨茹' };
    ppSel.clear(); ppDimView = null; ppRenderLimit = PP_PAGE_SIZE;
    // 第一层搜索：命中的只有小鹿棕 → 四个分区各剩 1 张卡（共 4 张）
    const sq=document.getElementById('pp-search'); sq.value='小鹿';
    renderPatternPricePage();
    const c2=document.getElementById('pp-content').textContent;
    o.searchOk = c2.includes('59.9元/副') && !c2.includes('29.9元/副')
      && document.querySelectorAll('#pp-content .pp-tiercard').length===4;
    sq.value='';
    const pat = Object.values(patternData.brands).flatMap(b=>Object.values(b)).flat().find(p=>p.name==='小鹿棕');
    window._editPattern = Object.assign({}, pat, { isNew:false, sortOrder: pat.sortOrder || 0 });
    window._editImages = [];
    renderEditorForm(pat);
    const priceSel=document.getElementById('ef-price'), dgSel=document.getElementById('ef-diamgroup');
    o.editorPriceExists = !!priceSel && priceSel.value==='59.9元/副';
    o.editorDgExists = !!dgSel && dgSel.value==='小直径';
    o.editorOptions = priceSel ? priceSel.options.length>=5 : false;
    patternPriceFilter='59.9元/副';
    const filtP=getAllPatternItems().filter(p=>(p.priceTier||'')===patternPriceFilter);
    patternPriceFilter='全部'; patternDiamGroupFilter='全部';
    o.filterFnOk = filtP.length===2 && filtP.some(p=>p.name==='小鹿棕') && filtP.some(p=>p.name==='加测丙');
    return o;
  });

  // 汇总
  out._errs = errs.slice(0,6);
  console.log(JSON.stringify(out,null,2));
  const numeric = {
    dimTitleCount:4, tierCardCount:11,
    typeCards:4, diamCards:3, priceCards:3,
    tierCardCountDisc:13,
    adminChecks:3, quickSelects:6,
    pagedCards:2, afterMoreCards:4,
    tierCardsJiyang:4
  };
  const needed = ['treeFieldsOk','noCardsLayer1','noCheckbox','noQuick','noPatternNames','no499','no69','discHidden','priceCard299Info','typeCardInfo','seriesNoneInfo','batchBarHiddenCs','backBtn','typeTitleOk','typePatterns','typeGroupsOk','csTierNoCheckbox','batchBarHiddenCsTier','backOk','diamGroupsByPrice','priceGroupsByDiam','batchBarEl','batchBarHiddenL1','batchBarVisibleTier','disc69Card','discVisible','loadMoreOk','oldNavGone','aliasReset','aliasJiyangOk','navActiveJiyang','aliasMiyangOk','navActiveMiyang','aliasBarHiddenL1','quickOk','localSynced','movedOut','batchOk','selClearedAfter','searchOk','editorPriceExists','editorDgExists','editorOptions','filterFnOk'];
  const numericKeys = Object.keys(numeric);
  const missing = needed.concat(numericKeys).filter(k=>!(k in out));
  const ok = missing.length===0 && needed.every(k=>out[k]===true) && numericKeys.every(k=>out[k]>=numeric[k]);
  const clean = errs.length===0;
  console.log('缺失断言字段:', missing.length? missing.join(','):'无');
  console.log('价格速查页全链路:', ok?'OK':'FAIL', '| realErrors:', errs.length, errs.slice(0,5).join(';'));
  console.log(ok && clean ? 'PRICE_OK' : 'PRICE_FAIL');
  await browser.close();
  clearTimeout(wd);
  process.exit(0);
})().catch(e=>{ console.error('FATAL', e && e.message ? e.message : e); clearTimeout(wd); process.exit(2); });
