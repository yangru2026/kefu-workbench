/* 生成 huaming.html：花名速查（定轴/普通），数据来自 outputs/feishu/hua_ming_raw.json 的「花名大全」sheet */
const fs = require('fs');
const path = require('path');
const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'feishu/hua_ming_raw.json'), 'utf8'));
const rows = (raw['花名大全'].rows || []).filter(r => r && r[0] && r[0] !== '花名' && !/^说明：/.test(r[0]));
const items = rows.map(r => ({
  name: r[0] || '',
  kind: (r[1] || '').trim(),        // 定轴 / 普通
  toss: (r[2] || '').trim(),        // 半年抛 / 日抛
  series: (r[3] || '').trim(),
  color: (r[4] || '').trim(),
  special: (r[5] || '').trim(),
  note: (r[6] || '').trim(),
}));
const cnt = k => items.filter(x => x.kind === k).length;
const stats = { total: items.length, dingzhou: cnt('定轴'), putong: cnt('普通'), half: items.filter(x => x.toss === '半年抛').length, daily: items.filter(x => x.toss === '日抛').length };
console.log('条数:', items.length, JSON.stringify(stats));
const dataJs = JSON.stringify(items);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>花名速查</title>
<style>
  :root{ --primary:#10b981; --primary-dark:#059669; --primary-light:rgba(16,185,129,.1);
         --text:#1e293b; --muted:#64748b; --border:#e2e8f0; --bg:#f7f9f8;
         --dz:#c2410c; --dz-bg:#fff1e7; --pt:#047857; --pt-bg:#e7f8f1; }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
       background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;}
  .topbar{display:flex;align-items:center;gap:12px;padding:14px 20px;background:#fff;
          border-bottom:1px solid var(--border);flex-wrap:wrap;position:sticky;top:0;z-index:10;}
  .topbar h1{font-size:18px;font-weight:800;letter-spacing:.5px;}
  .badge{font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;background:var(--primary-light);color:var(--primary-dark);}
  .wrap{width:100%;max-width:1080px;margin:0 auto;padding:22px 20px 60px;flex:1;}
  .intro{color:var(--muted);font-size:13.5px;line-height:1.7;margin:0 2px 14px;}
  .stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
  .stat{background:#fff;border:1px solid var(--border);border-radius:12px;padding:10px 16px;font-size:13px;color:var(--muted);}
  .stat b{font-size:17px;color:var(--text);margin-right:4px;}
  .stat.dz b{color:var(--dz);} .stat.pt b{color:var(--pt);}
  .filters{background:#fff;border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px;}
  .search{flex:1;min-width:220px;position:relative;}
  .search input{width:100%;padding:11px 14px 11px 38px;border:1.5px solid var(--border);border-radius:10px;font-size:14.5px;font-family:inherit;outline:none;transition:border .15s;}
  .search input:focus{border-color:var(--primary);}
  .search .ico{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:15px;}
  .chip{padding:8px 16px;border-radius:20px;border:1.5px solid var(--border);background:#fff;font-size:13.5px;font-weight:700;color:var(--muted);cursor:pointer;font-family:inherit;transition:all .15s;}
  .chip:hover{border-color:var(--primary);color:var(--primary-dark);}
  .chip.on{background:var(--primary);border-color:var(--primary);color:#fff;}
  .chip.dz.on{background:var(--dz);border-color:var(--dz);}
  select.chip{appearance:auto;padding-right:12px;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;}
  .card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:8px;
        box-shadow:0 3px 12px rgba(31,41,55,.05);border-left:4px solid var(--border);}
  .card.dz{border-left-color:#f97316;}
  .card.pt{border-left-color:var(--primary);}
  .card .head{display:flex;align-items:center;gap:10px;}
  .card .name{font-size:16px;font-weight:800;flex:1;word-break:break-all;}
  .tag{font-size:11.5px;font-weight:800;padding:3px 11px;border-radius:20px;white-space:nowrap;}
  .tag.dz{background:var(--dz-bg);color:var(--dz);}
  .tag.pt{background:var(--pt-bg);color:var(--pt);}
  .meta{font-size:12.5px;color:var(--muted);line-height:1.7;}
  .meta b{color:#334155;font-weight:700;}
  .sp{display:flex;gap:6px;flex-wrap:wrap;}
  .sp span{font-size:11px;font-weight:700;background:#f1f5f9;color:#475569;border-radius:6px;padding:2px 8px;}
  .note{font-size:12px;color:var(--muted);background:#f8fafc;border-radius:8px;padding:6px 10px;line-height:1.6;}
  .empty{grid-column:1/-1;text-align:center;padding:50px 0;color:var(--muted);font-size:14px;}
  .empty .big{font-size:38px;display:block;margin-bottom:10px;}
  .foot{text-align:center;font-size:12px;color:#94a3b8;padding:20px 0 0;}
  .cnt-line{font-size:12.5px;color:var(--muted);margin:0 2px 12px;}
  @media (max-width:560px){ .grid{grid-template-columns:1fr;} .filters{padding:12px;} }
</style>
</head>
<body>
  <div class="topbar">
    <h1>🌸 花名速查</h1>
    <span class="badge">定轴 / 普通 一秒确认</span>
  </div>
  <div class="wrap">
    <p class="intro">输入花名或色系关键词即可查询该花色属于<b>定轴款</b>还是<b>普通款</b>。定轴款花名以 <b>D</b> 开头。数据同步自《花名大全》（半年抛明细 / 日抛明细 / 特殊类明细三表汇总）。</p>
    <div class="stats">
      <div class="stat"><b>__TOTAL__</b>共收录花色</div>
      <div class="stat dz"><b>__DZ__</b>定轴款</div>
      <div class="stat pt"><b>__PT__</b>普通款</div>
      <div class="stat"><b>__HALF__</b>半年抛</div>
      <div class="stat"><b>__DAILY__</b>日抛</div>
    </div>
    <div class="filters">
      <div class="search"><span class="ico">🔍</span><input id="q" type="text" placeholder="搜花名 / 色系 / 系列，如：乌托邦 · 满瞳色 · 少女漫" autocomplete="off"></div>
      <button class="chip on" data-kind="">全部</button>
      <button class="chip dz" data-kind="定轴">定轴款</button>
      <button class="chip pt" data-kind="普通">普通款</button>
      <button class="chip" data-toss="">全部抛型</button>
      <button class="chip" data-toss="半年抛">半年抛</button>
      <button class="chip" data-toss="日抛">日抛</button>
      <select class="chip" id="seriesSel"><option value="">全部系列</option></select>
    </div>
    <div class="cnt-line" id="cnt"></div>
    <div class="grid" id="grid"></div>
    <div class="foot">尤赫售前客服工作台 · 花名速查</div>
  </div>
<script>
  const DATA = __DATA__;
  const grid = document.getElementById('grid');
  const qInput = document.getElementById('q');
  const cntEl = document.getElementById('cnt');
  let fKind = '', fToss = '', fSeries = '';

  // 系列下拉
  const seriesList = [...new Set(DATA.map(x => x.series).filter(Boolean))].sort();
  const sel = document.getElementById('seriesSel');
  seriesList.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o); });

  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function render(){
    const q = qInput.value.trim().toLowerCase();
    const list = DATA.filter(x =>
      (!fKind || x.kind === fKind) &&
      (!fToss || x.toss === fToss) &&
      (!fSeries || x.series === fSeries) &&
      (!q || [x.name, x.color, x.series, x.special, x.note].join(' ').toLowerCase().includes(q))
    );
    cntEl.textContent = '匹配 ' + list.length + ' 款（共 ' + DATA.length + ' 款）';
    grid.innerHTML = list.length ? list.map(x =>
      '<div class="card ' + (x.kind === '定轴' ? 'dz' : 'pt') + '">' +
        '<div class="head"><span class="name">' + esc(x.name) + '</span>' +
          '<span class="tag ' + (x.kind === '定轴' ? 'dz' : 'pt') + '">' + (x.kind || '未标') + '</span></div>' +
        '<div class="meta"><b>' + esc(x.toss || '—') + '</b>' + (x.series ? ' · ' + esc(x.series) : '') + '</div>' +
        (x.color ? '<div class="meta">色系：<b>' + esc(x.color) + '</b></div>' : '') +
        (x.special ? '<div class="sp">' + x.special.split(/[\/、，,;；]+/).filter(Boolean).map(s => '<span>' + esc(s.trim()) + '</span>').join('') + '</div>' : '') +
        (x.note ? '<div class="note">' + esc(x.note) + '</div>' : '') +
      '</div>'
    ).join('') : '<div class="empty"><span class="big">🔍</span>没找到匹配的花色，换个关键词试试～</div>';
  }

  document.querySelectorAll('.filters .chip[data-kind]').forEach(c =>
    c.addEventListener('click', () => {
      document.querySelectorAll('.filters .chip[data-kind]').forEach(x => x.classList.remove('on'));
      c.classList.add('on'); fKind = c.dataset.kind; render();
    }));
  document.querySelectorAll('.filters .chip[data-toss]').forEach(c =>
    c.addEventListener('click', () => {
      document.querySelectorAll('.filters .chip[data-toss]').forEach(x => x.classList.remove('on'));
      c.classList.add('on'); fToss = c.dataset.toss; render();
    }));
  sel.addEventListener('change', () => { fSeries = sel.value; render(); });
  qInput.addEventListener('input', render);
  render();
</script>
</body>
</html>
`;
const out = html
  .replace('__DATA__', dataJs)
  .replace('__TOTAL__', String(stats.total))
  .replace('__DZ__', String(stats.dingzhou))
  .replace('__PT__', String(stats.putong))
  .replace('__HALF__', String(stats.half))
  .replace('__DAILY__', String(stats.daily));
fs.writeFileSync(path.resolve(__dirname, '..', 'huaming.html'), out, 'utf8');
console.log('✅ huaming.html 生成，长度', out.length);
