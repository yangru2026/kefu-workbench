// 特殊类花色速查模板：读 outputs/feishu/special.json（飞书「特殊类花色明细表」缓存）
// 三级筛选：一级=特殊类别（6个子表） 二级=日抛/半年抛 三级=系列
const fs = require('fs');
const raw = require('./feishu/special.json');

const CATS = ['定轴', '小直径', '超薄', '满着色', '大基弧', '小基弧', '39.9三幅'];

function norm(s) { return (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim(); }

// 从块标题解析 抛型 + 系列，如 "日抛-少女漫" / "人鱼日抛" / "半年抛 少女漫" / " 日抛"
function parseSeriesHeader(h) {
  const s = norm(h).replace(/[－—–]/g, '-');
  let toss = '', series = '';
  if (/^日抛/.test(s)) { toss = '日抛'; series = s.replace(/^日抛/, '').replace(/^[-· 　]+/, ''); }
  else if (/日抛$/.test(s)) { toss = '日抛'; series = s.replace(/日抛$/, '').replace(/[-· 　]+$/, ''); }
  else if (/^半年抛/.test(s)) { toss = '半年抛'; series = s.replace(/^半年抛/, '').replace(/^[-· 　]+/, ''); }
  else if (/半年抛/.test(s)) { toss = '半年抛'; series = s.replace(/半年抛/g, '').replace(/^[-· 　]+/, '').trim(); }
  else { series = s; }
  series = series.replace(/[（(].*?[)）]/g, '').trim();
  return { toss, series };
}

const records = [];
const issues = [];

// ---- 反查系列：用「半年抛明细表 / 日抛明细表」的分表标题（=系列名）+ 花名 建立映射 ----
const SERIES_ALIAS = { '初音': '初音未来' };
const seriesMap = new Map(); // key: toss|花名  → 系列
function buildSeriesMap(file, toss) {
  const d = require('./feishu/' + file);
  d.sheets.forEach(sh => {
    const hdr = (sh.values[0] || []).map(x => norm(x));
    const iN = hdr.indexOf('花名');
    if (iN < 0) return;
    sh.values.slice(1).forEach(r => {
      const n = norm(r[iN]);
      if (!n) return;
      if (!seriesMap.has(toss + '|' + n)) seriesMap.set(toss + '|' + n, sh.title);
      if (!seriesMap.has('*|' + n)) seriesMap.set('*|' + n, sh.title);
    });
  });
}
buildSeriesMap('half_year.json', '半年抛');
buildSeriesMap('daily.json', '日抛');

CATS.forEach(cat => {
  const sh = raw.sheets.find(x => x.title === cat);
  if (!sh) return; // 39.9三幅不在飞书表里，单独从 xlsx 读
  const hdr = (sh.values[0] || []).map(x => norm(x));
  const idx = {};
  ['系列', '花名', '色系', '直径', '着色直径', '基弧', '高光'].forEach(k => { idx[k] = hdr.indexOf(k); });

  let cur = { toss: '', series: '' };
  sh.values.slice(1).forEach((r, i) => {
    const name = idx['花名'] >= 0 ? norm(r[idx['花名']]) : '';
    const head = idx['系列'] >= 0 ? norm(r[idx['系列']]) : '';
    if (head) cur = parseSeriesHeader(head);
    if (!name) return;
    const get = k => (idx[k] >= 0 ? norm(r[idx[k]]) : '');
    let series = SERIES_ALIAS[cur.series] || cur.series;
    let seriesFrom = '表格';
    if (!series) {
      const hit = seriesMap.get(cur.toss + '|' + name) || seriesMap.get('*|' + name);
      if (hit) { series = SERIES_ALIAS[hit] || hit; seriesFrom = '反查'; }
    }
    records.push({
      cat,
      toss: cur.toss,
      series,
      name,
      color: get('色系'),
      dia: get('直径'),
      tint: get('着色直径'),
      bc: get('基弧'),
      hl: get('高光'),
    });
    if (!cur.toss) issues.push(`[${cat}] 第${i + 2}行「${name}」缺抛型归属`);
    if (!series) issues.push(`[${cat}] 第${i + 2}行「${name}」缺系列`);
    else if (seriesFrom === '反查') issues.push(`[${cat}] 「${name}」系列为空，已按明细表反查为「${series}」（建议飞书表里补上）`);
  });
});

// ---- 39.9三幅可选花色（来源：D:/桌面/美瞳花名打印清单.xlsx，outputs/feishu/special_399.json）----
const blocks399 = require('./feishu/special_399.json');
blocks399.forEach(b => b.names.forEach(n => {
  records.push({ cat: '39.9三幅', toss: '', series: b.series, name: n, color: '', dia: '', tint: '', bc: '', hl: '' });
}));

// 统计
const stat = {};
CATS.forEach(c => {
  const rs = records.filter(r => r.cat === c);
  stat[c] = { total: rs.length, 日抛: rs.filter(r => r.toss === '日抛').length, 半年抛: rs.filter(r => r.toss === '半年抛').length, 未知: rs.filter(r => !r.toss).length };
});
console.log('总记录:', records.length);
CATS.forEach(c => console.log(`  ${c}: ${stat[c].total} 款（日抛 ${stat[c]['日抛']} / 半年抛 ${stat[c]['半年抛']}${stat[c].未知 ? ' / 未标 ' + stat[c].未知 : ''}）`));
console.log('数据问题:', issues.length ? '\n  ' + issues.join('\n  ') : '无');

fs.writeFileSync('outputs/feishu/special_parsed.json', JSON.stringify({ records, stat, issues }, null, 1), 'utf8');

// 生成模板页
const DATA = JSON.stringify(records);
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>特殊花色速查</title>
<style>
  :root{ --primary:#10b981; --primary-dark:#059669; --primary-light:rgba(16,185,129,.1);
         --text:#1e293b; --muted:#64748b; --border:#e2e8f0; --bg:#f7f9f8;
         --cat-c:#10b981; --cat-bg:#e7f8f1; --cat-bd:#a7f3d0; }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
       background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;}
  .toolbar{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid var(--border);padding:10px 16px 12px;}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
  .row+.row{margin-top:9px;padding-top:9px;border-top:1px dashed #eef2f6;}
  .row-lv{font-size:11px;font-weight:800;color:#94a3b8;letter-spacing:.5px;margin-right:2px;width:30px;}
  .chip{border-radius:16px;border:1.5px solid var(--border);background:#fff;font-family:inherit;cursor:pointer;transition:all .15s;white-space:nowrap;}
  .chip.lv1{padding:7px 15px;font-size:13.5px;font-weight:800;color:#334155;}
  .chip.lv1:hover{border-color:var(--cat-c);color:var(--cat-c);}
  .chip.lv1.on{background:var(--cat-c);border-color:var(--cat-c);color:#fff;box-shadow:0 2px 8px var(--cat-bg);}
  .chip.lv2{padding:5px 13px;font-size:12.5px;font-weight:700;color:var(--muted);}
  .chip.lv2.on{border-color:var(--cat-c);color:var(--cat-c);background:var(--cat-bg);}
  .chip.lv3{padding:4px 11px;font-size:12px;font-weight:600;color:#64748b;border-radius:13px;background:#f8fafc;}
  .chip.lv3.on{background:#334155;border-color:#334155;color:#fff;}
  .chip .n{font-size:11px;opacity:.7;margin-left:3px;font-weight:600;}
  .search{flex:1;min-width:180px;position:relative;margin-left:auto;}
  .search input{width:100%;padding:8px 12px 8px 32px;border:1.5px solid var(--border);border-radius:9px;font-size:13.5px;font-family:inherit;outline:none;background:var(--bg);}
  .search input:focus{border-color:var(--cat-c);background:#fff;}
  .search .ico{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--muted);}
  .wrap{width:100%;max-width:1080px;margin:0 auto;padding:12px 16px 50px;flex:1;}
  .crumb{font-size:12px;color:var(--muted);margin:0 2px 10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
  .crumb b{color:var(--cat-c);font-weight:800;}
  .crumb .tag{background:var(--cat-bg);border:1px solid var(--cat-bd);border-radius:6px;padding:1px 7px;font-size:11.5px;color:var(--cat-c);font-weight:700;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;}
  .item{background:var(--cat-bg);border:1.5px solid var(--cat-bd);border-radius:9px;padding:8px 12px;font-size:14px;font-weight:700;line-height:1.4;word-break:break-all;color:#1e293b;}
  .item:hover{border-color:var(--cat-c);box-shadow:0 2px 8px var(--cat-bg);}
  .item small{display:block;font-size:11px;font-weight:500;color:#94a3b8;margin-top:2px;}
  .empty{text-align:center;padding:44px 0;color:var(--muted);font-size:14px;}
  .foot{text-align:center;font-size:11.5px;color:#94a3b8;padding:18px 0 0;}
  @media (max-width:560px){ .grid{grid-template-columns:repeat(auto-fill,minmax(118px,1fr));} .search{min-width:100%;margin-left:0;} }
</style>
</head>
<body>
  <div class="toolbar">
    <div class="row">
      <span class="row-lv">类别</span>
      <div class="row" id="lv1" style="gap:8px;"></div>
      <div class="search"><span class="ico">🔍</span><input id="q" placeholder="搜花名 / 系列" autocomplete="off"></div>
    </div>
    <div class="row">
      <span class="row-lv">抛型</span>
      <div class="row" id="lv2" style="gap:8px;"></div>
    </div>
    <div class="row">
      <span class="row-lv">系列</span>
      <div class="row" id="lv3" style="gap:6px;"></div>
    </div>
  </div>
  <div class="wrap">
    <div class="crumb" id="crumb"></div>
    <div class="grid" id="grid"></div>
    <div class="foot">尤赫售前客服工作台 · 特殊花色速查（模板）</div>
  </div>
<script>
  const DATA = ${DATA};
  const CATS = ${JSON.stringify(CATS)};
  // 每个类别的主题色：[主色, 浅底, 浅边框]
  const COLORS = {
    '定轴':   ['#ea580c', '#fff7ed', '#fed7aa'],
    '小直径': ['#2563eb', '#eff6ff', '#bfdbfe'],
    '超薄':   ['#7c3aed', '#f5f3ff', '#ddd6fe'],
    '满着色': ['#db2777', '#fdf2f8', '#fbcfe8'],
    '大基弧': ['#0d9488', '#f0fdfa', '#99f6e4'],
    '小基弧': ['#ca8a04', '#fefce8', '#fde68a'],
    '39.9三幅': ['#4f46e5', '#eef2ff', '#c7d2fe'],
  };
  let fCat = CATS[0], fToss = '', fSeries = '', q = '';

  const $ = id => document.getElementById(id);
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function applyColor(){
    const c = COLORS[fCat] || COLORS['定轴'];
    document.documentElement.style.setProperty('--cat-c', c[0]);
    document.documentElement.style.setProperty('--cat-bg', c[1]);
    document.documentElement.style.setProperty('--cat-bd', c[2]);
  }

  function base(){ // 受 类别 + 搜索 影响的数据
    return DATA.filter(x => x.cat === fCat
      && (!q || (x.name + ' ' + x.series + ' ' + x.color).toLowerCase().includes(q)));
  }

  function renderChips(){
    // 一级：类别
    $('lv1').innerHTML = CATS.map(c => {
      const n = DATA.filter(x => x.cat === c).length;
      return '<button class="chip lv1 ' + (fCat === c ? 'on' : '') + '" data-cat="' + c + '">' + c + '<span class="n">' + n + '</span></button>';
    }).join('');
    // 二级：抛型（当前类别下；无抛型数据的类别只显示「全部」）
    const b = base();
    const t1 = b.filter(x => x.toss === '日抛').length, t2 = b.filter(x => x.toss === '半年抛').length;
    $('lv2').innerHTML =
      '<button class="chip lv2 ' + (!fToss ? 'on' : '') + '" data-toss="">全部<span class="n">' + b.length + '</span></button>' +
      (t1 ? '<button class="chip lv2 ' + (fToss === '日抛' ? 'on' : '') + '" data-toss="日抛">日抛<span class="n">' + t1 + '</span></button>' : '') +
      (t2 ? '<button class="chip lv2 ' + (fToss === '半年抛' ? 'on' : '') + '" data-toss="半年抛">半年抛<span class="n">' + t2 + '</span></button>' : '');
    // 三级：系列（当前类别+抛型下）
    const pool = b.filter(x => !fToss || x.toss === fToss);
    const ser = [...new Set(pool.map(x => x.series).filter(Boolean))];
    $('lv3').innerHTML =
      '<button class="chip lv3 ' + (!fSeries ? 'on' : '') + '" data-series="">全部<span class="n">' + pool.length + '</span></button>' +
      ser.map(s => {
        const n = pool.filter(x => x.series === s).length;
        return '<button class="chip lv3 ' + (fSeries === s ? 'on' : '') + '" data-series="' + esc(s) + '">' + esc(s) + '<span class="n">' + n + '</span></button>';
      }).join('');
    $('lv1').querySelectorAll('[data-cat]').forEach(el => el.onclick = () => { fCat = el.dataset.cat; fToss = ''; fSeries = ''; render(); });
    $('lv2').querySelectorAll('[data-toss]').forEach(el => el.onclick = () => { fToss = el.dataset.toss; fSeries = ''; render(); });
    $('lv3').querySelectorAll('[data-series]').forEach(el => el.onclick = () => { fSeries = el.dataset.series; render(); });
  }

  function render(){
    applyColor();
    renderChips();
    const list = base().filter(x => (!fToss || x.toss === fToss) && (!fSeries || x.series === fSeries));
    $('crumb').innerHTML = '<b>' + fCat + '</b>' + (fToss ? ' <span style="color:#cbd5e1">›</span> ' + fToss : '') +
      (fSeries ? ' <span style="color:#cbd5e1">›</span> ' + esc(fSeries) : '') +
      ' <span class="tag">共 ' + list.length + ' 款</span>';
    $('grid').innerHTML = list.length ? list.map(x => {
      const meta = [];
      if (x.series) meta.push(x.series);
      if (x.dia) meta.push('直径 ' + x.dia);
      if (x.tint) meta.push('着色 ' + x.tint);
      if (x.bc) meta.push('基弧 ' + x.bc);
      if (x.hl) meta.push(x.hl);
      // 编码展示规则：
      // 定轴类别：日抛 = D+花名+6片装，半年抛 = D+花名
      // 其他类别：日抛 = 花名+6片装，半年抛 = 原花名
      const code = x.cat === '定轴'
        ? 'D' + x.name + (x.toss === '日抛' ? '6片装' : '')
        : x.name + (x.toss === '日抛' ? '6片装' : '');
      return '<div class="item" title="' + esc(meta.join(' · ')) + '">' + esc(code) +
             '<small>' + esc([x.series, x.dia ? 'Φ' + x.dia : ''].filter(Boolean).join(' · ')) + '</small></div>';
    }).join('') : '<div class="empty">该筛选下暂无花色</div>';
  }

  $('q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); fSeries = ''; render(); });
  render();
</script>
</body>
</html>
`;
fs.writeFileSync('special.html', html);
console.log('模板已生成 special.html，字节:', fs.statSync('special.html').size);
