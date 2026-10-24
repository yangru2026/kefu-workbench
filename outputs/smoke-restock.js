// 补货动态页冒烟 v2：批量登记 + 勾选批量操作 + 公告复制
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
    { id: 'a2', toss: '日抛', name: '恋爱情报', status: 'done', eta_date: '10.23', note: '', updated_at: '2026-10-23T09:00:00Z' },
    { id: 'a3', toss: '日抛', name: '泡沫挽歌', status: 'no', eta_date: '', note: '', updated_at: '2026-10-20T09:00:00Z' },
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
            insert: (rows) => {
              (Array.isArray(rows) ? rows : [rows]).forEach(row => store.push(Object.assign({ id: 'n' + Math.random().toString(36).slice(2, 8) }, row)));
              return chain({ data: null, error: null });
            },
            update: (row) => ({ eq: (k, id) => { const it = store.find(x => x[k] === id); if (it) Object.assign(it, row); return chain({ data: null, error: null }); } }),
            delete: () => ({ eq: (k, id) => { store = store.filter(x => x[k] !== id); return chain({ data: null, error: null }); } }),
          };
        }
        return chain({ data: null, error: null });
      },
    };
    window.supabase = { createClient: () => mockSb };
    Object.defineProperty(window, 'supabase', { value: window.supabase, writable: false, configurable: false });
  }, seed);

  await page.goto('file:///C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/restock.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  console.log('badge:', await page.$eval('#roleBadge', e => e.textContent));
  console.log('初始计数:', await page.evaluate(() => [cntWait.textContent, cntDone.textContent, cntNo.textContent].join(' | ')));

  // 1) 批量登记：粘贴采购消息风格的多行（带 D 前缀和 6片装，应自动清洗）
  await page.click('#btnAdd');
  await page.select('#fToss', '半年抛');
  await page.evaluate(() => { document.getElementById('fName').value = '半年抛\n冰岛日记\n窗外樱花\nD我喜欢你6片装\n、恋爱情报6片装\n物流顺利的话提前至26号 如有延误延1天预计27号到义乌'; });
  await page.type('#fDate', '10.26');
  await page.click('#fSave');
  await new Promise(r => setTimeout(r, 300));
  const waitNames = await page.$$eval('#gridWait .item .name', els => els.map(e => e.textContent));
  console.log('批量登记后 补货中:', await page.$eval('#cntWait', e => e.textContent), JSON.stringify(waitNames));

  // 2) 勾选两条 → 批量改到货时间（不改状态）
  await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[data-ck]')].map(e => e.dataset.ck);
    document.querySelector('[data-ck="' + ids[0] + '"]').click();
    document.querySelector('[data-ck="' + ids[1] + '"]').click();
  });
  console.log('batchBar 可见:', await page.$eval('#batchBar', e => e.classList.contains('show')), '|', await page.$eval('#batchN', e => e.textContent));
  await page.click('#bEta');
  await page.type('#batchDate', '10.27');
  await page.click('#dateApply');
  await new Promise(r => setTimeout(r, 300));
  const etas = await page.$$eval('#gridWait .item .date', els => els.map(e => e.textContent));
  console.log('批量改时间后 各条日期:', JSON.stringify(etas));
  console.log('状态未变(仍补货中):', await page.$eval('#cntWait', e => e.textContent));

  // 3) 勾选两条 → 批量设为已入库（日期自动今天）
  await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[data-ck]')].slice(0, 2);
    ids.forEach(e => { if (!e.checked) e.click(); });
  });
  await page.click('#bDone');
  await new Promise(r => setTimeout(r, 300));
  console.log('批量入库后:', await page.evaluate(() => [cntWait.textContent, cntDone.textContent, cntNo.textContent].join(' | ')));

  // 4) 批量删除
  await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[data-ck]')].slice(0, 2);
    ids.forEach(e => { if (!e.checked) e.click(); });
  });
  await page.click('#bDel');
  await new Promise(r => setTimeout(r, 300));
  console.log('批量删除后 总数:', await page.evaluate(() => cntWait.textContent + '/' + cntDone.textContent + '/' + cntNo.textContent));

  // 5) 公告复制
  const notice = await page.evaluate(() => buildNotice());
  console.log('---- 公告文案 ----\n' + notice);

  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO JS ERRORS');
  await browser.close();
})();
