/* 把前端所有页面的 SUPABASE_URL / KEY 切到新项目；升 iframe 版本号
   用法：SBP_TOKEN=xxx [NEW_REF=...] node mig-switch-frontend.js [--apply]
   不带 --apply 只打印将要改什么。
*/
const fs = require('fs');
const path = require('path');
const PAT = process.env.SBP_TOKEN;
const OLD = 'ienmejlxukhrxjjxvfqf';
const NEW = process.env.NEW_REF || '';
const APPLY = process.argv.includes('--apply');
const REPO = 'C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05';
const SRCPY = 'C:/temp/kefu_src/index.html';
const VER = process.env.VER || '20261020b';

const FILES = ['index.html', 'diversion.html', 'gift.html', 'qc-v2.html', 'rules.html', 'quiz.html',
  'checklist.html', 'cs-qc.html', 'qc.html', 'quiz-results.html', 'qc-share.html', 'diagnose.html'];

async function getKeys(ref) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, { headers: { Authorization: 'Bearer ' + PAT } });
  const arr = await r.json();
  const pub = arr.find(k => k.type === 'publishable');
  const leg = arr.find(k => k.name === 'anon' || (k.type === 'legacy' && /anon/.test(k.name || '')));
  const svc = arr.find(k => k.name === 'service_role' || (k.type === 'legacy' && /service_role/.test(k.name || '')));
  const sec = arr.find(k => k.type === 'secret');
  return {
    publishable: pub && (pub.api_key || pub.key),
    legacyAnon: leg && (leg.api_key || leg.key),
    serviceRole: svc && (svc.api_key || svc.key),
    secret: sec && (sec.api_key || sec.key),
  };
}

(async () => {
  if (!NEW) { console.error('缺 NEW_REF'); process.exit(1); }
  const k = await getKeys(NEW);
  console.log('新项目', NEW, '| publishable:', k.publishable ? k.publishable.slice(0, 16) + '…' : '缺失',
    '| legacy anon:', k.legacyAnon ? '有' : '缺失');
  if (!k.publishable || !k.legacyAnon) process.exit(1);

  const bakDir = path.join(REPO, 'outputs/mig/backup');
  if (APPLY && !fs.existsSync(bakDir)) fs.mkdirSync(bakDir, { recursive: true });

  let changed = 0;
  for (const f of FILES) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) { console.log('跳过(不存在)', f); continue; }
    let s = fs.readFileSync(p, 'utf8');
    const before = s;
    const urlHits = (s.match(new RegExp(OLD, 'g')) || []).length;

    s = s.split(OLD).join(NEW);
    // key：按变量名替换，不依赖旧值
    s = s.replace(/(const\s+(?:SUPABASE_KEY|SUPA_KEY)\s*=\s*')eyJ[^']*'/g, `$1${f === 'index.html' ? k.publishable : k.legacyAnon}'`);
    s = s.replace(/(const\s+SUPABASE_KEY\s*=\s*')sb_publishable_[^']*'/g, `$1${k.publishable}'`);

    if (f === 'index.html') {
      s = s.replace(/(data-src="[^"]*?\?v=)[^"]*"/g, `$1${VER}"`);
    }

    if (s !== before) {
      changed++;
      console.log(`${f}: 替换 ref ${urlHits} 处${f === 'index.html' ? ' + 版本号→' + VER : ''}`);
      if (APPLY) {
        fs.writeFileSync(path.join(bakDir, f + '.bak'), before, 'utf8');
        fs.writeFileSync(p, s, 'utf8');
      }
    } else console.log(`${f}: 无变化`);
  }

  if (APPLY) {
    fs.copyFileSync(path.join(REPO, 'index.html'), SRCPY);
    fs.writeFileSync(path.join(REPO, 'outputs/mig/new-keys.json'),
      JSON.stringify({ ref: NEW, publishable: k.publishable, legacyAnon: k.legacyAnon, serviceRole: k.serviceRole, secret: k.secret }, null, 2));
    console.log('\n✅ 已改', changed, '个文件；index.html 已同步到 C:/temp/kefu_src；key 存 outputs/mig/new-keys.json');
  } else {
    console.log('\n（预演，未写入）');
  }
})();
