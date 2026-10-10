/* 端到端模拟：用 ai-ask 里真实的 SYSTEM_PROMPT + 真实 Key 调豆包，
 * 验证输出格式（【可直接发送】/【要点提示】）与耗时 */
const https = require('https');
const fs = require('fs');

const KEY = process.env.ARK_KEY || '';
const MODEL = process.env.ARK_MODEL || '';

// 从函数源码里提取真实提示词
const src = fs.readFileSync('C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/supabase/functions/ai-ask/index.ts', 'utf8');
const m = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
if (!m) { console.log('未能提取 SYSTEM_PROMPT'); process.exit(1); }
const SYSTEM_PROMPT = m[1];
console.log('提示词长度:', SYSTEM_PROMPT.length, '字符\n');

const QUESTIONS = [
  '客户问：你们这个透氧量达标吗？戴着会不会闷眼睛？',
  '客户说：我上次买的戴了眼睛有点红，是不是你们质量问题？',
  '客户问：日抛和半年抛有什么区别，我新手买哪个好？',
];

function ask(q) {
  return new Promise(resolve => {
    const userMessage = [
      '【客服遇到的问题】\n' + q,
      '',
      '【可参考的内部资料】无匹配资料，请依据通用美瞳行业知识回答，不确定就说不确定。',
      '',
      '请严格按照系统要求的格式输出。',
    ].join('\n');
    const payload = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.4, max_tokens: 1500
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
        if (res.statusCode !== 200) { resolve({ q, sec, err: d.slice(0, 300) }); return; }
        const j = JSON.parse(d);
        resolve({ q, sec, usage: j.usage, text: j.choices?.[0]?.message?.content || '' });
      });
    });
    req.on('error', e => resolve({ q, err: e.message }));
    req.write(payload); req.end();
  });
}

(async () => {
  for (const q of QUESTIONS) {
    const r = await ask(q);
    console.log('══════════════════════════════════════');
    console.log('问：' + r.q);
    console.log('耗时：' + r.sec + 's | tokens：' + (r.usage ? r.usage.total_tokens : '-') +
      '（含推理 ' + (r.usage?.completion_tokens_details?.reasoning_tokens ?? '-') + '）');
    console.log('答：\n' + (r.text || ('❌ ' + r.err)));
    console.log('');
  }
})();
