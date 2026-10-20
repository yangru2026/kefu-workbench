/* 验证 vendor/img-compress.js：大 PNG 截图类图片压缩后显著变小且能成功生成 JPEG */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const LIB = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/vendor/img-compress.js';
const ALT = 'C:/Program Files/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const exe = fs.existsSync(EDGE) ? EDGE : ALT;
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: fs.readFileSync(LIB, 'utf8') });

  const r = await page.evaluate(async () => {
    // 造一张 1800x3200 的"手机长截图"（带文字块，接近真实体积）
    // 逼近真实聊天截图：白底 + 气泡 + 文字块（扁平 UI，JPEG 友好）
    const cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 2400;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ededed'; ctx.fillRect(0, 0, 1080, 2400);
    // 顶部一块"商品图/实拍图"区域（噪声），让 PNG 体积接近真实截图
    const id = ctx.getImageData(0, 0, 1080, 520);
    for (let i = 0; i < id.data.length; i += 4) {
      const n = (Math.random() * 255) | 0;
      id.data[i] = n; id.data[i + 1] = (n * 7) % 255; id.data[i + 2] = (n * 13) % 255;
    }
    ctx.putImageData(id, 0, 0);
    for (let i = 0; i < 60; i++) {
      const y = 30 + i * 38;
      ctx.fillStyle = i % 3 === 0 ? '#95ec69' : '#ffffff';
      ctx.fillRect(i % 2 ? 60 : 260, y, 660, 32);
      ctx.fillStyle = '#222';
      for (let j = 0; j < 14; j++) ctx.fillRect((i % 2 ? 72 : 272) + j * 44, y + 12, 34, 8);
    }
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    const file = new File([blob], 'shot.png', { type: 'image/png' });
    const out = await window.compressImage(file);
    return { before: file.size, after: out && out.size, type: out && out.type, name: out && out.name };
  });

  console.log('原始 PNG :', (r.before / 1024).toFixed(0) + ' KB');
  console.log('压缩后   :', (r.after / 1024).toFixed(0) + ' KB', '|', r.type, '|', r.name);
  console.log('压缩比   :', (r.before / r.after).toFixed(1) + 'x');
  console.log(r.after < r.before && r.type === 'image/jpeg' ? '✅ PASS' : '❌ FAIL');
  await browser.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
