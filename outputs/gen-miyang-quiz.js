/* 弥生花色/价格 考核试卷 题库生成（数据来自 Supabase pattern_assets 真实值）
 * 用法：node outputs/gen-miyang-quiz.js
 * 输出：outputs/miyang-quiz.json
 * 说明：自动题（单选/多选/配对）从真实数据推导，保证答案与工作台一致；
 *       判断题/纠错题以真实价格结构手写（陷阱点：同名系列不同抛型、计价单位、初音特殊品、同系列双档）。
 */
const fs = require('fs');
const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const all = JSON.parse(fs.readFileSync(ROOT + '/outputs/miyang-patterns.json', 'utf8'));
const my = all.filter(p => p.brand === '弥生');

const T = '半年抛';        // 半年抛
const D = '日抛';
const S = (p) => (p.series || '').trim();
const tierOf = (p) => p.price_tier || '';
const has = (arr, v) => arr.indexOf(v) >= 0;

function pick(list, n, seed) {   // 稳定抽样（不用随机，按输入顺序取，保证可复现）
  return list.slice(0, n);
}
function shuffleStable(arr, seedStr) {  // 稳定打乱（按名字 hash），保证每次生成一致且选项不总在同一位置
  const h = s => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) % 100000; return x; };
  return arr.slice().sort((a, b) => h(seedStr + a) - h(seedStr + b));
}

/* ===== 用于出题的干净样本（系列字段与价格档都完整、非下架） ===== */
const clean = my.filter(p => S(p) && tierOf(p) && !p.is_discontinued);
const bySeries = {};
clean.forEach(p => { (bySeries[S(p)] = bySeries[S(p)] || []).push(p); });

/* 系列 → 唯一价格档（系列内只有一个价格档，适合出「系列→价格档」） */
const seriesTier = {};
Object.entries(bySeries).forEach(([s, list]) => {
  const ts = [...new Set(list.map(tierOf))];
  if (ts.length === 1) seriesTier[s] = ts[0];
});

const Q = [];
const push = (q) => { q.no = Q.length + 1; Q.push(q); };

/* ---------- 一、单选题（12） ---------- */
const seriesForA = ['女高系列', '随便花系列', '少女漫半年抛', '初音'].filter(s => seriesTier[s]);
seriesForA.forEach(s => {
  const right = seriesTier[s];
  const others = Object.entries(seriesTier).filter(([k, v]) => v !== right && k !== s).map(([k, v]) => v);
  const uniq = [...new Set(others)];
  const wrongs = pick(uniq, 3);
  const opts = shuffleStable([right, ...wrongs], s);
  push({
    type: 'single', section: '一、单选题',
    stem: '「' + s + '」这个系列，卖货时应该按哪个价格档核对？',
    options: opts, answer: opts.indexOf(right),
    explain: s + ' 全系列都是「' + right + '」。',
    tag: 'series-tier'
  });
});

/* 花色 → 系列（4 题） */
const nameToSeriesSrc = [
  ['女高系列', '随便花系列'], ['随便花系列', '女高系列'],
  ['少女漫半年抛', '女高系列'], ['花厨小熊系列', '随便花系列']
];
nameToSeriesSrc.forEach(([s, wrongSrc], i) => {
  const p = bySeries[s] && bySeries[s][0];
  if (!p) return;
  const wrongPool = [...new Set(Object.keys(bySeries))].filter(k => k !== s && k !== wrongSrc);
  const wrongs = shuffleStable(wrongPool, p.name).slice(0, 2).concat([wrongSrc]);
  const opts = shuffleStable([s, ...wrongs], p.name);
  push({
    type: 'single', section: '一、单选题',
    stem: '花色「' + p.name + '」属于哪个系列？',
    options: opts, answer: opts.indexOf(s),
    explain: p.name + ' 属于「' + s + '」（' + (p.type || '') + '，' + tierOf(p) + '）。',
    tag: 'name-series'
  });
});

/* 价格档 → 属于它的花色（4 题，主攻易错档） */
const tierForQ = ['半年抛-29.9元/副', '半年抛-49.9元/副', '半年抛-59.9元/副', '少女漫日抛-39.9/盒'];
tierForQ.forEach(t => {
  const inTier = clean.filter(p => tierOf(p) === t);
  if (!inTier.length) return;
  const right = inTier[0].name;
  const wrongPool = clean.filter(p => tierOf(p) !== t && tierOf(p) !== '') ;
  const wrongs = shuffleStable(wrongPool.map(p => p.name), t).slice(0, 3);
  const opts = shuffleStable([right, ...wrongs], t);
  push({
    type: 'single', section: '一、单选题',
    stem: '下面哪一款花色的价格档是「' + t + '」？',
    options: opts, answer: opts.indexOf(right),
    explain: right + ' 属「' + t + '」；其余三款分别是：' +
      opts.filter(o => o !== right).map(o => { const q = clean.find(x => x.name === o); return o + '（' + (q ? tierOf(q) : '?') + '）'; }).join('、') + '。',
    tag: 'tier-name'
  });
});

/* 补充单选（4 题）：同名款辨析 + 计价单位 + 易错档（杨茹最怕的错单类型） */
(() => {
  const findByName = n => clean.find(p => p.name === n) || {};
  const pro = clean.find(p => p.name.indexOf('在逃公主pro') >= 0 && p.type === T) || {};
  const pro6 = clean.find(p => p.name.indexOf('在逃公主pro') >= 0 && p.type === D) || {};
  if (pro.name && pro6.name) {
    const right1 = '「' + pro.name + '」是' + pro.type + '（' + tierOf(pro) + '），「' + pro6.name + '」是' + pro6.type + '（' + tierOf(pro6) + '）';
    const opts = shuffleStable([
      right1,
      '两款完全一样，可以按同一个价格档备注',
      '两款都是半年抛，价格档都是 59.9 元/副',
      '「' + pro.name + '」按盒计价，「' + pro6.name + '」按副计价'
    ], 'pro');
    push({
      type: 'single', section: '一、单选题',
      stem: '「' + pro.name + '」和「' + pro6.name + '」的区别是什么？',
      options: opts, answer: opts.indexOf(right1),
      explain: pro.name + '＝' + pro.type + '（' + tierOf(pro) + '）；' + pro6.name + '＝' + pro6.type + '（' + tierOf(pro6) + '），同名不同规格，价格与单位都不同，最易发错。',
      tag: 'trap'
    });
  }
  const rightUnit = '日抛按「盒」、半年抛按「副」';
  const unitOpts = shuffleStable([rightUnit, '日抛按「副」、半年抛按「盒」', '都按「副」', '都按「盒」'], 'unit2');
  push({
    type: 'single', section: '一、单选题',
    stem: '弥生花色的计价单位是怎么规定的？',
    options: unitOpts, answer: unitOpts.indexOf(rightUnit),
    explain: '日抛按「盒」，半年抛按「副」——单位写错会导致价格口径错误。',
    tag: 'unit'
  });
  const smHalf = clean.find(p => S(p) === '少女漫');
  const smDay = clean.find(p => S(p) === '少女漫-日抛');
  if (smHalf && smDay) {
    const right2 = '「少女漫」是' + smHalf.type + '（' + tierOf(smHalf) + '），「少女漫-日抛」是' + smDay.type + '（' + tierOf(smDay) + '）';
    const opts = shuffleStable([
      right2,
      '两个系列价格一样，都是 39.9',
      '两个系列都是日抛，单位都是「盒」',
      '「少女漫」更便宜，因为不带「-日抛」后缀'
    ], 'sm');
    push({
      type: 'single', section: '一、单选题',
      stem: '「少女漫」和「少女漫-日抛」的区别是什么？',
      options: opts, answer: opts.indexOf(right2),
      explain: smHalf.type + '「少女漫」＝' + tierOf(smHalf) + '；' + smDay.type + '「少女漫-日抛」＝' + tierOf(smDay) + '。同名系列不同抛型，价格与单位都不同。',
      tag: 'trap'
    });
  }
  const cyDay = clean.find(p => S(p) === '初音-日抛');
  if (cyDay) {
    const right = tierOf(cyDay);
    const wrongs = shuffleStable([...new Set([...clean.map(tierOf)])].filter(v => v !== right), 'cyd').slice(0, 3);
    const opts = shuffleStable([right, ...wrongs], 'cyd2');
    push({
      type: 'single', section: '一、单选题',
      stem: '「初音-日抛」系列按什么价格档核对？',
      options: opts, answer: opts.indexOf(right),
      explain: '初音日抛 ' + right + '，属高价特殊品，禁止按普通日抛（39.9 / 44.9）备注。',
      tag: 'special-tier'
    });
  }
})();

/* ---------- 二、多选题（6） ---------- */
const multiSeries = ['女高系列', '随便花系列', '少女漫半年抛'];
multiSeries.forEach(s => {
  const list = bySeries[s] || [];
  if (list.length < 4) return;
  const right = list.slice(0, 2).map(p => p.name);
  const wrongPool = clean.filter(p => S(p) !== s).map(p => p.name);
  const wrongs = shuffleStable(wrongPool, s).slice(0, 2);
  const opts = shuffleStable([...right, ...wrongs], 'M' + s);
  push({
    type: 'multi', section: '二、多选题',
    stem: '以下哪些花色属于「' + s + '」？（多选）',
    options: opts, answer: opts.map((o, i) => right.includes(o) ? i : -1).filter(i => i >= 0),
    explain: s + ' 的正确花色：' + right.join('、') + '；另外两个属于其他系列。',
    tag: 'multi-series'
  });
});
/* 日抛各系列只按盒计价（考「日抛系列有哪几个」） */
const daySeries = Object.keys(bySeries).filter(s => (bySeries[s] || []).every(p => p.type === D));
push({
  type: 'multi', section: '二、多选题',
  stem: '下面哪些系列是「日抛」系列（按「盒」计价）？（多选）',
  options: shuffleStable(['少女漫-日抛', '花厨小熊-日抛', '初音-日抛', '女高系列', '随便花系列'], 'day'),
  answer: null, explain: '日抛系列：少女漫-日抛、花厨小熊-日抛、初音-日抛、人鱼系列日抛（均按「盒」计价）；女高系列、随便花系列是半年抛（按「副」计价）。', tag: 'unit'
});
Q[Q.length - 1].answer = Q[Q.length - 1].options.map((o, i) => o.endsWith('-日抛') || o === '人鱼系列日抛' ? i : -1).filter(i => i >= 0);
/* 初音相关（特殊品） */
push({
  type: 'multi', section: '二、多选题',
  stem: '关于「初音」系列，下面说法哪些是对的？（多选）',
  options: shuffleStable([
    '初音半年抛按 69 元/副',
    '初音日抛按 49.9 元/盒',
    '初音属于高价特殊品，禁止按普通款备注',
    '初音可以和普通半年抛一样按 49.9 元/副备注',
    '初音日抛按 39.9 元/盒'
  ], 'chuyin'),
  answer: null,
  explain: '初音日抛 49.9 元/盒、半年抛 69 元/副，属高价特殊品，禁止按普通款备注；普通半年抛是 29.9 / 49.9 / 59.9 元/副，日抛 39.9 / 44.9 元/盒，都与初音不同价。',
  tag: 'special'
});
Q[Q.length - 1].answer = Q[Q.length - 1].options.map((o, i) => /禁止按普通款备注|69 元\/副|49\.9 元\/盒/.test(o) && !/可以和普通/.test(o) ? i : -1).filter(i => i >= 0);
push({
  type: 'multi', section: '二、多选题',
  stem: '「人鱼系列日抛」里同时出现过下面哪些价格档？（多选，注意同系列也可能不同价）',
  options: shuffleStable(['人鱼超薄日抛-44.9/盒', '少女漫日抛-39.9/盒', '半年抛-49.9元/副', '初音日抛-49.9/盒'], 'renyu'),
  answer: null,
  explain: '人鱼系列日抛大多数是「人鱼超薄日抛-44.9/盒」，另有几款「D…6片装」是「少女漫日抛-39.9/盒」——同一个系列两个档，最容易发错，必须逐款核对。',
  tag: 'same-series'
});
Q[Q.length - 1].answer = Q[Q.length - 1].options.map((o, i) => /44\.9|39\.9/.test(o) ? i : -1).filter(i => i >= 0);

/* ---------- 三、判断题（6，手写陷阱） ---------- */
const tf = [
  ['「少女漫」半年抛和日抛价格一样，都可以按 39.9 元备注。', false,
    '❌ 少女漫半年抛是 59.9 元/副，日抛才是 39.9 元/盒。同名系列不同抛型价格不同，且单位不同（副 / 盒）。'],
  ['日抛按「盒」计价，半年抛按「副」计价，写备注前先确认单位。', true,
    '✅ 日抛=盒、半年抛=副。单位写错会造成价格口径错误。'],
  ['初音半年抛 69 元/副，但为了成单可以按普通半年抛 49.9 元/副备注。', false,
    '❌ 初音属高价特殊品，禁止按普通款备注，也不能自行降价凑单。'],
  ['「女高系列」都是半年抛，价格档是 29.9 元/副。', true,
    '✅ 女高系列（含「女高」）均为半年抛、29.9 元/副。'],
  ['「随便花系列」和「花厨小熊系列」都是 49.9 元/副的半年抛。', true,
    '✅ 两个系列都是半年抛-49.9元/副（happy系列 也是 49.9）。'],
  ['只要系列对得上，价格档写错一点没关系，反正客服会改。', false,
    '❌ 价格档写错=报价错，直接导致亏单或客诉，必须先核对价格档再发备注。']
];
tf.forEach(([stem, ans, exp]) => push({
  type: 'judge', section: '三、判断题',
  stem: stem, options: ['✔ 正确', '✘ 错误'], answer: ans ? 0 : 1, explain: exp, tag: 'judge'
}));

/* ---------- 四、配对题（5，花色 ↔ 价格档） ---------- */
const pairPicks = ['半年抛-29.9元/副', '半年抛-49.9元/副', '半年抛-59.9元/副', '少女漫日抛-39.9/盒', '初音半年抛-69元/副'];
const pairs = [];
pairPicks.forEach(t => {
  const p = clean.find(x => tierOf(x) === t && S(x));
  if (p) pairs.push({ left: p.name, right: tierOf(p) });
});
push({
  type: 'match', section: '四、配对题',
  stem: '把左边花色和右边正确的价格档连起来（把正确答案的字母填在括号里）。',
  pairs: pairs,
  rightOptions: shuffleStable(pairs.map(p => p.right), 'pair'),
  explain: pairs.map(p => p.left + ' → ' + p.right).join('；'),
  tag: 'match'
});

/* ---------- 五、纠错题（5，手写场景） ---------- */
const fixes = [
  {
    stem: '订单金额：59.9 元 / 1 副　　备注写的是：少女漫半年抛 · 39.9/盒　　请指出错在哪、正确应怎么写。',
    answer: '价格与单位都错：59.9 元是半年抛的「副」价，39.9 是「少女漫日抛」的盒价。正确备注：少女漫半年抛 · 半年抛-59.9元/副（按副）。',
    points: 4
  },
  {
    stem: '订单金额：99.8 元 / 2 副　　备注写的是：初音半年抛 · 按普通半年抛 49.9 备注（2 副）　　请指出错在哪、正确应怎么写。',
    answer: '错在把高价特殊品按普通款备注。初音半年抛是 69 元/副（2 副 138 元；99.8 元是普通半年抛 49.9×2）。正确备注：初音半年抛-69元/副，且必须核对初音联名机制。',
    points: 4
  },
  {
    stem: '订单金额：44.9 元 / 1 盒　　备注写的是：人鱼系列日抛 · 39.9/盒　　请指出该不该这样写。',
    answer: '不一定对：人鱼系列日抛里「D…6片装」等款才是 39.9/盒，超薄款（如 摆烂海星、微醺海浪、企鹅妮妮）是 44.9/盒。44.9 元的订单应对应「人鱼超薄日抛-44.9/盒」，必须逐款核对。',
    points: 4
  },
  {
    stem: '订单金额：49.9 元 / 1 副　　备注写的是：女焉系列 …（系统里查不到）　　新客服说「女高系列写错了，帮我改一下」。请写出正确的系列名与价格档写法。',
    answer: '弥生没有「女焉系列」，近似的是「女高系列」（半年抛-29.9元/副）与「少女漫半年抛」（59.9 元/副）。49.9 元/副对应的是「随便花系列 / 花厨小熊系列 / happy系列」，要先确认花色再写系列。',
    points: 4
  },
  {
    stem: '订单金额：39.9 元 / 1 盒　　备注写的是：花厨小熊系列 · 半年抛　　请指出错在哪、正确应怎么写。',
    answer: '系列与抛型都写错：39.9 元/盒是日抛，对应「花厨小熊-日抛」（少女漫日抛-39.9/盒）；「花厨小熊系列」是半年抛（49.9 元/副）。正确备注：花厨小熊-日抛 · 少女漫日抛-39.9/盒。',
    points: 4
  }
];
fixes.forEach(f => push({
  type: 'text', section: '五、纠错题',
  stem: f.stem, answer: f.answer, points: f.points, explain: f.answer, tag: 'fix'
}));

/* ---------- 六、简答题（1） ---------- */
push({
  type: 'text', section: '六、简答题',
  stem: '写出你在核对「花色备注」时的 3 个防错动作（至少 3 条）。',
  answer: '参考答案：① 先看订单金额，反推价格档，再挑花色（不要先挑花色再凑价格）；② 确认抛型：日抛按盒、半年抛按副，单位不能写错；③ 识别高价特殊品（初音 / 少女漫定轴）禁止按普通款备注；④ 同名系列要分抛型（少女漫日抛 39.9/盒 ≠ 少女漫半年抛 59.9 元/副）；⑤ 同系列可能有两个档（人鱼系列日抛 44.9 与 39.9），必须逐款核对；⑥ 拿不准就查「弥生价」页按系列/价格档确认。',
  explain: '', points: 8
});

/* 分值：单选2分、多选3分、判断2分、配对10分、纠错各4分、简答6分 */
const pointsOf = q => q.points || ({ single: 2, multi: 3, judge: 2, match: 10, text: 4 }[q.type] || 2);
Q.forEach(q => { q.points = pointsOf(q); });

const total = Q.reduce((n, q) => n + q.points, 0);
const out = {
  meta: {
    title: '弥生 · 花色与价格 考核试卷',
    subtitle: '考核重点：系列 ↔ 花色 ↔ 价格档 对应关系，避免低档订单备注高价花色',
    generatedAt: new Date().toISOString().slice(0, 10),
    counts: Q.length, total: total,
    dataNote: '题目与答案全部来自工作台「弥生价 / 花色素材」真实数据（' + clean.length + ' 款系列价格齐全的弥生花色）',
    timeLimit: '建议 25 分钟，满分 ' + total + ' 分，80 分合格'
  },
  questions: Q
};
fs.writeFileSync(ROOT + '/outputs/miyang-quiz.json', JSON.stringify(out, null, 1), 'utf8');
console.log('题数=' + Q.length + ' 满分=' + total);
const sec = {};
Q.forEach(q => sec[q.section] = (sec[q.section] || 0) + 1);
Object.entries(sec).forEach(([k, v]) => console.log('  ' + k + ' ' + v + ' 题'));
console.log('--- 校验自动题答案 ---');
Q.filter(q => q.type !== 'text').forEach(q => {
  if (q.type === 'match') { console.log('配对：' + q.pairs.map(p => p.left + '→' + p.right).join(' | ')); return; }
  const ans = Array.isArray(q.answer) ? q.answer.map(i => q.options[i]).join(' + ') : q.options[q.answer];
  console.log('Q' + q.no + ' [' + q.type + '] 答：' + ans);
});
