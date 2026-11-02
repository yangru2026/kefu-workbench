/* 用真实历史数据交叉验证：DB 已回填的 (topic,subtopic) vs 前端 parseVOC 判定
 * 目的：保证「历史回填口径」与「以后新录入自动识别口径」一致
 * 用法：SBP_TOKEN=xxx node outputs/test-voc-taxonomy.js
 */
const fs = require('fs');
const TOKEN = process.env.SBP_TOKEN;
if (!TOKEN) { console.error('缺少 SBP_TOKEN'); process.exit(1); }
const REF = process.env.SBP_REF || 'icfgireprowcqwdodfqx';

const html = fs.readFileSync('index.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, chunk = null;
while ((m = re.exec(html))) { if (m[1].includes('let vocData = [];')) { chunk = m[1]; break; } }
if (!chunk) { console.error('未找到 VOC 脚本块'); process.exit(2); }

const store = {};
const fakeEl = (id) => (store[id] = store[id] || { id, value: '', innerHTML: '', style: {}, focus() {} });
const document = { getElementById: (id) => fakeEl(id), querySelector: () => null, querySelectorAll: () => [] };
const localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
const currentProfile = { name: '小南', group_name: 'A组' };
const currentUser = null;
const window = {};

const api = new Function('document', 'localStorage', 'currentProfile', 'currentUser', 'window', 'console',
  chunk + '\nreturn { parseVOC, VOC_TOPIC_OPTS, VOC_CAT };'
)(document, localStorage, currentProfile, currentUser, window, console);

(async () => {
  const sql = "select raw_text, topic, subtopic from customer_voice where coalesce(raw_text,'') <> '' order by random() limit 60";
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const rows = await r.json();
  let same = 0, diffTopic = 0, diffSub = 0;
  const diffs = [];
  rows.forEach(x => {
    const res = api.parseVOC(x.raw_text, 'A组');
    if (res.topic === x.topic && res.subtopic === (x.subtopic || '')) same++;
    else {
      if (res.topic !== x.topic) diffTopic++; else diffSub++;
      diffs.push({ txt: x.raw_text.slice(0, 34), db: `${x.topic}/${x.subtopic}`, js: `${res.topic}/${res.subtopic}` });
    }
  });
  console.log(`样本 ${rows.length} 条 · 完全一致 ${same} · 一级不一致 ${diffTopic} · 仅二级不一致 ${diffSub}`);
  console.log(`一致率 ${(same / rows.length * 100).toFixed(1)}%`);
  if (diffs.length) {
    console.log('--- 差异明细（前 12 条）---');
    diffs.slice(0, 12).forEach(d => console.log(`  「${d.txt}」 DB=${d.db}  JS=${d.js}`));
  }
  // 分类体系完整性自检
  console.log('一级选项:', api.VOC_TOPIC_OPTS.join(' / '));
  console.log('询货二级:', api.VOC_CAT['询货咨询'].join(' / '));
  process.exit(same / rows.length >= 0.9 ? 0 : 1);
})();
