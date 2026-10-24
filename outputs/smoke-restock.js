// 补货动态页冒烟：mock supabase（admin 会话），验证三区渲染/搜索/登记/复制公告
const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new', args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const seed = [
    { id: 'a1', toss: '半年抛', name: '她的梨涡', status: 'restocking', eta_date: '10.26', note: '', updated_at: '2026-10-24T02:00:00Z' },
    { id: 'a2', toss: '日抛', name: '燧野仙踪', status: 'restocking', eta_date: '12-10号左右', note: '全度数', updated_at: '2026-10-24T02:01:00Z' },
    { id: 'a3', toss: '日抛', name: '恋爱情报', status: 'done', eta_date: '10.23', note: '全度数', updated_at: '2026-10-23T09:00:00Z' },
    { id: 'a4', toss: '日抛', name: '泡沫挽歌', status: 'no', eta_date: '', note: '', updated_at: '2026-10-20T09:00:00Z' },
    { id: 'a5', toss: '半年抛', name: '草莓大福', status: 'no', eta_date: '', note: '', updated_at: '2026-10-20T09:01:00Z' },
  ];
  await page.evaluateOnNewDocument((seed) => {
    window.confirm = () => true;
    window.alert = () => {};
    function chain(result) {
      return new Proxy(function(){}, {
        get(t, p) {
          if (p === 'then') return res => Promise.resolve(result).then(res);
          if (p === 'catch') return rej => Promise.resolve(result).catch(rej);
          return chain(result);
        },
        apply() { return chain(result); },
      });
    }
    let store = JSON.parse(JSON.stringify(seed));
    const mockSb = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u-admin', app_metadata: {} } } } }) },
      from(table) {
        if (table === 'profiles') return chain({ data: { role: 'admin', name: '茹姐' }, error: null });
        if (table === 'restock_items') {
          return {
            select: () => chain({ data: store, error: null }),
            insert: (row) => { store.push(Object.assign({ id: 'n' + Date.now(), created_at: '', updated_at: row.updated_at }, row)); return chain({ data: null, error: null }); },
            update: (row) => ({ eq: (k, id) => { const it = store.find(x => x[k] === id); if (it) Object.assign(it, row); return chain({ data: null, error: null }); } }),
            delete: () => ({ eq: (k, id) => { store = store.filter(x => x[k] !== id); return chain({ data: null, error: null }); } }),
          };
        }
        return chain({ data: null, error: null });
      },
    };
    window.supabase = { createClient: () => mockSb };
    // 防止 vendor/supabase.min.js 加载后覆盖 mock
    Object.defineProperty(window, 'supabase', { value: window.supabase, writable: false, configurable: false });
  }, seed);

  await page.goto('file:///C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/restock.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  console.log('badge:', await page.$eval('#roleBadge', e => e.textContent));
  console.log('计数:', await page.evaluate(() => [cntWait.textContent, cntDone.textContent, cntNo.textContent].join(' | ')));
  console.log('补货中第一条:', await page.$eval('#gridWait .item .name', e => e.textContent));

  // 搜索
  await page.type('#q', '梨涡');
  await new Promise(r => setTimeout(r, 200));
  console.log('搜索梨涡 计数:', await page.evaluate(() => [cntWait.textContent, cntDone.textContent, cntNo.textContent].join(' | ')));
  await page.evaluate(() => { document.getElementById('q').value = ''; render(); });

  // 登记一条（日抛 不补）
  await page.click('#btnAdd');
  await page.select('#fToss', '日抛');
  await page.type('#fName', '黑珍珠');
  await page.select('#fStatus', 'no');
  await page.click('#fSave');
  await new Promise(r => setTimeout(r, 300));
  console.log('登记后 不补:', await page.$eval('#cntNo', e => e.textContent));
  const noNames = await page.$$eval('#gridNo .item .name', els => els.map(e => e.textContent));
  console.log('不补清单:', JSON.stringify(noNames));

  // 复制公告（走 textarea 兜底，检查 toast）
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('no perm')); });
  await page.click('#btnCopy');
  await new Promise(r => setTimeout(r, 300));
  console.log('复制 toast:', await page.$eval('#toast', e => e.textContent));
  const notice = await page.evaluate(() => buildNotice());
  console.log('---- 公告文案 ----\n' + notice);

  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO JS ERRORS');
  await page.screenshot({ path: 'outputs/shot-restock.png', fullPage: true });
  await browser.close();
})();
