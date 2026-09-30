/* 独立校验题库答案（从 Supabase 原始数据反推真值，不复用生成脚本逻辑）
 * 用法：node outputs/verify-miyang-quiz.js
 */
const fs = require('fs');
const ROOT = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const all = JSON.parse(fs.readFileSync(ROOT + '/outputs/miyang-patterns.json', 'utf8'));
const my = all.filter(p => p.brand === '弥生');
const clean = my.filter(p => (p.series || '').trim() && p.price_tier && !p.is_discontinued);
const quiz = JSON.parse(fs.readFileSync(ROOT + '/outputs/miyang-quiz.json', 'utf8'));
const recs = name => clean.filter(p => p.name === name);

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; } else { fail++; console.log('FAIL ' + name + (extra ? ' | ' + extra : '')); }
};

quiz.questions.forEach(q => {
  const label = 'Q' + q.no + ' [' + q.type + '/' + (q.tag || '') + '] ' + q.stem.slice(0, 28);
  if (q.type === 'single') {
    // 单选：正确答案必须唯一可从数据推出
    if (q.tag === 'series-tier') {
      const s = q.stem.match(/「(.+?)」/)[1];
      const trueTier = [...new Set(clean.filter(p => p.series === s).map(p => p.price_tier))];
      const chosen = q.options[q.answer];
      const nCorrect = q.options.filter(o => trueTier.includes(o)).length;
      check(label, trueTier.length === 1 && nCorrect === 1 && chosen === trueTier[0],
        '真档=' + trueTier.join(',') + ' 选项命中=' + nCorrect + ' 标答=' + chosen);
    } else if (q.tag === 'name-series') {
      const n = q.stem.match(/「(.+?)」/)[1];
      const trueSeries = [...new Set(recs(n).map(p => p.series))];
      check(label, trueSeries.length === 1 && q.options[q.answer] === trueSeries[0],
        '真系列=' + trueSeries.join(',') + ' 标答=' + q.options[q.answer]);
    } else if (q.tag === 'tier-name') {
      const t = q.stem.match(/「(.+?)」/)[1];
      const nCorrect = q.options.filter(o => recs(o).some(p => p.price_tier === t)).length;
      check(label, nCorrect === 1 && recs(q.options[q.answer]).some(p => p.price_tier === t),
        '选项命中=' + nCorrect);
    } else if (q.tag === 'trap') {
      // 辨析题：标答里提到的两个价格档必须与数据一致
      const chosen = q.options[q.answer];
      const tiers = [...new Set(clean.map(p => p.price_tier))];
      const mentioned = tiers.filter(t => chosen.includes(t));
      check(label, mentioned.length >= 2 && !/完全一样|都一样|可以按同一个价格档/.test(chosen), '提到档=' + mentioned.join(','));
    } else if (q.tag === 'unit') {
      check(label, q.options[q.answer] === '日抛按「盒」、半年抛按「副」', '标答=' + q.options[q.answer]);
    } else if (q.tag === 'special-tier') {
      const s = q.stem.match(/「(.+?)」/)[1];
      const trueTier = [...new Set(clean.filter(p => p.series === s).map(p => p.price_tier))];
      check(label, trueTier.length === 1 && q.options[q.answer] === trueTier[0], '真档=' + trueTier.join(','));
    } else {
      check(label, typeof q.answer === 'number' && q.answer >= 0 && q.answer < q.options.length, '答案下标越界');
    }
  } else if (q.type === 'multi') {
    if (q.tag === 'multi-series') {
      const s = q.stem.match(/「(.+?)」/)[1];
      const trueNames = clean.filter(p => p.series === s).map(p => p.name);
      const nCorrect = q.options.filter(o => trueNames.includes(o)).length;
      const marked = q.answer.map(i => q.options[i]).every(o => trueNames.includes(o));
      check(label, nCorrect === q.answer.length && marked && nCorrect >= 1,
        '真属于该系列=' + nCorrect + ' 标答数=' + q.answer.length);
    } else if (q.tag === 'unit') {
      const marked = q.answer.map(i => q.options[i]);
      const trueDaySeries = [...new Set(clean.filter(p => p.type === '日抛').map(p => p.series))];
      // 标答必须是「日抛系列」，且不能把半年抛系列标进去
      const ok = marked.every(o => trueDaySeries.includes(o.replace(/-日抛$/, '-日抛'))) &&
        !marked.some(o => clean.some(p => p.series === o && p.type === '半年抛'));
      check(label, ok, '标答=' + marked.join('+') + ' 真日抛系列=' + trueDaySeries.join(','));
    } else if (q.tag === 'special') {
      const marked = q.answer.map(i => q.options[i]);
      const okUnit = marked.some(o => /69 元\/副/.test(o)) && marked.some(o => /49\.9 元\/盒/.test(o)) &&
        marked.some(o => /禁止按普通款备注/.test(o)) && !marked.some(o => /可以和普通/.test(o));
      check(label, okUnit, '标答=' + marked.join(' + '));
    } else if (q.tag === 'same-series') {
      const marked = q.answer.map(i => q.options[i]);
      const realTiers = [...new Set(clean.filter(p => p.series === '人鱼系列日抛').map(p => p.price_tier))];
      check(label, marked.length === 2 && marked.every(o => realTiers.includes(o)),
        '标答=' + marked.join('+') + ' 人鱼真档=' + realTiers.join(','));
    }
  } else if (q.type === 'judge') {
    // 判断题：与数据交叉核对（仅核对含具体价格的表述）
    let ok = true, why = '';
    const s = q.stem, isTrue = q.answer === 0;
    if (/都按 39\.9/.test(s)) { ok = !isTrue; why = '少女漫半年抛是 59.9，说法错误'; }
    if (/日抛按「盒」计价，半年抛按「副」计价/.test(s)) { ok = isTrue; }
    if (/初音半年抛 69/.test(s) && /可以按普通半年抛 49\.9/.test(s)) { ok = !isTrue; why = '初音禁止按普通款备注'; }
    if (/「女高系列」都是半年抛，价格档是 29\.9/.test(s)) {
      const t = [...new Set(clean.filter(p => p.series === '女高系列').map(p => p.price_tier))];
      ok = isTrue && t.length === 1 && t[0] === '半年抛-29.9元/副';
    }
    if (/随便花系列.*49\.9/.test(s) && /花厨小熊系列.*49\.9/.test(s)) {
      const a = [...new Set(clean.filter(p => p.series === '随便花系列').map(p => p.price_tier))];
      const b = [...new Set(clean.filter(p => p.series === '花厨小熊系列').map(p => p.price_tier))];
      ok = isTrue && a.length === 1 && a[0] === '半年抛-49.9元/副' && b.length === 1;
      if (b[0] !== '半年抛-49.9元/副') { ok = false; why = '花厨小熊系列价格档=' + b.join(','); }
    }
    if (/写错一点没关系/.test(s)) { ok = !isTrue; }
    check(label, ok, why);
  } else if (q.type === 'match') {
    const pairs = q.pairs || [];
    const allOk = pairs.length >= 3 && pairs.every(p => recs(p.left).some(r => r.price_tier === p.right));
    const dist = new Set(pairs.map(p => p.right)).size === pairs.length;
    check(label, allOk && dist, '配对正确性=' + allOk + ' 右侧不重复=' + dist);
  } else if (q.type === 'text') {
    check(label, !!q.answer && q.answer.length > 15, '答案过短');
  }
});

// 分值、题量
const total = quiz.questions.reduce((n, q) => n + q.points, 0);
check('题量在 30~40 之间', quiz.questions.length >= 30 && quiz.questions.length <= 40, 'n=' + quiz.questions.length);
check('满分 100', total === 100, 'total=' + total);
check('每题都有解析/答案', quiz.questions.every(q => q.type === 'text' ? q.answer : (q.explain || q.answer !== undefined)));

console.log('=== 校验结果：pass=' + pass + ' fail=' + fail + ' | 题量=' + quiz.questions.length + ' 满分=' + total + ' ===');
process.exit(fail ? 1 : 0);
