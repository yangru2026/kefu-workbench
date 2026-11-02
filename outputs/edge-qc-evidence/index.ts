// 质检截图代取（qc-evidence）
// 用途：客服在「我的质检」点「图 查看」→ 本函数现场向飞书要一次附件临时下载地址，302 跳过去。
//       图片本体始终在飞书，工作台 / Supabase Storage 不存任何图片文件。
// 调用：GET /functions/v1/qc-evidence?id=<飞书记录 record_id>&t=<用户 access_token>
//       （浏览器直接导航带不了 Authorization header，所以 token 走查询参数；校验逻辑与 header 方式一致）
// 权限：本人花名的记录 / admin / leader 才放行，其他人 403
// 需要配置的 Secrets：
//   FEISHU_APP_ID / FEISHU_APP_SECRET
//   FEISHU_QC_APP_TOKEN（多维表格 app_token，wiki 表要先用 wiki 接口换 obj_token）
//   FEISHU_QC_TABLE_ID（表 id，形如 tblXXXX）
//   FEISHU_QC_ATTACH_FIELD（附件列字段名，默认「截图」）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FEISHU = 'https://open.feishu.cn/open-apis';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

function page(title: string, msg: string, status = 400) {
  const html = `<!doctype html><meta charset="utf-8">
<div style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:520px;margin:56px auto;padding:0 20px;color:#0f172a;">
  <div style="font-size:15px;font-weight:600;margin-bottom:10px;">${title}</div>
  <div style="font-size:13px;line-height:1.7;color:#475569;">${msg}</div>
</div>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function tenantToken(): Promise<string> {
  const r = await fetch(`${FEISHU}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: Deno.env.get('FEISHU_APP_ID'),
      app_secret: Deno.env.get('FEISHU_APP_SECRET'),
    }),
  });
  const j = await r.json();
  if (!j.tenant_access_token) throw new Error('飞书鉴权失败：' + (j.msg || j.code || '未知'));
  return j.tenant_access_token as string;
}

// 附件字段可能返回数组或单个对象，统一取出附件本体（要 file_token，不是 tmp_url ——
// 2026-11-02 实测：record 接口返回的 tmp_url 是 drive API 端点、浏览器直接打开不了，
// 必须再拿 file_token 调 batch_get_tmp_download_url 换真正的免登录签名直链）
function pickAttachment(fields: Record<string, unknown>, fieldName: string): { file_token: string; name?: string } | null {
  let v: any = fields?.[fieldName];
  if (v == null) {
    // 字段名没配准就退一步：随便找一个带 file_token 的数组字段
    for (const k of Object.keys(fields || {})) {
      const cand = fields[k];
      if (Array.isArray(cand) && cand.some((x) => x && x.file_token)) { v = cand; break; }
    }
  }
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  for (const it of arr) {
    if (it && it.file_token) return { file_token: String(it.file_token), name: it.name ? String(it.name) : undefined };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });

  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  const token = url.searchParams.get('t') || (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!id) return page('缺少参数', '链接里没有记录 id，请回到工作台重新点。', 400);

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1) 验身份
    if (!token) return page('请先登录工作台', '这个链接需要在工作台里点开。', 401);
    const { data: userData, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !userData?.user) return page('登录已过期', '请刷新工作台页面后重新点「图 查看」。', 401);

    const { data: prof } = await admin
      .from('profiles').select('role,name').eq('id', userData.user.id).maybeSingle();
    const role = prof?.role || 'staff';
    const myName = prof?.name || '';

    // 2) 查这条记录属于谁
    const { data: rec } = await admin
      .from('qc_records').select('id,staff_name').eq('id', id).maybeSingle();
    if (!rec) return page('记录不存在', '这条质检记录已被删除或还未同步。', 404);

    const allowed = role === 'admin' || role === 'leader' || (!!myName && rec.staff_name === myName);
    if (!allowed) return page('没有查看权限', '这条记录不是你的质检记录。', 403);

    // 3) 现场向飞书要临时地址
    const tk = await tenantToken();
    const appToken = Deno.env.get('FEISHU_QC_APP_TOKEN') || 'GIlpb2g4JaAdC4sjcgPcnBtSnbh';
    const tableId = Deno.env.get('FEISHU_QC_TABLE_ID') || 'tblMHaYX5PoPFigD';
    const field = Deno.env.get('FEISHU_QC_ATTACH_FIELD') || '问题截图';
    const r = await fetch(`${FEISHU}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${id}`, {
      headers: { Authorization: `Bearer ${tk}` },
    });
    const j = await r.json();
    if (j.code !== 0) return page('飞书读取失败', '错误：' + (j.msg || j.code) + '（检查表格权限/字段名配置）', 502);

    const att = pickAttachment(j.data?.record?.fields || {}, field);
    if (!att) return page('这条记录没有截图', '登记时没有上传截图附件。', 404);

    // 拿 file_token 现场换免登录的签名直链（约 24h 有效，但每次点都是现取的，永不过期）
    const dr = await fetch(
      `${FEISHU}/drive/v1/medias/batch_get_tmp_download_url?file_tokens=${encodeURIComponent(att.file_token)}`,
      { headers: { Authorization: `Bearer ${tk}` } },
    );
    const dj = await dr.json();
    // 响应结构是 data.tmp_download_urls = [{file_token, tmp_download_url}]（数组，不是单字段）
    const arr = dj?.data?.tmp_download_urls || [];
    const hit = arr.find((x: any) => x && x.file_token === att.file_token) || arr[0];
    const link = hit?.tmp_download_url;
    if (!link) {
      const why = dj?.msg || dj?.code || '未知';
      return page('飞书取图失败', '换临时直链没成功：' + why + '（多为应用缺云文档读权限，需加 drive:drive:readonly）。', 502);
    }

    // 2026-11-02 v9：Supabase 网关会把 Edge Function 返回的 HTML 强制降级为 text/plain + sandbox
    // （防钓鱼页托管），所以查看器网页不能由函数输出 —— 已搬到工作台同域的 qc-view.html：
    //   ?json=1 → 返回 {ok,url,name} 给 qc-view.html 用（application/json 网关不管）
    //   默认    → 后端取回图片字节、以 image/* 内联输出（浏览器直接导航也能显示）
    if (url.searchParams.get('json') === '1') {
      return json({ ok: true, url: link, name: att.name || '质检截图' });
    }
    const upstream = await fetch(link);
    if (!upstream.ok || !upstream.body) {
      return page('飞书取图失败', '下载截图没成功：HTTP ' + upstream.status, 502);
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        'Cache-Control': 'private, max-age=600',
      },
    });
  } catch (e) {
    return page('出错了', String((e as Error)?.message || e), 500);
  }
});
