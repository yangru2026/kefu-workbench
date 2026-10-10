/* 对比：开启 thinking vs 关闭 thinking 的耗时与质量 */
const https = require('https');
const fs = require('fs');

const KEY = process.env.ARK_KEY;
const MODEL = process.env.ARK_MODEL;

const src = fs.readFileSync('C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/supabase/functions/ai-ask/index.ts', 'utf8');
const SYSTEM_PROMPT = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/)[1];

const Q = '客户问：日抛和半年抛有什么区别，我新手买哪个好？';

function call(extra) {
  return new Promise(resolve => {
    const payload = JSON.stringify(Object.assign({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: '【客服遇到的问题】\n' + Q + '\n\n【可参考的内部资料】无匹配资料，请依据通用美瞳行业知识回答，不确定就说不确定。\n\n请严格按照系统要求的格式输出。' }
      ],
      temperature: 0.4, max_tokens: 1500
    }, extra));
    const t0 = Date.now();
    const req = https.request({
      host: 'ark.cn-beijing.volces.com', path: '/api/v3/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        if (res.statusCode !== 200) { resolve({ sec, err: d.slice(0, 300) }); return; }
        const j = JSON.parse(d);
        resolve({ sec, usage: j.usage, text: j.choices?.[0]?.message?.content || '' });
      });
    });
    req.on('error', e => resolve({ err: e.message }));
    req.write(payload); req.end();
  });
}

(async () => {
  for (const [label, extra] of [
    ['① 默认（带思考）', {}],
    ['② thinking 关闭', { thinking: { type: 'disabled' } }],
    ['③ thinking 关闭 + 少 tokens', { thinking: { type: 'disabled' }, max_tokens: 800 }],
  ]) {
    const r = await call(extra);
    console.log('\n══════ ' + label + ' ══════');
    if (r.err) { console.log('❌', r.err); continue; }
    console.log('耗时:', r.sec + 's | tokens:', r.usage.total_tokens,
      '(推理', r.usage?.completion_tokens_details?.reasoning_tokens ?? 0, ')');
    console.log('答:\n' + r.text);
  }
})();
