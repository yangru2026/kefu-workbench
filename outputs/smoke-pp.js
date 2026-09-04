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
      id, brand, type, name, series:opt.series||'倾慕系列', color:opt.color||'棕色系',
      diameter:opt.diameter||'14.2', color_diameter:'13.5', material:'硅水凝胶', oxygen:'', water:'',
      base_curve:'8.6', fixed_axis:'', spec:'', price_tier:opt.price_tier||'', diam_group:opt.diam_group||'',
      lens_img:'', eye_img:'', lens_imgs:[], eye_imgs:[], thumb_eye_url:'', thumb_lens_url:'',
      description:'推荐话术', sort_order:opt.sort_order||0, is_discontinued:!!opt.disc, created_at:opt.created_at||now
    });
    const rows=[
      mk('a1','弥生','日抛','奶茶棕',{price_tier:'29.9元/副',diam_group:'小直径',created_at:now}),
      mk('a2','弥生','日抛','小鹿棕',{price_tier:'59.9元/副',diam_group:'小直径'}),
      mk('a3','极氧','月抛','云雾灰',{price_tier:'49.9元/副',diam_group:'大直径',diameter:'14.5'}),
      mk('a4','弥生','日抛','未标款',{}),
      mk('a5','弥生','月抛','老款棕',{price_tier:'69元/副',diam_group:'小直径',disc:true}),
      mk('a6','弥生','日抛','加测甲',{price_tier:'29.9元/副',diam_group:'小直径'}),
      mk('a7','弥生','日抛','加测乙',{price_tier:'29.9元/副'}),   // 29.9 档内待分组
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
      {id:'b1',category_type:'brand',name:'弥生',sort_order:1},
    ];
    currentProfile = null;              // 普通客服
    currentPage = 'pattern-price';
    ppBrandFilter = '弥生';             // 品牌由入口锁定（switchPage 别名），默认弥生
    ppTierView = null;                  // 第一层：价格档卡片
    ppRenderLimit = PP_PAGE_SIZE;
    window.loadPatternCategories = async ()=>{};   // 屏蔽别名路由触发的真实网络请求
    ppSel.clear();
    const sq=document.getElementById('pp-search'); if(sq) sq.value='';
    const sd=document.getElementById('pp-show-disc'); if(sd) sd.checked=false;
    renderPatternPricePage();
    return { __skipMerge:true };
  });

  // ===== 第一层：价格档大卡片（客服视角） =====
  await ev('csFirstLayer', ()=>{
    const o={};
    const content=()=>document.getElementById('pp-content').textContent;
    o.treeFieldsOk = Object.values(patternData.brands).every(b=>Object.values(b).every(arr=>arr.every(p=>'priceTier' in p && 'diamGroup' in p)));
    o.tierCardCount = document.querySelectorAll('#pp-content .pp-tiercard').length;   // 29.9 + 59.9 + 未标价 = 3
    o.noCardsLayer1 = document.querySelectorAll('#pp-content .pp-card').length===0;   // 第一层不出现花色卡片
    o.noCheckbox = document.querySelectorAll('#pp-content .pp-check').length===0;
    o.noQuick = document.querySelectorAll('#pp-content .pp-quick').length===0;        // 第一层无快捷改档下拉
    o.tierNames = ['29.9元/副','59.9元/副','未标价'].every(s=>content().includes(s));
    o.noPatternNames = !content().includes('奶茶棕') && !content().includes('小鹿棕') && !content().includes('未标款');  // 卡面只展示档位信息
    o.no499 = !content().includes('49.9元/副');   // 49.9 档只在极氧，弥生视图不出现
    o.no69 = !content().includes('69元/副');      // 下架款(69档)对客服隐藏
    o.discHidden = !content().includes('老款棕');
    o.enterBtn = content().includes('点击查看全部花色');
    // 29.9 卡面：共 3 款 + 直径分布徽标（小直径 2 + 未分直径 1）
    const card299 = [...document.querySelectorAll('#pp-content .pp-tiercard')].find(c=>c.textContent.includes('29.9元/副'));
    o.card299Info = !!card299 && card299.textContent.includes('共 3 款') && card299.textContent.includes('小直径 2') && card299.textContent.includes('未分直径 1');
    const bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenCs = !bb || bb.style.display==='none';   // 第一层批量条隐藏
    return o;
  });

  // ===== 第二层：进入 29.9 档（客服视角） =====
  await ev('csTierLayer', ()=>{
    const o={};
    openPpTier('29.9元/副');
    const content=()=>document.getElementById('pp-content').textContent;
    o.backBtn = !!document.querySelector('#pp-content .pp-back');
    o.tierTitle = content().includes('29.9元/副') && content().includes('3 款');
    o.patterns = content().includes('奶茶棕') && content().includes('加测甲') && content().includes('加测乙');
    o.groupsInTier = content().includes('小直径') && content().includes('待分组（未标直径）');
    o.csTierNoCheckbox = document.querySelectorAll('#pp-content .pp-check').length===0;
    o.tierCards = document.querySelectorAll('#pp-content .pp-card').length;   // 3
    const bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenCsTier = !bb || bb.style.display==='none';   // 客服永远看不到批量条
    ppBackToTiers();
    o.backOk = ppTierView===null && document.querySelectorAll('#pp-content .pp-tiercard').length===3;
    return o;
  });

  // ===== 管理员：第一层批量条隐藏，档内可见 + 已下架档 =====
  await ev('adminTier', ()=>{
    const o={};
    currentProfile = { role:'admin', name:'杨茹' };
    renderPatternPricePage();
    let bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenL1 = !bb || bb.style.display==='none';   // 管理员在第一层也不显示批量条
    openPpTier('29.9元/副');
    bb = document.getElementById('pp-batch-bar');
    o.batchBarEl = !!bb;
    o.batchBarVisibleTier = bb && bb.style.display==='flex';  // 进入档位才显示
    o.adminChecks = document.querySelectorAll('#pp-content .pp-check').length;        // 3
    o.quickSelects = document.querySelectorAll('#pp-content .pp-quick select').length; // 3 卡 × 2 = 6
    // 已下架：开启后第一层出现 69 档卡片，进入后看到老款棕
    document.getElementById('pp-show-disc').checked = true;
    ppBackToTiers();
    o.tierCardCountDisc = document.querySelectorAll('#pp-content .pp-tiercard').length;  // 4
    o.disc69Card = document.getElementById('pp-content').textContent.includes('69元/副');
    openPpTier('69元/副');
    o.discVisible = document.getElementById('pp-content').textContent.includes('老款棕');
    document.getElementById('pp-show-disc').checked = false;
    ppBackToTiers();
    return o;
  });

  // ===== 档内分页 =====
  await ev('tierPaging', ()=>{
    const o={};
    openPpTier('29.9元/副');
    ppRenderLimit = 2;
    renderPatternPricePage();
    o.pagedCards = document.querySelectorAll('#pp-content .pp-card').length;          // 2
    o.loadMoreOk = /还有 1 款/.test((document.getElementById('pp-loadmore-btn')||{textContent:''}).textContent);
    ppLoadMore();
    o.afterMoreCards = document.querySelectorAll('#pp-content .pp-card').length;      // 3
    ppRenderLimit = PP_PAGE_SIZE;
    return o;
  });

  // ===== 双入口导航 + 别名路由重置回第一层 =====
  await ev('v2features', ()=>{
    const o={};
    o.oldNavGone = !document.querySelector('.nav-item[data-page="pattern-price"]');
    o.newNavCount = document.querySelectorAll('.nav-item[data-page="price-miyang"],.nav-item[data-page="price-jiyang"]').length;   // 2
    window.loadPatternCategories = async ()=>{};
    window.loadPatternsFromDB = async ()=>{ patternData = buildPatternTree(window.__rows || []); };
    // 模拟正在档内浏览时点击另一品牌入口 → 应回到第一层价格档卡片
    ppTierView = '29.9元/副';
    switchPage('price-jiyang');
    const h1 = document.querySelector('#page-pattern-price h1').textContent;
    const cj = document.getElementById('pp-content').textContent;
    o.aliasReset = ppTierView===null && ppBrandFilter==='极氧' && h1.includes('极氧');
    o.aliasJiyangOk = o.aliasReset && cj.includes('49.9元/副') && !cj.includes('29.9元/副') && !cj.includes('云雾灰');
    o.tierCardsJiyang = document.querySelectorAll('#pp-content .pp-tiercard').length;   // 极氧只有 49.9 一张卡
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

  // ===== 卡片快捷改档：跨档移动（管理员，档内） =====
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
    openPpTier('29.9元/副');
    await ppQuickSet('a6','price_tier','59.9元/副');   // a6 加测甲从 29.9 移到 59.9
    o.quickOk = updates.length===1 && updates[0].col==='id' && updates[0].val==='a6' && updates[0].u.price_tier==='59.9元/副';
    o.localSynced = (Object.values(patternData.brands).flatMap(b=>Object.values(b)).flat().find(p=>p._id==='a6')||{}).priceTier==='59.9元/副';
    o.movedOut = document.querySelectorAll('#pp-content .pp-card').length===2;   // a6 移出后 29.9 档剩 a1+a7
    return o;
  });

  // ===== 批量打标（档内，管理员） =====
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
    openPpTier('29.9元/副');
    ppSel.clear(); ppSel.add('a1');
    document.getElementById('pp-batch-price').value='69元/副';
    document.getElementById('pp-batch-diam').value='小直径';
    await applyPatternBatchTag();
    o.batchUpdateCount = updates.length;
    o.batchFirst = updates.length ? { u: updates[0].u, ids: updates[0].ids, table: updates[0].table } : null;
    o.batchOk = updates.length===1 && updates[0].table==='pattern_assets' && updates[0].u.price_tier==='69元/副' && updates[0].u.diam_group==='小直径' && updates[0].ids.length===1 && updates[0].ids[0]==='a1';
    o.selClearedAfter = ppSel.size===0;
    return o;
  });

  await ev('searchEditor', ()=>{
    const o={};
    // 重新播种恢复确定性（batchApply 内部 reload 会覆盖本地状态）
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
      {id:'b1',category_type:'brand',name:'弥生',sort_order:1},
    ];
    currentProfile = { role:'admin', name:'杨茹' };
    ppSel.clear(); ppTierView = null; ppRenderLimit = PP_PAGE_SIZE;
    // 第一层搜索：命中的只有 59.9 卡（小鹿棕）
    const sq=document.getElementById('pp-search'); sq.value='小鹿';
    renderPatternPricePage();
    const c2=document.getElementById('pp-content').textContent;
    o.searchOk = c2.includes('59.9元/副') && !c2.includes('29.9元/副')
      && document.querySelectorAll('#pp-content .pp-tiercard').length===1;
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
    o.filterFnOk = filtP.length===1 && filtP[0].name==='小鹿棕';
    return o;
  });

  // 汇总
  out._errs = errs.slice(0,6);
  console.log(JSON.stringify(out,null,2));
  const numeric = {
    tierCardCount:3, tierCards:3, tierCardCountDisc:4,
    adminChecks:3, quickSelects:6,
    pagedCards:2, afterMoreCards:3,
    tierCardsJiyang:1
  };
  const needed = ['treeFieldsOk','noCardsLayer1','noCheckbox','noQuick','tierNames','noPatternNames','no499','no69','discHidden','enterBtn','card299Info','batchBarHiddenCs','backBtn','tierTitle','patterns','groupsInTier','csTierNoCheckbox','batchBarHiddenCsTier','backOk','batchBarEl','batchBarHiddenL1','batchBarVisibleTier','disc69Card','discVisible','loadMoreOk','oldNavGone','aliasReset','aliasJiyangOk','navActiveJiyang','aliasMiyangOk','navActiveMiyang','aliasBarHiddenL1','quickOk','localSynced','movedOut','batchOk','selClearedAfter','searchOk','editorPriceExists','editorDgExists','editorOptions','filterFnOk'];
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
