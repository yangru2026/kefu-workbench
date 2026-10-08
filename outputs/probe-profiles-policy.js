/* 查 profiles 的 RLS 策略与函数定义（anon key 只读探测，走 REST 能拿到的部分）
 * 目的：定位"工作台改组别/改角色 0 行"的库侧原因到底是哪条策略缺失
 */
const https = require('https');
const fs = require('fs');

// 从线上页面里提取 publishable key（避免 key 出现在对话/日志）
const SRC = 'C:/temp/kefu_src/index.html';
const html = fs.readFileSync(SRC, 'utf8');
const m = html.match(/SUPABASE_KEY\s*=\s*'([^']+)'/);
if (!m) { console.log('NO_KEY_FOUND'); process.exit(1); }
const KEY = m[1];
const HOST = 'ienmejlxukhrxjjxvfqf.supabase.co';

function req(path, method, body) {
  return new Promise(resolve => {
    const r = https.request({
      host: HOST, path, method: method || 'GET',
      headers: {
        apikey: KEY, Authorization: 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        ...(method === 'PATCH' ? { Prefer: 'return=representation' } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d.slice(0, 600) }));
    });
    r.on('error', e => resolve({ status: 0, body: 'ERR:' + e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  console.log('== anon 直接 PATCH profiles（不登录）==');
  const r1 = await req('/rest/v1/profiles?id=eq.00000000-0000-0000-0000-000000000000',
    'PATCH', { group_name: 'X' });
  console.log('PATCH unknown id ->', r1.status, r1.body.slice(0, 200));

  console.log('\n== anon 读 profiles 的列（确认 group_name/status/left_at 存在）==');
  const r2 = await req('/rest/v1/profiles?select=id,name,role,group_name,status,left_at&limit=2');
  console.log(r2.status, r2.body.slice(0, 400));

  console.log('\n== rpc: is_admin（匿名应为 false 或 401）==');
  const r3 = await req('/rest/v1/rpc/is_admin', 'POST', {});
  console.log(r3.status, r3.body.slice(0, 200));

  console.log('\n== rpc: is_full_admin ==');
  const r4 = await req('/rest/v1/rpc/is_full_admin', 'POST', {});
  console.log(r4.status, r4.body.slice(0, 200));
})();
