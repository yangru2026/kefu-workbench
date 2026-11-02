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

    // 2026-11-02 v8：不直接输出图片 —— 长截图缩到一屏字太小且浏览器自带查看器不能缩放。
    // 返回一个轻量查看器页：滚轮缩放 / 点图切换 原图100%⇄适应窗口 / 顶栏 ± 按钮 / 下载。
    // 图片本体由浏览器直接加载飞书签名直链（服务端刚换的，无需再代理一遍，省边缘流量）。
    const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const name = (att.name || '质检截图').replace(/[<>"'\\]/g, '');
    const viewer = `<!doctype html><html lang="zh"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escAttr(name)} · 质检截图</title>
<style>
html,body{margin:0;height:100%;background:#1b2230;overflow:hidden}
#bar{position:fixed;top:0;left:0;right:0;z-index:9;display:flex;gap:8px;align-items:center;
 padding:8px 14px;background:#111827e6;color:#e5e7eb;font:13px/1 system-ui,'PingFang SC','Microsoft YaHei',sans-serif}
#bar b{margin-right:4px;max-width:30vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#bar button,#bar a button{background:#374151;color:#fff;border:0;border-radius:6px;padding:5px 12px;
 font-size:13px;cursor:pointer}#bar button:hover{background:#4b5563}
#pct{min-width:70px;text-align:center;color:#9ca3af}
#tip{margin-left:auto;color:#6b7280;font-size:12px}
#wrap{height:100%;overflow:auto;display:flex;justify-content:center;padding:46px 10px 20px;box-sizing:border-box}
#im{cursor:zoom-in;transform-origin:top center;border-radius:4px;box-shadow:0 4px 24px #0008}
#im.at{cursor:zoom-out}
</style>
<div id="bar"><b>${escAttr(name)}</b>
 <button onclick="fit()">适应窗口</button>
 <button onclick="set(z*1.25 || 1.25)">放大 ＋</button>
 <button onclick="set(z/1.25 || 0.8)">缩小 －</button>
 <span id="pct"></span>
 <a href="${escAttr(link)}" download="${escAttr(name)}"><button>下载原图</button></a>
 <span id="tip">滚轮缩放 · 点图片在 原图100% / 适应窗口 间切换</span>
</div>
<div id="wrap"><img id="im" src="${escAttr(link)}" alt="质检截图"></div>
<script>
var z=0,im=document.getElementById('im'),wrap=document.getElementById('wrap'),pct=document.getElementById('pct');
function apply(){
 if(z===0){im.style.width='';im.style.maxWidth='100%';im.style.height='auto';pct.textContent='适应窗口';im.classList.remove('at');}
 else{im.style.maxWidth='none';im.style.width=Math.round(im.naturalWidth*z)+'px';im.style.height='auto';
  pct.textContent=Math.round(z*100)+'%';im.classList.toggle('at',z>=1);}
}
function set(v){z=Math.min(6,Math.max(0.15,v));apply();}
function fit(){z=0;apply();}
im.onload=apply;
wrap.onwheel=function(e){e.preventDefault();set(z===0?(e.deltaY<0?1:0.8):z*(e.deltaY<0?1.25:0.8));};
im.onclick=function(){if(z===0)set(1);else if(z>=1)fit();else set(1);};
<\/script>`;
    return new Response(viewer, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return page('出错了', String((e as Error)?.message || e), 500);
  }
});
