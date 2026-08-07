// ============================================
// 飞书多维表格 → Supabase 花色素材同步 Edge Function
// ============================================
// 功能：
//   1. 手动触发同步（工作台「从飞书同步」按钮调用）
//   2. 接收飞书事件订阅 webhook（自动同步）
//   3. 拉取飞书多维表格全部记录，upsert 到 pattern_assets 表
//   4. 飞书中已删除的记录 → 在 Supabase 中标记下架
//
// 环境变量（在 Supabase Dashboard → Edge Functions → Secrets 中配置）：
//   FEISHU_APP_ID          飞书自建应用 App ID
//   FEISHU_APP_SECRET      飞书自建应用 App Secret
//   FEISHU_BITABLE_APP_TOKEN  多维表格 app_token（URL 中 /base/ 后面的部分）
//   FEISHU_BITABLE_TABLE_ID  多维表格 table_id（URL 中 ?table= 后面的部分）
//   SYNC_AUTH_TOKEN        手动触发的鉴权 token（自定义，前端请求时需带上）
//
// 飞书多维表格字段名 → pattern_assets 列映射：
//   花色名称   → name
//   品牌       → brand
//   抛型       → type
//   系列       → series
//   色系       → color
//   直径       → diameter
//   着色直径   → color_diameter
//   材质       → material
//   氧透率     → oxygen
//   含水量     → water
//   规格       → spec
//   花色图URL  → lens_img
//   上眼图URL  → eye_img
//   推荐话术   → description
//   是否下架   → is_discontinued
//   飞书记录ID → feishu_record_id（用于增量同步匹配）
// ============================================

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// 获取飞书 tenant_access_token
async function getTenantAccessToken(appId: string, appSecret: string) {
  const resp = await fetch(
    `${FEISHU_BASE}/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
  );
  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`获取 token 失败: ${data.msg}`);
  }
  return data.tenant_access_token as string;
}

// 分页拉取多维表格全部记录
async function fetchAllBitableRecords(
  token: string,
  appToken: string,
  tableId: string,
) {
  const allRecords: Record<string, unknown>[] = [];
  let pageToken: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(
      `${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
    );
    if (pageToken) url.searchParams.set("page_token", pageToken);
    url.searchParams.set("page_size", "500");

    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const data = await resp.json();
    if (data.code !== 0) {
      throw new Error(`拉取记录失败: ${data.msg}`);
    }
    const items = data.data?.items || [];
    allRecords.push(...items);
    hasMore = data.data?.has_more || false;
    pageToken = data.data?.page_token;
  }

  return allRecords;
}

// 将飞书记录字段值转换为字符串
function fieldValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    // 多选/附件等字段，取文本
    const texts = val
      .map((v) => {
        if (typeof v === "string") return v;
        if (v?.text) return v.text;
        if (v?.name) return v.name;
        if (v?.file_token) return v.file_token;
        return "";
      })
      .filter(Boolean);
    return texts.join(", ");
  }
  if (typeof val === "object" && val !== null) {
    // 富文本/附件对象
    const obj = val as Record<string, unknown>;
    if (obj.text) return String(obj.text);
    if (obj.name) return String(obj.name);
    if (obj.value) return String(obj.value);
  }
  return String(val);
}

// 从附件字段提取图片URL（飞书附件返回 file_token，需用下载API；这里直接用原始URL或留空）
function attachmentUrl(val: unknown): string {
  if (!val || !Array.isArray(val) || val.length === 0) return "";
  const first = val[0] as Record<string, unknown>;
  // 如果字段直接是 URL 文本类型
  if (typeof first === "string") return first;
  // 如果是附件类型，返回 file_token（前端需要用飞书API下载）
  // 但由于前端无法直接访问飞书API，这里建议多维表格中直接存图片URL文本
  if (first.file_token) return String(first.file_token);
  if (first.url) return String(first.url);
  if (first.text) return String(first.text);
  return "";
}

// 布尔值转换
function boolValue(val: unknown): boolean {
  if (val === true || val === "true" || val === "是" || val === "已下架") {
    return true;
  }
  return false;
}

// 映射飞书记录 → pattern_assets 行
function mapRecord(record: Record<string, unknown>) {
  const f = (record.fields || {}) as Record<string, unknown>;
  return {
    name: fieldValue(f["花色名称"]),
    brand: fieldValue(f["品牌"]),
    type: fieldValue(f["抛型"]),
    series: fieldValue(f["系列"]),
    color: fieldValue(f["色系"]),
    diameter: fieldValue(f["直径"]),
    color_diameter: fieldValue(f["着色直径"]),
    material: fieldValue(f["材质"]),
    oxygen: fieldValue(f["氧透率"]),
    water: fieldValue(f["含水量"]),
    spec: fieldValue(f["规格"]),
    lens_img: fieldValue(f["花色图URL"]),
    eye_img: fieldValue(f["上眼图URL"]),
    description: fieldValue(f["推荐话术"]),
    is_discontinued: boolValue(f["是否下架"]),
    feishu_record_id: String(record.record_id || ""),
  };
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const appId = Deno.env.get("FEISHU_APP_ID");
    const appSecret = Deno.env.get("FEISHU_APP_SECRET");
    const appToken = Deno.env.get("FEISHU_BITABLE_APP_TOKEN");
    const tableId = Deno.env.get("FEISHU_BITABLE_TABLE_ID");
    const authToken = Deno.env.get("SYNC_AUTH_TOKEN");

    if (!appId || !appSecret || !appToken || !tableId) {
      return json(
        { ok: false, error: "缺少飞书环境变量配置，请在 Supabase Edge Function Secrets 中设置" },
        500,
      );
    }

    // 解析请求
    const body = await req.json().catch(() => ({}));

    // ===== 飞书事件订阅验证（challenge）=====
    if (body.type === "url_verification" && body.challenge) {
      return json({ challenge: body.challenge });
    }

    // ===== 鉴权 =====
    // 手动触发：Authorization: Bearer <SYNC_AUTH_TOKEN>
    // 飞书 webhook：header 中带 x-lark-request-timestamp / x-lark-signature
    const authHeader = req.headers.get("authorization") || "";
    const isFeishuWebhook = req.headers.get("x-lark-request-timestamp") !== null;
    const isManualTrigger = authHeader.replace("Bearer ", "") === authToken;

    if (!isFeishuWebhook && !isManualTrigger) {
      return json({ ok: false, error: "未授权" }, 401);
    }

    // 飞书事件订阅：事件体可能是加密的，这里暂不处理加密
    // 事件格式: { event: { ... } } 或 { header: { event_type: "drive.file.bitable_record_changed_v1" } }
    // 收到事件后直接执行全量同步
    console.log("收到同步请求，开始执行...");

    // ===== 获取飞书 token =====
    const token = await getTenantAccessToken(appId, appSecret);

    // ===== 拉取全部记录 =====
    const records = await fetchAllBitableRecords(token, appToken, tableId);
    console.log(`飞书多维表格共 ${records.length} 条记录`);

    if (records.length === 0) {
      return json({ ok: true, message: "飞书多维表格无记录", synced: 0 });
    }

    // ===== 映射数据 =====
    const mappedRows = records.map(mapRecord).filter((r) => r.name); // 必须有花色名称
    console.log(`有效记录 ${mappedRows.length} 条（已过滤无名称记录）`);

    // ===== 写入 Supabase =====
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 收集飞书记录 ID
    const feishuIds = mappedRows.map((r) => r.feishu_record_id).filter(Boolean);

    // Upsert：按 name + brand 匹配（同品牌同名称视为同一条）
    const upsertResp = await fetch(
      `${supabaseUrl}/rest/v1/pattern_assets?on_conflict=name,brand`,
      {
        method: "POST",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(mappedRows),
      },
    );

    if (!upsertResp.ok) {
      const errText = await upsertResp.text();
      console.error("Supabase upsert 失败:", errText);
      return json(
        { ok: false, error: "写入 Supabase 失败: " + errText },
        500,
      );
    }

    const upserted = await upsertResp.json();
    console.log(`成功 upsert ${Array.isArray(upserted) ? upserted.length : 0} 条`);

    // ===== 处理删除：飞书中不再存在的记录 → 标记下架 =====
    if (feishuIds.length > 0) {
      // 查询 Supabase 中所有有 feishu_record_id 但不在本次飞书记录列表中的
      const notInFilter = `feishu_record_id=not.in.(${feishuIds.join(",")})`;
      const markResp = await fetch(
        `${supabaseUrl}/rest/v1/pattern_assets?${notInFilter}&select=id,feishu_record_id`,
        {
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
          },
        },
      );
      if (markResp.ok) {
        const staleRecords = await markResp.json();
        if (Array.isArray(staleRecords) && staleRecords.length > 0) {
          // 标记这些记录为下架
          const staleIds = staleRecords.map((r: { id: string }) => r.id);
          const updateResp = await fetch(
            `${supabaseUrl}/rest/v1/pattern_assets?id=in.(${staleIds.join(",")})`,
            {
              method: "PATCH",
              headers: {
                "apikey": serviceKey,
                "Authorization": `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
              },
              body: JSON.stringify({ is_discontinued: true }),
            },
          );
          if (updateResp.ok) {
            console.log(`标记 ${staleIds.length} 条飞书已删除记录为下架`);
          }
        }
      }
    }

    const result = {
      ok: true,
      message: "同步完成",
      total_in_feishu: records.length,
      synced: Array.isArray(upserted) ? upserted.length : 0,
      timestamp: new Date().toISOString(),
    };
    console.log("同步结果:", result);

    return json(result);
  } catch (err) {
    console.error("同步异常:", err);
    return json(
      { ok: false, error: err.message || String(err) },
      500,
    );
  }
});
