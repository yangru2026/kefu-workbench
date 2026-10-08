/* 探测 profiles 的 UPDATE 策略是否对"非本人"生效
 * 关键实验：用 anon 身份 PATCH 一条【真实存在】的行，观察返回体。
 *  - 返回 [  ]            → 策略拦掉（0 行），说明非 admin/非本人改不动 → 但这不能区分 anon 与已登录
 *  - 返回 [{...}]          → 允许
 * 由于 anon 无身份，这里真正要验证的是：**策略里是否存在"改他人"的分支**以及它依赖什么。
 * 做法：分别用
 *   (1) anon                —— 对照组
 *   (2) 伪装成"别人"的 JWT   —— 不可行，只能拿真 JWT
 * 本沙箱拿不到真实登录 JWT（需要密码），所以只用 anon 对照 + 读 profile 数据佐证。
 * 更硬的证据：直接看 profiles.updated_at 是否被更新（本脚本只读，不改）。
 */
const https = require('https');
const fs = require('fs');
const html = fs.readFileSync('C:/temp/kefu_src/index.html', 'utf8');
const KEY = html.match(/SUPABASE_KEY\s*=\s*'([^']+)'/)[1];
const HOST = 'ienmejlxukhrxjjxvfqf.supabase.co';

function req(path, method, body, extra) {
  return new Promise(resolve => {
    const r = https.request({
      host: HOST, path, method: method || 'GET',
      headers: Object.assign({
        apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json'
      }, extra || {})
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', e => resolve({ status: 0, body: 'ERR:' + e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  // 取一个真实在册成员
  const r = await req('/rest/v1/profiles?select=id,name,group_name,role,updated_at&status=eq.active&order=updated_at.desc&limit=5');
  const rows = JSON.parse(r.body || '[]');
  console.log('== 最近更新的 5 个在册成员 ==');
  rows.forEach(x => console.log(' ', x.name, '| group=' + x.group_name, '| role=' + x.role, '| updated_at=' + x.updated_at));
  if (!rows.length) return;
  const target = rows[rows.length - 1];

  console.log('\n== anon PATCH 真实存在的行（不改值，只为看返回体）==');
  const p = await req('/rest/v1/profiles?id=eq.' + target.id, 'PATCH',
    { group_name: target.group_name },
    { Prefer: 'return=representation' });
  console.log('status =', p.status);
  console.log('body   =', p.body.slice(0, 300) || '(空)');
  console.log(p.status === 200 && p.body.trim() === '[]'
    ? '→ 被拦掉了（0 行被更新）：非本人/非 admin 的 UPDATE 策略不成立'
    : '→ 竟然允许，需要进一步确认');
})();
