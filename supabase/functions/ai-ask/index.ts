// ============================================================
// Supabase Edge Function: ai-ask
// 客服工作台「AI 提问」后端
//
// 职责：
//   1. 校验登录身份（从前端带过来的 JWT 读出是谁在问）
//   2. 检索工作台里匹配的培训资料 / 售前话术，作为回答依据
//   3. 调用豆包（火山方舟）生成回答
//   4. 把问答写入 ai_questions 表（RLS 保证只能写自己的）
//
// 关键：大模型 API Key 只存在 Supabase Secrets 里，前端永远拿不到。
//
// 部署：
//   supabase secrets set ARK_API_KEY=你的Key
//   supabase secrets set ARK_MODEL=ep-你的接入点ID
//   supabase functions deploy ai-ask
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ARK_API_KEY = Deno.env.get('ARK_API_KEY') ?? '';
const ARK_MODEL = Deno.env.get('ARK_MODEL') ?? '';
const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ------------------------------------------------------------
// 系统提示词：决定回答是否「专业、正确、安全」
// ------------------------------------------------------------
const SYSTEM_PROMPT = `你是尤赫（youhoo）美瞳品牌的资深售前客服专家，正在帮助一线客服回答客户的问题。

【你的职责】
1. 给出专业、准确、可以直接发给客户的回复建议
2. 涉及专业知识必须准确：度数、基弧、直径、含水量、材质（水凝胶/硅水凝胶）、佩戴时长、护理、禁忌
3. 帮客服组织语言：自然、礼貌、不生硬，像真人客服在说话

【红线，绝对不能碰】
- 绝不承诺医疗效果：不说「矫正视力」「治疗近视」「缓解视疲劳」「护眼」等
- 不夸大功效，不用「最」「第一」「绝对」「顶级」等绝对化用语（广告法风险）
- 涉及眼红、疼痛、发炎、过敏、持续不适：一律建议立即停戴并就医，不要自行诊断，不要推荐任何药品
- 不确定的参数、价格、库存、活动政策：明确说「以工作台实际资料为准」，绝不编造数字
- 客户情绪激动时，先共情安抚，再给方案，不要硬邦邦讲道理

【输出格式，严格遵守】
【可直接发送】
（一到三句自然口语，客服可以直接复制发给客户）

【要点提示】
（1-2 条简短说明：为什么这样回 / 要注意什么）

【专业参数】
（仅在涉及参数时列出；不涉及就整个省略这一节）

全程用中文，语气贴近真实客服，不要机器人腔，不要空话套话。`;

// ------------------------------------------------------------
// 工具函数
// ------------------------------------------------------------
function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** 中文分词简化方案：取二元组（bigram），无需分词库即可做近似匹配 */
function bigrams(s: string): string[] {
  const clean = (s || '').replace(/[\s\p{P}\p{S}\p{C}]/gu, '').toLowerCase();
  const out: string[] = [];
  for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2));
  return out;
}

/** 培训资料行 -> 纯文本（兼容 overview / cards / steps 等不同 section_type） */
function knowledgeText(row: Record<string, any>): string {
  const parts: string[] = [];
  if (row.title) parts.push(String(row.title));
  if (row.subcat) parts.push(String(row.subcat));
  if (row.section_type) parts.push(String(row.section_type));
  if (row.content != null) {
    parts.push(typeof row.content === 'string' ? row.content : JSON.stringify(row.content));
  }
  return parts.join(' ');
}

/** 售前话术行 -> 纯文本 */
function scriptText(s: Record<string, any>): string {
  const parts: string[] = [String(s.title || ''), String(s.subcategory || ''), String(s.script_group || '')];
  const styles = (s.styles || {}) as Record<string, unknown>;
  ['标准', '简短', '专业'].forEach((k) => {
    if (styles[k]) parts.push(String(styles[k]));
  });
  return parts.join(' ');
}

/** 命中多少个问题里的二元组，作为相关度打分 */
function scoreOf(qb: Set<string>, text: string): number {
  const t = (text || '').toLowerCase();
  let n = 0;
  for (const b of qb) if (t.includes(b)) n++;
  return n;
}

// ------------------------------------------------------------
// 主流程
// ------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonRes({ error: '仅支持 POST 请求' }, 405);

  const startedAt = Date.now();
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return jsonRes({ error: '未登录，请重新登录后再提问' }, 401);

  if (!ARK_API_KEY || !ARK_MODEL) {
    return jsonRes(
      { error: 'AI 服务尚未配置，请联系管理员在 Supabase 设置 ARK_API_KEY 与 ARK_MODEL' },
      500
    );
  }

  // 以「当前登录用户」的身份操作，RLS 会自动生效
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonRes({ error: '登录状态已失效，请重新登录' }, 401);
  }
  const user = userData.user;

  // 读取姓名和分组：管理员查看「全部记录」时要显示是谁问的
  const { data: profile } = await userClient
    .from('profiles')
    .select('name, group_name')
    .eq('id', user.id)
    .single();

  let payload: { question?: string; scene?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return jsonRes({ error: '请求格式错误' }, 400);
  }

  const question = String(payload.question || '').trim();
  const scene = String(payload.scene || '').trim();
  if (!question) return jsonRes({ error: '问题不能为空' }, 400);
  if (question.length > 2000) return jsonRes({ error: '问题太长了，请精简到 2000 字以内' }, 400);

  // ---- 读取资料（沿用前端的读取权限，普通客服也能读培训资料）----
  let context = '';
  let matched = 0;
  try {
    const qb = new Set(bigrams(question + ' ' + scene));
    const [knowRes, scriptRes] = await Promise.all([
      userClient.from('training_knowledge').select('title, subcat, section_type, content'),
      userClient.from('training_scripts').select('title, subcategory, script_group, styles'),
    ]);

    const candidates: { text: string; score: number }[] = [];
    for (const row of (knowRes.data || []) as Record<string, any>[]) {
      const text = knowledgeText(row);
      const score = scoreOf(qb, text);
      if (score > 0) candidates.push({ text: `[资料] ${row.title || ''}\n${text}`, score });
    }
    for (const s of (scriptRes.data || []) as Record<string, any>[]) {
      const text = scriptText(s);
      const score = scoreOf(qb, text);
      if (score > 0) candidates.push({ text: `[话术] ${s.title || ''}\n${text}`, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, 6);
    matched = top.length;
    context = top.map((c) => c.text.slice(0, 900)).join('\n\n');
  } catch (e) {
    console.warn('资料检索失败，改为不携带资料回答：', e);
  }

  // ---- 组装给模型的消息 ----
  const userMessage = [
    scene ? `【客户所在的场景】${scene}` : '',
    `【客服遇到的问题】\n${question}`,
    '',
    matched > 0
      ? `【可参考的内部资料】以下是工作台里匹配的培训资料和话术，优先依据这些内容回答：\n\n${context}`
      : '【可参考的内部资料】无匹配资料，请依据通用美瞳行业知识回答，不确定就说不确定。',
    '',
    '请严格按照系统要求的格式输出。',
  ]
    .filter(Boolean)
    .join('\n');

  // ---- 调用豆包 ----
  let answer = '';
  let status: 'success' | 'failed' = 'success';
  let errMsg = '';
  let totalTokens = 0;

  try {
    const aiRes = await fetch(ARK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`AI 服务返回 ${aiRes.status}: ${txt.slice(0, 300)}`);
    }

    const aiJson = await aiRes.json();
    answer = aiJson?.choices?.[0]?.message?.content ?? '';
    totalTokens = Number(aiJson?.usage?.total_tokens ?? 0) || 0;
    if (!answer) throw new Error('AI 返回内容为空');
    status = 'success';
  } catch (e) {
    status = 'failed';
    errMsg = e instanceof Error ? e.message : String(e);
    console.error('AI 调用失败：', errMsg);
  }

  const latencyMs = Date.now() - startedAt;

  // ---- 落库（RLS 只允许写 user_id = 自己的记录）----
  const { data: saved, error: saveErr } = await userClient
    .from('ai_questions')
    .insert({
      user_id: user.id,
      user_name: profile?.name ?? null,
      group_name: profile?.group_name ?? null,
      question,
      answer: answer || null,
      status,
      error: errMsg || null,
      model: ARK_MODEL,
      total_tokens: totalTokens || null,
      latency_ms: latencyMs,
      answered_at: status === 'success' ? new Date().toISOString() : null,
    })
    .select('id, created_at')
    .single();

  if (saveErr) {
    console.error('记录写入失败：', saveErr.message);
    // 回答已经生成，依然返回给客服，只是没记下来
    return jsonRes({ answer, status, warning: '回答已生成，但记录写入失败：' + saveErr.message });
  }

  if (status === 'failed') {
    return jsonRes(
      { error: 'AI 暂时没能回答：' + (errMsg || '未知错误'), id: saved?.id },
      502
    );
  }

  return jsonRes({
    answer,
    id: saved?.id ?? null,
    created_at: saved?.created_at ?? null,
    total_tokens: totalTokens || null,
    latency_ms: latencyMs,
    matched_docs: matched,
  });
});
