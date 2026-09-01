const puppeteer = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/outputs/feishu-jiyang.txt';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  try {
    await page.goto('https://yow5cuygtx.feishu.cn/docx/FbchdkfWIoiNGPxgvv5cx6i0nwk', {
      waitUntil: 'networkidle2',
      timeout: 120000
    });
    await new Promise(r => setTimeout(r, 5000));

    // 滚动到底部以触发懒加载
    await page.evaluate(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));
      const step = 800;
      const max = document.body.scrollHeight || 20000;
      for (let y = 0; y < max; y += step) {
        window.scrollTo(0, y);
        await delay(600);
      }
      window.scrollTo(0, document.body.scrollHeight);
      await delay(1000);
    });

    const text = await page.evaluate(() => {
      const root = document.querySelector('.docx-wrapper') || document.querySelector('.docx-body') || document.body;
      return root.innerText;
    });
    fs.writeFileSync(OUT, text, 'utf8');
    console.log('saved to', OUT);
    console.log(text.slice(0, 3000));
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await browser.close();
  }
})();
