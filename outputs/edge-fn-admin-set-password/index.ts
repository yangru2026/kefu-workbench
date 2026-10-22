// 管理员重置客服登录密码
// 调用方：工作台「客服信息」编辑弹窗（supabase.functions.invoke，自动带用户 JWT）
// 安全校验：1) 网关 verify_jwt 校验登录态 2) 函数内再用 service role 核对调用者 role==='admin'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: '仅支持 POST' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: '登录状态已失效，请重新登录' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1) 验调用者身份
    const { data: userData, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !userData?.user) return json({ error: '登录状态已失效，请重新登录' }, 401);
    const callerId = userData.user.id;

    const { data: prof, error: pErr } = await admin
      .from('profiles').select('role').eq('id', callerId).maybeSingle();
    if (pErr || !prof || prof.role !== 'admin') {
      return json({ error: '仅管理员可重置密码' }, 403);
    }

    // 2) 参数
    const body = await req.json().catch(() => null);
    const userId = body?.user_id;
    const password = typeof body?.password === 'string' ? body.password.trim() : '';
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: '参数 user_id 不正确' }, 400);
    if (password.length < 6) return json({ error: '新密码至少 6 位' }, 400);

    // 3) 重置密码（顺带确认邮箱，避免再卡"未验证"）
    const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (upErr) return json({ error: '重置失败：' + upErr.message }, 400);

    return json({ ok: true });
  } catch (e) {
    console.error('admin-set-password error:', e);
    return json({ error: '服务器异常：' + String((e as Error)?.message || e) }, 500);
  }
});
