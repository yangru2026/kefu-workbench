/* 验证「通用最高原则」：不制造多余话题 / 不确定不硬说工艺和有没有 / 只按问法回复
 * 用法：ARK_KEY=xxx ARK_MODEL=doubao-seed-2-1-lite-260915 node outputs/test-prompt-general.js
 */
const https = require('https');
const fs = require('fs');

const KEY = process.env.ARK_KEY;
const MODEL = process.env.ARK_MODEL;
const src = fs.readFileSync(
  'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/supabase/functions/ai-ask/index.ts', 'utf8'
);
const SYSTEM_PROMPT = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/)[1];

// 场景 → 客服（客户）的问法 + 「可直接发送」段里绝不能出现的词
const CASES = [
  {
    name: 'A 乱转（客户没问定轴/高光）',
    q: '客户问：你们这个镜片戴上会不会转啊？我之前戴的会跑偏，有点怕',
    bad: /定轴|高光|散光|工艺|轴位/,
  },
  {
    name: 'B 散光（绝不能出现"定制"）',
    q: '客户问：我散光 200 度，你们能做散光片吗？',
    bad: /定制/,
  },
  {
    name: 'C 直接问是不是定轴（被问到了，可回答）',
    q: '客户问：你们家是定轴的吗？',
    bad: /高光|散光|轴位定制/,   // 不许顺带扯高光/散光
  },
  {
    name: 'D 只问佩戴感受（不许引申工艺）',
    q: '客户问：这个戴着眼睛会不舒服吗？',
    bad: /定轴|高光|散光|工艺/,
  },
  {
    name: 'E 不知道的参数（不许编造数字）',
    q: '客户问：弥生那款 14.2 的含水量是多少？',
    bad: /定轴|高光|工艺/,
    // 额外检查：如出现含水量数字要能站得住（这里只做人工看）
  },
  {
    name: 'F 普通护理问题（应正常回答）',
    q: '客户问：这个日常怎么护理呀？',
    bad: /定轴|散光|工艺/,
  },
];

function ask(q) {
  return new Promise(resolve => {
    const payload = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            '【客服遇到的问题】\n' + q +
            '\n\n【可参考的内部资料】无匹配资料。\n\n请严格按照系统要求的格式输出。',
        },
      ],
      temperature: 0.4,
      max_tokens: 1500,
      thinking: { type: 'disabled' },
    });
    const t0 = Date.now();
    const req = https.request(
      {
        host: 'ark.cn-beijing.volces.com',
        path: '/api/v3/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + KEY,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      res => {
        let d = '';
        res.on('data', c => (d += c));
        res.on('end', () => {
          const sec = ((Date.now() - t0) / 1000).toFixed(1);
          if (res.statusCode !== 200) return resolve({ sec, text: '❌ ' + d.slice(0, 200) });
          const j = JSON.parse(d);
          resolve({ sec, text: j.choices?.[0]?.message?.content || '' });
        });
      }
    );
    req.on('error', e => resolve({ text: 'ERR ' + e.message }));
    req.write(payload);
    req.end();
  });
}

function directSection(text) {
  const m = text.match(/【可直接发送】\s*([\s\S]*?)(?=【要点提示】|【专业参数】|$)/);
  return m ? m[1] : text;
}

(async () => {
  if (!KEY || !MODEL) { console.log('缺少 ARK_KEY / ARK_MODEL'); process.exit(1); }
  let allPass = true;
  for (const c of CASES) {
    const r = await ask(c.q);
    const direct = directSection(r.text);
    const hit = direct.match(c.bad);
    if (hit) allPass = false;
    console.log('════════════════════════════════');
    console.log(c.name);
    console.log('问：' + c.q);
    console.log('耗时 ' + r.sec + 's | ' +
      (hit ? '❌ 发送话术出现禁词「' + hit[0] + '」' : '✅ 未出现禁词'));
    console.log('答：\n' + r.text);
    console.log('');
  }
  console.log(allPass ? 'ALL_PASS ✅ 六题全部通过' : 'HAS_VIOLATION ❌ 有禁词泄漏');
})();
