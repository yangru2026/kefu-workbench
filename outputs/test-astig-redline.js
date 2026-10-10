/* 验证散光红线：问散光相关问题，检查回答里不得出现「散光定制/定制轴位/定制散光」 */
const https = require('https');
const fs = require('fs');

const KEY = process.env.ARK_KEY;
const MODEL = process.env.ARK_MODEL;
const src = fs.readFileSync('C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/supabase/functions/ai-ask/index.ts', 'utf8');
const SYSTEM_PROMPT = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/)[1];

const QUESTIONS = [
  '客户问：我有散光，你们能定制散光片吗？',
  '客户问：我是散光眼，戴你们家的美瞳会不会转位？',
  '客户问：听说你们有定轴的款，那个能定制散光轴位吗？',
];

function ask(q) {
  return new Promise(resolve => {
    const payload = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: '【客服遇到的问题】\n' + q + '\n\n【可参考的内部资料】无匹配资料。\n\n请严格按照系统要求的格式输出。' }
      ],
      temperature: 0.4, max_tokens: 1500,
      thinking: { type: 'disabled' }
    });
    const t0 = Date.now();
    const req = https.request({
      host: 'ark.cn-beijing.volces.com', path: '/api/v3/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        if (res.statusCode !== 200) { resolve({ sec, text: '❌ ' + d.slice(0, 200) }); return; }
        const j = JSON.parse(d);
        resolve({ sec, text: j.choices?.[0]?.message?.content || '' });
      });
    });
    req.on('error', e => resolve({ text: 'ERR ' + e.message }));
    req.write(payload); req.end();
  });
}

(async () => {
  const BAD = /散光定制|定制轴位|定制散光|散光片定制/;
  // 只扫「可直接发送」段（那是真正发给客户的话术）；要点提示是给客服看的内部说明
  function directSection(text) {
    const m = text.match(/【可直接发送】\s*([\s\S]*?)(?=【要点提示】|【专业参数】|$)/);
    return m ? m[1] : text;
  }
  let allPass = true;
  for (const q of QUESTIONS) {
    const r = await ask(q);
    const direct = directSection(r.text);
    const hit = BAD.test(direct);
    if (hit) allPass = false;
    console.log('════════════════════════════════');
    console.log('问：' + q);
    console.log('耗时 ' + r.sec + 's | ' + (hit ? '❌❌❌ 发送话术出现违禁词！' : '✅ 发送话术未出现违禁词'));
    console.log('答：\n' + r.text);
    console.log('');
  }
  console.log(allPass ? 'ALL_PASS ✅ 三题全部合规' : 'HAS_VIOLATION ❌ 有违禁');
})();
