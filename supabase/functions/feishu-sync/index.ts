// ============================================
// 飞书多维表格 → Supabase 多表同步 Edge Function
// ============================================
// 功能：
//   1. 手动触发同步（工作台「从飞书同步」按钮调用）
//   2. 接收飞书事件订阅 webhook（自动同步）
//   3. 支持四种数据表同步：
//      - patterns  花色素材 → pattern_assets
//      - schedule  排班表   → schedule_data
//      - ranking   客服排名 → ranking_data
//      - presale   售前月度 → presale_monthly
//
// 环境变量（在 Supabase Dashboard → Edge Functions → Secrets 中配置）：
//   FEISHU_APP_ID               飞书自建应用 App ID
//   FEISHU_APP_SECRET           飞书自建应用 App Secret
//   FEISHU_BITABLE_APP_TOKEN    多维表格 app_token（URL 中 /base/ 后面的部分）
//   FEISHU_PATTERN_TABLE_ID     花色素材 table_id
//   FEISHU_SCHEDULE_TABLE_ID    排班表 table_id
//   FEISHU_RANKING_TABLE_ID     客服排名 table_id
//   FEISHU_PRESALE_TABLE_ID     售前月度 table_id
//   SYNC_AUTH_TOKEN             手动触发的鉴权 token
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
    const obj = val as Record<string, unknown>;
    if (obj.text) return String(obj.text);
    if (obj.name) return String(obj.name);
    if (obj.value) return String(obj.value);
  }
  return String(val);
}

// 数字值转换
function numValue(val: unknown): number {
  const s = fieldValue(val);
  const n = parseFloat(s.replace(/[,，¥元秒%]/g, "").trim());
  return isNaN(n) ? 0 : n;
}

// 布尔值转换
function boolValue(val: unknown): boolean {
  if (val === true || val === "true" || val === "是" || val === "已下架") {
    return true;
  }
  return false;
}

// ============================================
// 字段映射函数 - 每种表一个
// ============================================

// 花色素材 → pattern_assets
// 空值字段不写入，避免覆盖数据库已有数据（如图片URL）
function mapPatternRecord(record: Record<string, unknown>) {
  const f = (record.fields || {}) as Record<string, unknown>;

  // name 和 brand 是 upsert 冲突键，必须包含
  const row: Record<string, unknown> = {
    name: fieldValue(f["花色名称"]),
    brand: fieldValue(f["品牌"]),
    feishu_record_id: String(record.record_id || ""),
  };

  // 以下字段：飞书有值才写入，空值不覆盖数据库已有数据
  const optionalFields: [string, string][] = [
    ["type", "抛型"],
    ["series", "系列"],
    ["color", "色系"],
    ["diameter", "直径"],
    ["color_diameter", "着色直径"],
    ["material", "材质"],
    ["oxygen", "氧透率"],
    ["water", "含水量"],
    ["spec", "规格"],
    ["lens_img", "花色图URL"],
    ["eye_img", "上眼图URL"],
    ["description", "推荐话术"],
  ];

  for (const [dbField, feishuField] of optionalFields) {
    const val = fieldValue(f[feishuField]);
    if (val) row[dbField] = val;
  }

  // 是否下架：飞书有值才写入（避免空值覆盖已有的下架标记）
  const discVal = f["是否下架"];
  if (discVal !== null && discVal !== undefined && discVal !== "") {
    row.is_discontinued = boolValue(discVal);
  }

  return row;
}

// 排班表 → schedule_data
function mapScheduleRecord(record: Record<string, unknown>) {
  const f = (record.fields || {}) as Record<string, unknown>;
  const monthKey = fieldValue(f["月份"]);
  const staffName = fieldValue(f["姓名"]);
  const groupName = fieldValue(f["组别"]);

  // 构建 schedule JSON：1日~31日
  const schedule: Record<string, string> = {};
  for (let day = 1; day <= 31; day++) {
    const val = fieldValue(f[`${day}日`]);
    if (val) schedule[String(day)] = val;
  }

  return {
    month_key: monthKey,
    staff_name: staffName,
    group_name: groupName,
    schedule: schedule,
    feishu_record_id: String(record.record_id || ""),
  };
}

// 客服排名 → ranking_data
function mapRankingRecord(record: Record<string, unknown>) {
  const f = (record.fields || {}) as Record<string, unknown>;
  return {
    staff_name: fieldValue(f["姓名"]),
    group_name: fieldValue(f["组别"]),
    conversion_rate: numValue(f["转化率"]),
    cross_sales: numValue(f["连带销售额"]),
    satisfaction: numValue(f["满意度"]),
    response_time: numValue(f["响应时间"]),
    period: fieldValue(f["月份"]),
    feishu_record_id: String(record.record_id || ""),
  };
}

// 售前月度 → presale_monthly
function mapPresaleMonthlyRecord(record: Record<string, unknown>) {
  const f = (record.fields || {}) as Record<string, unknown>;
  return {
    period_month: fieldValue(f["月份"]),
    group_name: fieldValue(f["组别"]),
    visitors: numValue(f["接待量"]),
    orders: numValue(f["成交单数"]),
    revenue: numValue(f["销售额"]),
    conversion: numValue(f["转化率"]),
    avg_response: numValue(f["响应时间"]),
    satisfaction: numValue(f["满意度"]),
    cross_sales: numValue(f["连带销售额"]),
    visitor_count: numValue(f["接待人数"]),
    inquiry_count: numValue(f["询单人数"]),
    payment_count: numValue(f["付款人数"]),
    feishu_record_id: String(record.record_id || ""),
  };
}

// ============================================
// Supabase REST API 工具函数
// ============================================

async function supabaseUpsert(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  insertOnly = false,
) {
  // insertOnly 模式：已存在的记录跳过（ignore-duplicates），不覆盖任何已有数据
  // 普通 upsert 模式：已存在的记录更新（merge-duplicates）
  const prefer = insertOnly
    ? "resolution=ignore-duplicates,return=representation"
    : "resolution=merge-duplicates,return=representation";

  const resp = await fetch(
    `${supabaseUrl}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": prefer,
      },
      body: JSON.stringify(rows),
    },
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`写入 ${table} 失败: ${errText}`);
  }
  return await resp.json();
}

// 标记飞书已删除的花色为下架
async function markStalePatternsDiscontinued(
  supabaseUrl: string,
  serviceKey: string,
  feishuIds: string[],
) {
  if (feishuIds.length === 0) return 0;
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
  if (!markResp.ok) return 0;
  const staleRecords = await markResp.json();
  if (!Array.isArray(staleRecords) || staleRecords.length === 0) return 0;
  const staleIds = staleRecords.map((r: { id: string }) => r.id);
  await fetch(
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
  return staleIds.length;
}

// ============================================
// 同步类型定义
// ============================================

interface SyncType {
  name: string;
  tableIdEnv: string;
  mapFn: (record: Record<string, unknown>) => Record<string, unknown>;
  supabaseTable: string;
  onConflict: string;
  filterFn: (row: Record<string, unknown>) => boolean;
  // insertOnly: true = 只插入新记录，已存在的跳过（不覆盖任何已有数据）
  insertOnly?: boolean;
  // 花色素材特殊的删除处理（仅非 insertOnly 模式生效）
  postSyncFn?: (
    supabaseUrl: string,
    serviceKey: string,
    rows: Record<string, unknown>[],
  ) => Promise<void>;
}

const SYNC_TYPES: Record<string, SyncType> = {
  patterns: {
    name: "花色素材",
    tableIdEnv: "FEISHU_PATTERN_TABLE_ID",
    mapFn: mapPatternRecord,
    supabaseTable: "pattern_assets",
    onConflict: "name,brand",
    filterFn: (row) => !!row.name,
    // 只插入新花色，已有的完全不动（图片、下架标记等全部保留）
    insertOnly: true,
    // 不再标记下架 —— 飞书表格只放新款，不能用来判断哪些花色该下架
  },
  schedule: {
    name: "排班表",
    tableIdEnv: "FEISHU_SCHEDULE_TABLE_ID",
    mapFn: mapScheduleRecord,
    supabaseTable: "schedule_data",
    onConflict: "month_key,staff_name",
    filterFn: (row) => !!row.month_key && !!row.staff_name,
  },
  ranking: {
    name: "客服排名",
    tableIdEnv: "FEISHU_RANKING_TABLE_ID",
    mapFn: mapRankingRecord,
    supabaseTable: "ranking_data",
    onConflict: "staff_name,period",
    filterFn: (row) => !!row.staff_name && !!row.period,
  },
  presale: {
    name: "售前月度",
    tableIdEnv: "FEISHU_PRESALE_TABLE_ID",
    mapFn: mapPresaleMonthlyRecord,
    supabaseTable: "presale_monthly",
    onConflict: "period_month,group_name",
    filterFn: (row) => !!row.period_month && !!row.group_name,
  },
};

// 执行单种类型的同步
async function doSync(
  syncType: SyncType,
  token: string,
  appToken: string,
  tableId: string,
  supabaseUrl: string,
  serviceKey: string,
) {
  const records = await fetchAllBitableRecords(token, appToken, tableId);
  console.log(`${syncType.name}: 飞书共 ${records.length} 条记录`);

  if (records.length === 0) {
    return { total_in_feishu: 0, synced: 0 };
  }

  const mappedRows = records
    .map(syncType.mapFn)
    .filter(syncType.filterFn);

  console.log(`${syncType.name}: 有效记录 ${mappedRows.length} 条`);

  if (mappedRows.length === 0) {
    return { total_in_feishu: records.length, synced: 0 };
  }

  const upserted = await supabaseUpsert(
    supabaseUrl,
    serviceKey,
    syncType.supabaseTable,
    mappedRows,
    syncType.onConflict,
    syncType.insertOnly || false,
  );

  const syncedCount = Array.isArray(upserted) ? upserted.length : 0;
  const mode = syncType.insertOnly ? "新增" : "写入";
  console.log(`${syncType.name}: 成功${mode} ${syncedCount} 条`);

  // 后处理（仅非 insertOnly 模式才执行，如标记下架等）
  if (syncType.postSyncFn && !syncType.insertOnly) {
    await syncType.postSyncFn(supabaseUrl, serviceKey, mappedRows);
  }

  return {
    total_in_feishu: records.length,
    synced: syncedCount,
    mode: syncType.insertOnly ? "insert_only" : "upsert",
  };
}

// ============================================
// 主入口
// ============================================

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const appId = Deno.env.get("FEISHU_APP_ID");
    const appSecret = Deno.env.get("FEISHU_APP_SECRET");
    const appToken = Deno.env.get("FEISHU_BITABLE_APP_TOKEN");
    const authToken = Deno.env.get("SYNC_AUTH_TOKEN");

    if (!appId || !appSecret || !appToken) {
      return json(
        { ok: false, error: "缺少飞书环境变量配置（FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_BITABLE_APP_TOKEN）" },
        500,
      );
    }

    // 解析请求
    const body = await req.json().catch(() => ({}));

    // 飞书事件订阅验证
    if (body.type === "url_verification" && body.challenge) {
      return json({ challenge: body.challenge });
    }

    // 鉴权
    const authHeader = req.headers.get("authorization") || "";
    const isFeishuWebhook = req.headers.get("x-lark-request-timestamp") !== null;
    const isManualTrigger = authToken && authHeader.replace("Bearer ", "") === authToken;

    if (!isFeishuWebhook && !isManualTrigger) {
      return json({ ok: false, error: "未授权" }, 401);
    }

    // 确定要同步的类型
    // action: 'sync_patterns' | 'sync_schedule' | 'sync_ranking' | 'sync_presale' | 'sync_all'
    // 默认 'sync_all'（飞书 webhook 触发时全量同步）
    // 向后兼容：action='sync' 也视为花色素材同步
    const action = body.action || "sync_all";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 获取飞书 token
    const token = await getTenantAccessToken(appId, appSecret);

    // 确定要执行的同步类型列表
    let typesToSync: string[];
    if (action === "sync_all") {
      typesToSync = Object.keys(SYNC_TYPES);
    } else if (action === "sync" || action === "sync_patterns") {
      typesToSync = ["patterns"];
    } else if (action === "sync_schedule") {
      typesToSync = ["schedule"];
    } else if (action === "sync_ranking") {
      typesToSync = ["ranking"];
    } else if (action === "sync_presale") {
      typesToSync = ["presale"];
    } else {
      return json({ ok: false, error: `未知的 action: ${action}` }, 400);
    }

    // 依次执行同步
    const results: Record<string, unknown> = {};

    for (const typeKey of typesToSync) {
      const syncType = SYNC_TYPES[typeKey];
      const tableId = Deno.env.get(syncType.tableIdEnv);

      if (!tableId) {
        console.log(`${syncType.name}: 未配置 ${syncType.tableIdEnv}，跳过`);
        results[typeKey] = { skipped: true, reason: `未配置 ${syncType.tableIdEnv}` };
        continue;
      }

      try {
        console.log(`开始同步 ${syncType.name}...`);
        const result = await doSync(syncType, token, appToken, tableId, supabaseUrl, serviceKey);
        results[typeKey] = result;
      } catch (err) {
        console.error(`${syncType.name} 同步失败:`, err);
        results[typeKey] = { error: err.message || String(err) };
      }
    }

    const result = {
      ok: true,
      message: "同步完成",
      results,
      timestamp: new Date().toISOString(),
    };
    console.log("同步结果:", JSON.stringify(result));

    return json(result);
  } catch (err) {
    console.error("同步异常:", err);
    return json(
      { ok: false, error: err.message || String(err) },
      500,
    );
  }
});
