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

  // ===== 第一层：四张分类大卡片（客服视角） =====
  await ev('csFirstLayer', ()=>{
    const o={};
    const content=()=>document.getElementById('pp-content').textContent;
    o.treeFieldsOk = Object.values(patternData.brands).every(b=>Object.values(b).every(arr=>arr.every(p=>'priceTier' in p && 'diamGroup' in p && '_type' in p && 'series' in p)));
    o.l1Cards = document.querySelectorAll('#pp-content .pp-tiercard').length;   // 按抛型/按系列/按直径/按价格 = 4
    o.l1Info = content().includes('按抛型') && content().includes('按系列') && content().includes('按直径') && content().includes('按价格')
      && content().includes('类 · 6 款花色');
    o.noCardsLayer1 = document.querySelectorAll('#pp-content .pp-card').length===0;   // 第一层不出现花色卡片
    o.noCheckbox = document.querySelectorAll('#pp-content .pp-check').length===0;
    o.noQuick = document.querySelectorAll('#pp-content .pp-quick').length===0;
    o.noPatternNames = !content().includes('奶茶棕') && !content().includes('小鹿棕') && !content().includes('未标款');
    o.no499 = !content().includes('49.9元/副') && !content().includes('倾慕系列') && !content().includes('日抛');   // 选项也不出现
    const bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenCs = !bb || bb.style.display==='none';
    return o;
  });

  // ===== 第二层：按系列 → 选项卡片（客服视角） =====
  await ev('csSeriesL2', ()=>{
    const o={};
    openPpDim('series');
    const content=()=>document.getElementById('pp-content').textContent;
    o.backBtn = !!document.querySelector('#pp-content .pp-back');
    o.l2Title = content().includes('按系列') && content().includes('6 款');
    o.seriesCards = document.querySelectorAll('#pp-content .pp-tiercard').length;   // 倾慕3 + 星眸1 + 未填2 = 3
    o.seriesInfo = content().includes('倾慕系列') && content().includes('星眸系列') && content().includes('未填系列');
    o.l2NoPatterns = !content().includes('奶茶棕') && !content().includes('加测甲');   // 选项卡面不出现花色名
    o.l2NoCheckbox = document.querySelectorAll('#pp-content .pp-check').length===0;
    o.optGridOk = !!document.querySelector('#pp-content .pp-tiercards.pp-opt-grid');   // 第二层自适应多列网格
    o.optGridCols = getComputedStyle(document.querySelector('#pp-content .pp-opt-grid')).gridTemplateColumns.split(' ').length;   // 宽屏≥3列
    const bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenCsL2 = !bb || bb.style.display==='none';
    ppBackToDims();
    o.backOk = ppDimView===null && document.querySelectorAll('#pp-content .pp-tiercard').length===4;
    return o;
  });

  // ===== 第三层：按抛型 → 日抛明细（客服视角） =====
  await ev('csTypeDetail', ()=>{
    const o={};
    openPpDim('type','日抛');
    const content=()=>document.getElementById('pp-content').textContent;
    o.backBtn = !!document.querySelector('#pp-content .pp-back');
    o.backLabelOk = document.querySelector('#pp-content .pp-back').textContent.includes('返回按抛型');
    o.typeTitleOk = content().includes('日抛') && content().includes('4 款');
    o.typePatterns = content().includes('奶茶棕') && content().includes('加测甲') && content().includes('加测乙');
    o.typeGroupsOk = content().includes('小直径') && content().includes('待分组（未标直径）');
    o.csTierNoCheckbox = document.querySelectorAll('#pp-content .pp-check').length===0;
    o.typeCards = document.querySelectorAll('#pp-content .pp-card').length;   // 4
    const bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenCsTier = !bb || bb.style.display==='none';
    ppBackToDimOptions('type');
    o.typeOptionCards = document.querySelectorAll('#pp-content .pp-tiercard').length;   // 日抛4 + 半年抛2 = 2
    o.backToL2Ok = ppDimView.val===null && o.typeOptionCards===2;
    ppBackToDims();
    return o;
  });

  // ===== 第三层：按直径/按价格（客服视角，交叉分组） =====
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

  // ===== 管理员：批量条只在第三层显示 + 已下架 =====
  await ev('adminTier', ()=>{
    const o={};
    currentProfile = { role:'admin', name:'杨茹' };
    renderPatternPricePage();
    let bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenL1 = !bb || bb.style.display==='none';   // 第一层隐藏
    openPpDim('price');
    bb = document.getElementById('pp-batch-bar');
    o.batchBarHiddenL2 = !bb || bb.style.display==='none';   // 第二层也隐藏
    openPpDim('price','29.9元/副');
    bb = document.getElementById('pp-batch-bar');
    o.batchBarEl = !!bb;
    o.batchBarVisibleTier = bb && bb.style.display==='flex';  // 第三层才显示
    o.adminChecks = document.querySelectorAll('#pp-content .pp-check').length;         // 3
    o.quickSelects = document.querySelectorAll('#pp-content .pp-quick select').length; // 6
    // 已下架：开启后第二层价格出现 69 卡
    document.getElementById('pp-show-disc').checked = true;
    ppBackToDimOptions('price');
    o.priceOptionCardsDisc = document.querySelectorAll('#pp-content .pp-tiercard').length;  // 29.9+59.9+69+未标价 = 4
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
    // 模拟正在第三层明细里浏览时点击另一品牌入口 → 应回到第一层
    ppDimView = { dim:'type', val:'日抛' };
    switchPage('price-jiyang');
    const h1 = document.querySelector('#page-pattern-price h1').textContent;
    const cj = document.getElementById('pp-content').textContent;
    o.aliasReset = ppDimView===null && ppBrandFilter==='极氧' && h1.includes('极氧');
    o.aliasJiyangOk = o.aliasReset && cj.includes('按价格') && cj.includes('1 款花色') && !cj.includes('奶茶棕');
    o.tierCardsJiyang = document.querySelectorAll('#pp-content .pp-tiercard').length;   // 4 张分类大卡
    openPpDim('price');
    o.jiyangPriceCards = document.querySelectorAll('#pp-content .pp-tiercard').length;  // 极氧价格层仅 49.9 一张
    o.jiyang499Ok = document.getElementById('pp-content').textContent.includes('49.9元/副');
    ppBackToDims();
    o.navActiveJiyang = !!document.querySelector('.nav-item[data-page="price-jiyang"].active');
    switchPage('price-miyang');
    const cm = document.getElementById('pp-content').textContent;
    o.aliasMiyangOk = ppBrandFilter==='弥生' && cm.includes('按价格') && cm.includes('6 款花色');
    o.navActiveMiyang = !!document.querySelector('.nav-item[data-page="price-miyang"].active');
    // 回归：switchPage 内部 refreshAdminUI 会重设批量条 → 第一层必须仍隐藏
    const bbL1 = document.getElementById('pp-batch-bar');
    o.aliasBarHiddenL1 = !bbL1 || bbL1.style.display==='none';
    return o;
  });

  // ===== 卡片提醒框：管理员可编辑 + 远端回显 + 防抖保存（第二层选项卡） =====
  await ev('cardNotes', async ()=>{
    const o={};
    const upserts=[];
    const q={ _rows:[], _table:'',
      select(){ return this; }, order(){ return this; },
      then(res){ return Promise.resolve({data:this._table==='pp_card_notes'
        ? [{note_key:'弥生|price|29.9元/副',note_text:'即将下架，优先推新款'}] : [], error:null}).then(res); },
      upsert(u){ upserts.push({table:this._table,u}); return Promise.resolve({data:null,error:null}); }
    };
    window.supabase = { from(t){ q._table=t; return q; } };
    currentProfile={role:'admin',name:'杨茹'};
    currentPage='pattern-price'; ppBrandFilter='弥生'; ppDimView={dim:'price',val:null}; ppRenderLimit=PP_PAGE_SIZE;   // 第二层：选项卡
    await loadPpCardNotes();
    renderPatternPricePage();
    const notes=[...document.querySelectorAll('#pp-content .pp-note-input')];
    o.noteInputCount=notes.length;                       // 每张渲染出的选项卡 1 个
    o.noteEveryCardOk=notes.length===document.querySelectorAll('#pp-content .pp-tiercard').length && notes.length>=3;
    o.noteLoadedOk=!!notes[0] && notes[0].value==='即将下架，优先推新款';   // 远端文字回显
    if(notes[0]){ notes[0].value='改提醒'; onPpNoteInput('弥生|price|29.9元/副', notes[0]); }
    await new Promise(r=>setTimeout(r,850));             // 等 600ms 防抖
    o.noteUpsertOk=upserts.length===1 && upserts[0].table==='pp_card_notes'
      && upserts[0].u.note_key==='弥生|price|29.9元/副' && upserts[0].u.note_text==='改提醒';
    // 客服视角：提醒变只读公告条
    currentProfile=null; renderPatternPricePage();
    o.noteCsViewOk=document.querySelectorAll('#pp-content .pp-note-input').length===0
      && document.getElementById('pp-content').textContent.includes('📢 改提醒');
    // 还原客服默认态，避免影响后续断言
    ppCardNotes={}; renderPatternPricePage();
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
    // 第一层搜索：4 张分类卡照常渲染；按价格第二层只剩 59.9 一张卡
    const sq=document.getElementById('pp-search'); sq.value='小鹿';
    renderPatternPricePage();
    const l1ok = document.querySelectorAll('#pp-content .pp-tiercard').length===4;
    openPpDim('price');
    const c2=document.getElementById('pp-content').textContent;
    o.searchOk = l1ok && c2.includes('59.9元/副') && !c2.includes('29.9元/副')
      && document.querySelectorAll('#pp-content .pp-tiercard').length===1;
    sq.value=''; ppBackToDims(); renderPatternPricePage();
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

  // ===== 高价特殊品专区（初音/定轴）：自建小数据集独立验证 =====
  await ev('specialZone', ()=>{
    const o={};
    const now=new Date().toISOString();
    const mk=(id,brand,type,name,opt={})=>({
      id, brand, type, name, series:opt.series||'', color:opt.color||'棕色系',
      diameter:opt.diameter||'14.2', color_diameter:'13.5', material:'硅水凝胶', oxygen:'', water:'',
      base_curve:'8.6', fixed_axis:opt.fixed_axis||'', spec:'', price_tier:opt.price_tier||'', diam_group:opt.diam_group||'',
      lens_img:'', eye_img:'', lens_imgs:[], eye_imgs:[], thumb_eye_url:'', thumb_lens_url:'',
      description:'推荐话术', sort_order:0, is_discontinued:false, created_at:now
    });
    const rows=[
      mk('s1','弥生','日抛','奶茶棕',{series:'倾慕系列',price_tier:'29.9元/副',diam_group:'小直径'}),
      mk('s2','弥生','日抛','初音粉',{series:'初音-日抛',price_tier:'49.9元/副',diam_group:'小直径'}),      // 线上真实系列名：初音-日抛
      mk('s3','弥生','半年抛','定轴灰',{series:'星眸系列',fixed_axis:'90°',price_tier:'99元/副',diam_group:'大直径',diameter:'14.5'}),
      mk('s4','弥生','日抛','普通灰',{series:'倾慕系列',price_tier:'29.9元/副',diam_group:'小直径'}),
      mk('s5','弥生','半年抛','初音定轴',{series:'初音未来',fixed_axis:'90°',price_tier:'69元/副',diam_group:'大直径',diameter:'14.5'}),  // 线上真实系列名：初音未来（半年抛按副）
    ];
    patternData=buildPatternTree(rows);
    patternCategories=[
      {id:'p1',category_type:'price',name:'29.9元/副',sort_order:1},
      {id:'p2',category_type:'price',name:'49.9元/副',sort_order:2},
      {id:'p3',category_type:'price',name:'59.9元/副',sort_order:3},
      {id:'p4',category_type:'price',name:'99元/副',sort_order:4},
      {id:'p5',category_type:'price',name:'69元/副',sort_order:5},
      {id:'g1',category_type:'diam_group',name:'小直径',sort_order:1},
      {id:'g2',category_type:'diam_group',name:'大直径',sort_order:2},
      {id:'t1',category_type:'type',name:'日抛',sort_order:1},
      {id:'t2',category_type:'type',name:'月抛',sort_order:2},
      {id:'t3',category_type:'type',name:'半年抛',sort_order:3},
      {id:'b1',category_type:'brand',name:'弥生',sort_order:1},
    ];
    currentProfile=null; ppSel.clear(); ppDimView=null; ppRenderLimit=PP_PAGE_SIZE; ppBrandFilter='弥生';
    document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show'));
    const sq=document.getElementById('pp-search'); if(sq) sq.value='';
    const sd=document.getElementById('pp-show-disc'); if(sd) sd.checked=false;
    renderPatternPricePage();
    const c=()=>document.getElementById('pp-content').textContent;
    // 第一层（客服）：四分类卡下方出现红色特殊品专区（初音+定轴两张红卡）
    o.spHeadOk = !!document.querySelector('#pp-content .pp-special-head')
      && c().includes('高价特殊品（初音 / 少女漫定轴）') && c().includes('价格更高');
    o.spL1Cards = document.querySelectorAll('#pp-content .pp-tiercard').length;   // 4 分类卡 + 2 红卡 = 6
    o.spRedSubOk = c().includes('禁止按普通款备注此系列');
    // 机制直接印在首层红卡上（不用点进去）：日抛按盒 4 档 + 半年抛按副 4 档，两组分开
    o.spMechCardOk = c().includes('日抛 · 按「盒」') && c().includes('半年抛 · 按「副」')
      && c().includes('49.9') && c().includes('/1盒') && c().includes('赠明信片+佩戴棒') && c().includes('199.4')
      && c().includes('69') && c().includes('/1副') && c().includes('小卡+护理液+伴侣盒') && c().includes('232.5') && c().includes('亚克力手持镜');
    o.spMechRows = document.querySelectorAll('#pp-content .pp-mech-row').length;  // 初音8 + 定轴9 = 17
    // 红卡机制网格撑满卡内容区（不再窄块居中漂浮），相邻红卡排版对称
    const card0 = [...document.querySelectorAll('#pp-content .pp-tiercard.l1')].find(c => c.querySelector('.pp-mech-grid'));
    const mg0 = card0 && card0.querySelector('.pp-mech-grid');
    if (card0 && mg0) {
      const cs = getComputedStyle(card0);
      const contentW = card0.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      o.spMechGridFullOk = mg0.clientWidth >= contentW * 0.98;
    } else o.spMechGridFullOk = false;
    o.spL1NoChecks = document.querySelectorAll('#pp-content .pp-check').length===0;
    o.spL1NoQuick = document.querySelectorAll('#pp-content .pp-quick').length===0;
    // 定轴红卡：少女漫机制三组（1副/2副/3副，只写数量+价格）+ 参与范围警示
    o.spDzMechOk = c().includes('📋 1副') && c().includes('📋 2副') && c().includes('📋 3副 · 最划算')
      && c().includes('69.8') && c().includes('正常款+定轴款') && c().includes('99.7') && c().includes('129.7')
      && c().includes('⭐最划算') && !c().includes('满减');   // 满减字样已去掉（杨茹：只写数量和价格）
    o.spDzNoteOk = c().includes('仅限少女漫定轴款 + 普通款混搭参与')
      && [...document.querySelectorAll('#pp-content .pp-mech-note')].every(n=>!n.textContent.includes('初音'));   // 定轴警示框不再提前音（杨茹：初音板块已有，放少女漫里易混淆）
    o.spDzMechRows = document.querySelectorAll('#pp-content .pp-mech-row').length;  // 首层双卡合计：初音8 + 定轴9 = 17
    // 点初音红卡 → 直达明细（客服）：banner/机制条/标题/红色角标/按价格档分组
    openPpDim('special','chuyin');
    o.spDetailCards = document.querySelectorAll('#pp-content .pp-card').length;   // 初音粉 + 初音定轴 = 2
    o.spBannerOk = c().includes('此系列花色禁止按普通款发备注');
    o.spMechDetailOk = c().includes('初音日抛联名机制') && c().includes('初音半年抛联名机制') && c().includes('/2盒') && c().includes('/2副') && c().includes('镭射');   // 明细页两组机制条常驻
    o.spTitleOk = c().includes('初音') && c().includes('2 款');
    o.spBadgeCount = document.querySelectorAll('#pp-content .pp-special-badge').length;   // 2
    o.spBadgeOk = o.spBadgeCount>=2 && c().includes('初音 · 少女漫定轴');          // s5 命中两条规则 → 双标签
    // 单位：初音日抛显示「/盒」，初音未来半年抛保持「/副」（客服视图无下拉，无干扰文本）
    o.spUnitBoxOk = c().includes('49.9元/盒') && !c().includes('49.9元/副');
    o.spUnitPairOk = c().includes('69元/副');
    // 抛型大标签：每个分组标题前彩色大字标明日抛/半年抛
    o.spTypeChips = document.querySelectorAll('#pp-content .pp-gtype').length;   // 2 组各 1 个
    o.spTypeChipOk = [...document.querySelectorAll('#pp-content .pp-gtype')].some(e=>e.textContent==='日抛')
      && [...document.querySelectorAll('#pp-content .pp-gtype')].some(e=>e.textContent==='半年抛');
    o.spBackLabelOk = (document.querySelector('#pp-content .pp-back')||{textContent:''}).textContent.includes('返回高价特殊品');
    const bbC=document.getElementById('pp-batch-bar');
    o.spBatchHiddenCs = !bbC || bbC.style.display==='none';
    // 定轴明细页：机制完整标题 + 警示注释同步常驻；归属去重后只含纯定轴款（s5 初音定轴归初音分类）
    openPpDim('special','dingzhou');
    o.spDzDetailCards = document.querySelectorAll('#pp-content .pp-card').length;   // 1（s3 定轴灰；s5 已归初音）
    o.spDzOwnOk = !c().includes('初音定轴');   // 明细不含初音定轴款花色名
    o.spDzDetailOk = c().includes('单副 · 到手价') && c().includes('2副 · 到手价') && c().includes('3副 · 到手价')
      && c().includes('129.7') && !c().includes('满减')
      && [...document.querySelectorAll('#pp-content .pp-mech-note')].every(n=>!n.textContent.includes('初音'));
    // 返回 → 特殊品汇总层（s5 同时命中两条，去重后共 3 款）
    ppBackToDimOptions('special');
    o.spL2Cards = document.querySelectorAll('#pp-content .pp-tiercard').length;   // 2 张红卡
    o.spL2CountOk = !!document.querySelector('#pp-content .pp-group-title.special')
      && c().includes('共 3 款');
    ppBackToDims();
    o.spBackToL1Ok = ppDimView===null && document.querySelectorAll('#pp-content .pp-tiercard').length===6;
    // 搜索：排除特殊品 → 红区消失；只命中初音 → 只剩初音一张红卡
    sq.value='奶茶棕'; renderPatternPricePage();
    o.spZoneGoneOnSearch = document.querySelectorAll('#pp-content .pp-tiercard').length===4
      && !c().includes('高价特殊品') && !c().includes('初音粉');
    sq.value='初音粉'; renderPatternPricePage();   // 只命中单条规则（初音、非定轴）的 s2 → 只剩初音红卡
    o.spSearchOneCards = document.querySelectorAll('#pp-content .pp-tiercard').length;   // 4 + 1
    o.spSearchOneOk = c().includes('高价特殊品（初音）') && !c().includes('高价特殊品（初音 / 少女漫定轴）') && !c().includes('定轴灰') && !c().includes('初音定轴');
    sq.value=''; renderPatternPricePage();
    // 管理员：特殊品明细内批量条显示 + 勾选框/快捷下拉齐全
    currentProfile={role:'admin',name:'杨茹'};
    openPpDim('special','chuyin');
    const bbA=document.getElementById('pp-batch-bar');
    o.spAdminBarOk = bbA && bbA.style.display==='flex';
    o.spAdminChecks = document.querySelectorAll('#pp-content .pp-check').length;          // 2
    o.spQuickSelects = document.querySelectorAll('#pp-content .pp-quick select').length;  // 4
    // 机制网格并排：明细页 .pp-mech 全部包在 .pp-mech-grid 里且实际多列（压高度，让花色进首屏）
    const mg = document.querySelector('#pp-content .pp-mech-grid');
    o.spMechGridWrapOk = !!mg && mg.querySelectorAll('.pp-mech').length >= 2;
    o.spMechGridCols = mg ? getComputedStyle(mg).gridTemplateColumns.split(' ').length : 0;
    o.spMechGridOk = o.spMechGridWrapOk && o.spMechGridCols >= 2;
    return o;
  });

  // ===== 客服信息页：管理员🔑重置密码按钮 + 函数定义（不真调接口） =====
  await ev('staffReset', ()=>{
    const o = {};
    o.staffResetFnOk = typeof adminResetPwd === 'function' && adminResetPwd.toString().includes('super-responder');
    allStaffData = [{ id:'u1', name:'小琳', real_name:'林某', phone:'13800001111', group_name:'A组' }];
    allOvertimeRecords = []; allLeaveRecords = []; staffSearchTerm = '';
    // 管理员视角：操作列有 🔑（adminResetPwd）
    currentProfile = { id:'adm1', role:'admin', name:'杨茹', status:'active' };
    renderStaffTable();
    o.staffResetBtnAdmin = [...document.querySelectorAll('#staff-tbody button')]
      .some(b => (b.getAttribute('onclick')||'').includes('adminResetPwd'));
    // 普通客服视角：无 🔑
    currentProfile = { id:'u1', role:'staff', name:'小琳', status:'active' };
    renderStaffTable();
    o.staffResetBtnCs = ![...document.querySelectorAll('#staff-tbody button')]
      .some(b => (b.getAttribute('onclick')||'').includes('adminResetPwd'));
    return o;
  });

  // ===== 提醒框点击守卫：点/拖拽文本框不触发卡片跳页，点卡面正常进明细 =====
  await ev('noteGuard', ()=>{
    const o = {};
    currentProfile = { id:'adm1', role:'admin', name:'杨茹', status:'active' };
    ppBrandFilter = '弥生'; ppDimView = { dim:'price', val:null };
    renderPatternPricePage();
    const ta = document.querySelector('#pp-content .pp-tiercard .pp-note-input');
    o.noteGuardTaExists = !!ta;
    if (ta) {
      ppDimView = null;
      ppCardClick({ target: ta }, 'price', '29.9元/副');
      o.noteGuardNoNav = ppDimView === null;   // 点在输入框上：不跳页
      ppCardClick({ target: ta.parentNode }, 'price', '29.9元/副');
      o.noteGuardNavOk = !!ppDimView && ppDimView.val === '29.9元/副';   // 点在卡面：正常进明细
    }
    return o;
  });

  // 汇总
  out._errs = errs.slice(0,6);
  console.log(JSON.stringify(out,null,2));
  const numeric = {
    l1Cards:4, seriesCards:3, typeOptionCards:2,
    typeCards:4, diamCards:3, priceCards:3,
    priceOptionCardsDisc:4, jiyangPriceCards:1,
    adminChecks:3, quickSelects:6,
    pagedCards:2, afterMoreCards:4,
    optGridCols:3,
    tierCardsJiyang:4,
    spL1Cards:6, spDetailCards:2, spBadgeCount:2, spL2Cards:2,
    spSearchOneCards:5, spAdminChecks:2, spQuickSelects:4, spMechRows:8, spTypeChips:2, spDzMechRows:17, spDzDetailCards:1, noteInputCount:3, spMechGridCols:2
  };
  const needed = ['treeFieldsOk','l1Info','noCardsLayer1','noCheckbox','noQuick','noPatternNames','no499','batchBarHiddenCs','backBtn','l2Title','seriesInfo','l2NoPatterns','l2NoCheckbox','optGridOk','batchBarHiddenCsL2','backOk','backLabelOk','typeTitleOk','typePatterns','typeGroupsOk','csTierNoCheckbox','batchBarHiddenCsTier','backToL2Ok','diamGroupsByPrice','priceGroupsByDiam','batchBarEl','batchBarHiddenL1','batchBarHiddenL2','batchBarVisibleTier','disc69Card','discVisible','loadMoreOk','oldNavGone','aliasReset','aliasJiyangOk','navActiveJiyang','aliasMiyangOk','navActiveMiyang','aliasBarHiddenL1','quickOk','localSynced','movedOut','batchOk','selClearedAfter','searchOk','editorPriceExists','editorDgExists','editorOptions','filterFnOk','spHeadOk','spRedSubOk','spMechCardOk','spL1NoChecks','spL1NoQuick','spDzMechOk','spDzNoteOk','spBannerOk','spMechDetailOk','spTitleOk','spBadgeOk','spUnitBoxOk','spUnitPairOk','spTypeChipOk','spDzDetailOk','spDzOwnOk','noteEveryCardOk','noteLoadedOk','noteUpsertOk','noteCsViewOk','spBackLabelOk','spBatchHiddenCs','spL2CountOk','spBackToL1Ok','spZoneGoneOnSearch','spSearchOneOk','spAdminBarOk','spMechGridWrapOk','spMechGridOk','spMechGridFullOk','noteGuardTaExists','noteGuardNoNav','noteGuardNavOk','staffResetFnOk','staffResetBtnAdmin','staffResetBtnCs'];
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
