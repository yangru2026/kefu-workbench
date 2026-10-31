// 质检登记同步（qc-sync）
// 用途：把飞书「质检登记表」整表拉到 Supabase 的 qc_records（幂等 upsert，主键 = 飞书 record_id）。
//       工作台质检页只读这张表；截图不下载、不落库，只记一个「附件×N」标记，
//       客服点「图 查看」时由 qc-evidence 现场向飞书换临时地址。
// 调用：POST /functions/v1/qc-sync
//       - 头部 x-sync-key: <QC_SYNC_KEY>（给定时任务/手动脚本用）
//       - 或者带管理员 JWT（工作台里「立即同步」按钮用）
//       - 传 ?dry=1 只返回解析结果不写库（调试映射用）
// 需要配置的 Secrets：
//   FEISHU_APP_ID / FEISHU_APP_SECRET
//   FEISHU_QC_WIKI_NODE（wiki 链接里 /wiki/ 后面那串；配了它就不用配 APP_TOKEN）
//   FEISHU_QC_APP_TOKEN（多维表格 app_token；和上面二选一）
//   FEISHU_QC_TABLE_ID（表 id，见链接 ?sheet= 后面那串）
//   FEISHU_QC_ATTACH_FIELD（附件列字段名，默认「截图」）
//   QC_SYNC_KEY（可选，随机串）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FEISHU = 'https://open.feishu.cn/open-apis';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

/* 字段名候选：飞书表里叫哪个都能认（以后她改列名也不容易断） */
const F = {
  qc_date:      ['质检日期', '日期', '质检时间', '登记日期'],
  staff_name:   ['客服花名', '客服', '花名', '被质检客服', '被质检人'],
  qc_name:      ['质检人', '质检员', '登记人'],
  issue_type:   ['问题类型', '类型', '问题分类'],
  severity:     ['严重度', '严重程度', '等级'],
  amount:       ['扣罚金额', '扣罚', '金额', '罚款'],
  detail:       ['问题描述', '描述', '问题', '问题内容'],
  note:         ['备注', '说明'],
  evidence_url: ['截图链接', '证据链接', '图片链接'],
  confirmed_by: ['扣罚确认人', '确认人'],
  confirmed_at: ['扣罚确认时间', '确认时间'],
};

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
  if (!j.tenant_access_token) throw new Error('飞书鉴权失败：' + (j.msg || j.code));
  return j.tenant_access_token as string;
}

// wiki 节点 → 多维表格 app_token
async function resolveAppToken(tk: string): Promise<string> {
  const direct = Deno.env.get('FEISHU_QC_APP_TOKEN');
  if (direct) return direct;
  const node = Deno.env.get('FEISHU_QC_WIKI_NODE');
  if (!node) throw new Error('缺 FEISHU_QC_APP_TOKEN 或 FEISHU_QC_WIKI_NODE');
  const r = await fetch(`${FEISHU}/wiki/v2/spaces/get_node?token=${node}&obj_type=wiki`, {
    headers: { Authorization: `Bearer ${tk}` },
  });
  const j = await r.json();
  const obj = j?.data?.node?.obj_token;
  if (!obj) throw new Error('wiki 节点解析失败：' + (j.msg || JSON.stringify(j).slice(0, 120)));
  return obj as string;
}

/* ---------- 飞书字段值归一化 ---------- */
function text(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(' ').trim();
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text.trim();
    if (typeof v.name === 'string') return v.name.trim();
    if (v.value != null) return text(v.value);
    if (v.link) return String(v.link);
  }
  return '';
}
const ymd = (ms: number) => {
  // 飞书日期字段是毫秒时间戳，按东八区取日期
  const d = new Date(ms + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};
function toDate(v: any): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return ymd(v);
  const s = text(v);
  const m = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  const n = Number(s);
  return Number.isFinite(n) && n > 1e11 ? ymd(n) : null;
}
function toNum(v: any): number {
  const s = text(v).replace(/[¥￥,\s元]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
function toTime(v: any): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(v).toISOString();
  const s = text(v);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
const pick = (fields: Record<string, any>, keys: string[]) => {
  for (const k of keys) if (fields[k] != null && text(fields[k]) !== '') return fields[k];
  return null;
};

function mapRecord(it: any, attachField: string, evKeys: string[]) {
  const f = it.fields || {};
  const attachKey = Object.keys(f).find((k) => Array.isArray(f[k]) && f[k].some((x: any) => x && x.file_token)
    && (k === attachField || /附件|截图|证据|图片/.test(k)));
  const attachCount = attachKey ? (f[attachKey] as any[]).filter((x) => x && x.file_token).length : 0;
  const urlText = text(pick(f, evKeys));
  const evidence = urlText ? urlText : (attachCount ? '附件×' + attachCount : null);

  return {
    id: it.record_id,
    qc_date: toDate(pick(f, F.qc_date)),
    staff_name: text(pick(f, F.staff_name)) || null,
    qc_name: text(pick(f, F.qc_name)) || null,
    issue_type: text(pick(f, F.issue_type)) || null,
    severity: text(pick(f, F.severity)) || null,
    amount: toNum(pick(f, F.amount)),
    amount_confirmed_by: text(pick(f, F.confirmed_by)) || null,
    amount_confirmed_at: toTime(pick(f, F.confirmed_at)),
    detail: text(pick(f, F.detail)) || null,
    note: text(pick(f, F.note)) || null,
    evidence,
    raw: f,
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 鉴权：x-sync-key 或 管理员 JWT
    const key = req.headers.get('x-sync-key') || '';
    let ok = !!key && !!Deno.env.get('QC_SYNC_KEY') && key === Deno.env.get('QC_SYNC_KEY');
    if (!ok) {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (token) {
        const { data } = await admin.auth.getUser(token);
        if (data?.user) {
          const { data: prof } = await admin.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
          ok = prof?.role === 'admin';
        }
      }
    }
    if (!ok) return json({ error: '没有同步权限' }, 401);

    const tk = await tenantToken();
    const appToken = await resolveAppToken(tk);
    const tableId = Deno.env.get('FEISHU_QC_TABLE_ID')!;
    if (!tableId) return json({ error: '缺 FEISHU_QC_TABLE_ID（链接 ?sheet= 后面那串）' }, 500);
    const attachField = Deno.env.get('FEISHU_QC_ATTACH_FIELD') || '截图';

    // 分页拉全表
    const all: any[] = [];
    let pageToken = '';
    for (let i = 0; i < 40; i++) {
      const qs = new URLSearchParams({ page_size: '500' });
      if (pageToken) qs.set('page_token', pageToken);
      const r = await fetch(`${FEISHU}/bitable/v1/apps/${appToken}/tables/${tableId}/records?${qs}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const j = await r.json();
      if (j.code !== 0) return json({ error: '飞书读取失败：' + (j.msg || j.code) }, 502);
      all.push(...(j.data?.items || []));
      if (!j.data?.has_more) break;
      pageToken = j.data?.page_token || '';
      if (!pageToken) break;
    }

    const evKeys = F.evidence_url;
    const mapped = all.map((it) => mapRecord(it, attachField, evKeys)).filter((r) => r.id);

    if (dry) {
      return json({
        fetched: mapped.length,
        sample: mapped.slice(0, 3),
        fieldsSeen: all[0] ? Object.keys(all[0].fields || {}) : [],
      });
    }

    // 分批 upsert（一次 200 条，避免请求过大）
    let saved = 0;
    for (let i = 0; i < mapped.length; i += 200) {
      const chunk = mapped.slice(i, i + 200);
      const { error } = await admin.from('qc_records').upsert(chunk, { onConflict: 'id' });
      if (error) return json({ error: '写库失败：' + error.message, savedBefore: saved }, 500);
      saved += chunk.length;
    }

    return json({ ok: true, fetched: mapped.length, saved, withEvidence: mapped.filter((r) => r.evidence).length });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
