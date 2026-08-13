// ============================================
// 飞书多维表格 → Supabase 多表同步 Edge Function
// ============================================
// 功能：
//   1. 手动触发同步（工作台「从飞书同步」按钮调用）
//   2. 接收飞书事件订阅 webhook（自动同步）
//   3. 支持五种数据表同步：
//      - patterns     花色素材 → pattern_assets
//      - schedule     排班表   → schedule_data
//      - ranking      客服排名 → ranking_data
//      - presale      售前月度 → presale_monthly
//      - cross_sales  连带成交 → cross_sales
//
// 环境变量（在 Supabase Dashboard → Edge Functions → Secrets 中配置）：
//   FEISHU_APP_ID                  飞书自建应用 App ID
//   FEISHU_APP_SECRET              飞书自建应用 App Secret
//   FEISHU_BITABLE_APP_TOKEN       多维表格 app_token（URL 中 /base/ 后面的部分）
//   FEISHU_PATTERN_TABLE_ID        花色素材 table_id
//   FEISHU_SCHEDULE_TABLE_ID       排班表 table_id
//   FEISHU_RANKING_TABLE_ID        客服排名 table_id
//   FEISHU_PRESALE_TABLE_ID        售前月度 table_id
//   FEISHU_CROSS_SALES_TABLE_ID    连带成交 table_id
//   SYNC_AUTH_TOKEN                手动触发的鉴权 token
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
// 飞书附件字段处理
// ============================================

// 从飞书字段值中提取附件的 file_token（附件字段返回 [{file_token, name, type, size}]）
function extractFileToken(val: unknown): string | null {
  const tokens = extractAllFileTokens(val);
  return tokens.length > 0 ? tokens[0] : null;
}

// 从飞书字段值中提取所有附件的 file_token（支持一个字段含多张图片）
function extractAllFileTokens(val: unknown): string[] {
  if (!val) return [];
  if (typeof val === "string") return []; // 纯文本 URL，不是附件
  const tokens: string[] = [];
  if (Array.isArray(val)) {
    for (const item of val) {
      if (item && typeof item === "object") {
        const token = (item as Record<string, unknown>).file_token;
        if (token && typeof token === "string") tokens.push(token);
      }
    }
  } else if (typeof val === "object" && val !== null) {
    const token = (val as Record<string, unknown>).file_token;
    if (token && typeof token === "string") tokens.push(token);
  }
  return tokens;
}

// 从 content-type 获取文件扩展名
function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("bmp")) return "bmp";
  return "jpg"; // 默认 jpg
}

// 从飞书下载附件文件
async function downloadFeishuFile(
  token: string,
  fileToken: string,
): Promise<{ data: ArrayBuffer; contentType: string }> {
  const resp = await fetch(
    `${FEISHU_BASE}/drive/v1/medias/${fileToken}/download`,
    {
      headers: { "Authorization": `Bearer ${token}` },
    },
  );
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`下载飞书文件失败(${resp.status}): ${errText.slice(0, 200)}`);
  }
  const contentType = resp.headers.get("content-type") || "image/jpeg";
  const data = await resp.arrayBuffer();
  return { data, contentType };
}

// 上传文件到 Supabase Storage，返回公开 URL
async function uploadToStorage(
  supabaseUrl: string,
  serviceKey: string,
  bucket: string,
  path: string,
  fileData: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const resp = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": contentType,
      },
      body: fileData,
    },
  );
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`上传到 Storage 失败(${resp.status}): ${errText.slice(0, 200)}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

// 处理花色素材附件：从飞书下载图片 → 上传到 Supabase Storage → 填充 URL
async function processPatternAttachments(
  feishuToken: string,
  supabaseUrl: string,
  serviceKey: string,
  rawRecords: Record<string, unknown>[],
  mappedRows: Record<string, unknown>[],
): Promise<{ downloaded: number; failed: number }> {
  const BUCKET = "pattern-images";
  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < mappedRows.length; i++) {
    const row = mappedRows[i];
    const f = (rawRecords[i]?.fields || {}) as Record<string, unknown>;

    // 花色图（镜片图）：支持附件字段 "花色图" 或文本字段 "花色图URL"
    const lensTokens = extractAllFileTokens(f["花色图"]);
    if (lensTokens.length > 0) {
      const urls: string[] = [];
      for (const token of lensTokens) {
        try {
          const { data, contentType } = await downloadFeishuFile(feishuToken, token);
          const ext = extFromContentType(contentType);
          const path = `lens/${crypto.randomUUID()}.${ext}`;
          const url = await uploadToStorage(supabaseUrl, serviceKey, BUCKET, path, data, contentType);
          urls.push(url);
          downloaded++;
          console.log(`花色图下载成功: ${row.name} → ${path}`);
        } catch (e) {
          console.error(`花色图下载失败(${row.name}):`, e.message);
          failed++;
        }
      }
      if (urls.length > 0) {
        row.lens_img = urls[0];      // 兼容：第一张存 lens_img
        row.lens_imgs = urls;        // 所有花色图存 lens_imgs 数组
      }
    }

    // 上眼图：支持附件字段 "上眼图" 或文本字段 "上眼图URL"
    const eyeTokens = extractAllFileTokens(f["上眼图"]);
    if (eyeTokens.length > 0) {
      const urls: string[] = [];
      for (const token of eyeTokens) {
        try {
          const { data, contentType } = await downloadFeishuFile(feishuToken, token);
          const ext = extFromContentType(contentType);
          const path = `eye/${crypto.randomUUID()}.${ext}`;
          const url = await uploadToStorage(supabaseUrl, serviceKey, BUCKET, path, data, contentType);
          urls.push(url);
          downloaded++;
          console.log(`上眼图下载成功: ${row.name} → ${path}`);
        } catch (e) {
          console.error(`上眼图下载失败(${row.name}):`, e.message);
          failed++;
        }
      }
      if (urls.length > 0) {
        row.eye_img = urls[0];       // 兼容：第一张存 eye_img
        row.eye_imgs = urls;         // 所有上眼图存 eye_imgs 数组
      }
    }
  }

  return { downloaded, failed };
}

// ============================================
// 字段映射函数 - 每种表一个
// ============================================

// 花色素材 → pattern_assets
// 空值字段不写入，避免覆盖数据库已有数据（如图片URL）
// 图片字段支持两种模式：
//   1. 附件字段（"花色图"/"上眼图"）→ 同步时自动下载上传到 Supabase Storage
//   2. 文本字段（"花色图URL"/"上眼图URL"）→ 直接使用 URL
function mapPatternRecord(record: Record<string, unknown>) {
  const f = (record.fields || {}) as Record<string, unknown>;

  // name 和 brand 是 upsert 冲突键，必须包含
  // is_discontinued 有 NOT NULL 约束，新记录默认 false
  const row: Record<string, unknown> = {
    name: fieldValue(f["花色名称"]),
    brand: fieldValue(f["品牌"]),
    feishu_record_id: String(record.record_id || ""),
    is_discontinued: false,
  };

  // 以下字段：飞书有值才写入，空值不覆盖数据库已有数据
  const optionalFields: [string, string][] = [
    ["type", "抛型"],
    ["series", "系列"],
    ["color", "色系"],
    ["diameter", "直径"],
    ["base_curve", "基弧"],
    ["fixed_axis", "定轴"],
    ["color_diameter", "着色直径"],
    ["material", "材质"],
    ["oxygen", "氧透率"],
    ["water", "含水量"],
    ["spec", "规格"],
    ["description", "推荐话术"],
  ];

  for (const [dbField, feishuField] of optionalFields) {
    const val = fieldValue(f[feishuField]);
    if (val) row[dbField] = val;
  }

  // 话术字段别名：飞书里可能是"描述话术"也可能是"推荐话术"
  const descVal = fieldValue(f["描述话术"]) || fieldValue(f["推荐话术"]);
  if (descVal) row.description = descVal;

  // 图片字段：优先检查是否为附件（附件由 processPatternAttachments 处理）
  // 如果不是附件，检查是否为文本 URL
  const lensVal = f["花色图"] || f["花色图URL"];
  if (lensVal && !extractFileToken(lensVal)) {
    const lensUrl = fieldValue(lensVal);
    if (lensUrl) row.lens_img = lensUrl;
  }

  const eyeVal = f["上眼图"] || f["上眼图URL"];
  if (eyeVal && !extractFileToken(eyeVal)) {
    const eyeUrl = fieldValue(eyeVal);
    if (eyeUrl) row.eye_img = eyeUrl;
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

// 连带成交登记 → cross_sales
// 飞书日期字段可能是纯文本（如 "8.1"）、date 类型或 ISO 时间戳，这里做兼容解析
function parseRecordDate(val: unknown): string {
  const s = fieldValue(val).trim();
  if (!s) return "";
  // 已经是 YYYY-MM-DD 格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // 2026/08/12 或 2026.08.12 格式
  const slash = s.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
  if (slash) {
    return `${slash[1]}-${String(slash[2]).padStart(2, "0")}-${String(slash[3]).padStart(2, "0")}`;
  }
  // 兼容 "8.1" / "8月1日" / "8/1" 等格式，默认当年
  const year = new Date().getFullYear();
  const m = s.match(/(\d{1,2})\s*[.\/月]\s*(\d{1,2})/);
  if (m) {
    const month = String(m[1]).padStart(2, "0");
    const day = String(m[2]).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  // ISO 时间戳（如 2026-08-12T00:00:00.000Z）取日期部分
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) {
    return iso.toISOString().slice(0, 10);
  }
  return "";
}

function mapCrossSalesRecord(record: Record<string, unknown>) {
  const f = (record.fields || {}) as Record<string, unknown>;
  const recordDate = parseRecordDate(f["日期"]);
  const firstAmount = numValue(f["第一单金额"]);
  const secondAmount = numValue(f["第二单金额"]);
  return {
    record_date: recordDate,
    shop: fieldValue(f["店铺"]),
    staff_name: fieldValue(f["成交客服"]),
    product_type: fieldValue(f["产品类型"]),
    first_order_no: fieldValue(f["第一单订单号"]),
    second_order_no: fieldValue(f["第二单订单号"]),
    first_order_status: fieldValue(f["第一单状态"]),
    first_amount: firstAmount,
    second_amount: secondAmount,
    total_amount: numValue(f["合计金额"]) || (firstAmount + secondAmount),
    qc_confirmed: boolValue(f["质检确认"]),
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

// 对已有花色补录空字段（不覆盖任何已有数据）
// 只在 insertOnly 模式下使用：新记录插入完成后，已有记录中原本为空的字段可以用飞书值填充
async function fillEmptyPatternFields(
  supabaseUrl: string,
  serviceKey: string,
  rawRecords: Record<string, unknown>[],
  mappedRows: Record<string, unknown>[],
): Promise<{ checked: number; filled: number; fields: number }> {
  if (mappedRows.length === 0) return { checked: 0, filled: 0, fields: 0 };

  // 用于补录的字段（原始图片URL、下架标记、创建时间永远不碰）
  // lens_imgs/eye_imgs 可补录：已有花色首次同步时没多图，后续补充后可补上
  const fillableDbFields = [
    "type", "series", "color", "diameter", "base_curve", "fixed_axis",
    "color_diameter", "material", "oxygen", "water", "spec", "description",
    "lens_imgs", "eye_imgs",
  ];

  // 按 (name, brand) 查询已存在的记录
  const names = mappedRows.map((r) => r.name).filter(Boolean) as string[];
  const brands = mappedRows.map((r) => r.brand).filter(Boolean) as string[];
  const uniqueNames = [...new Set(names)].map((v) => encodeURIComponent(v)).join(",");
  const uniqueBrands = [...new Set(brands)].map((v) => encodeURIComponent(v)).join(",");

  const query = `${supabaseUrl}/rest/v1/pattern_assets?name=in.(${uniqueNames})&brand=in.(${uniqueBrands})&select=*`;
  const resp = await fetch(query, {
    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
  });
  if (!resp.ok) {
    console.error("查询已有花色失败:", await resp.text());
    return { checked: 0, filled: 0, fields: 0 };
  }
  const existingRecords = (await resp.json()) as Record<string, unknown>[];

  let filledCount = 0;
  let fieldCount = 0;

  for (const existing of existingRecords) {
    const name = existing.name;
    const brand = existing.brand;
    if (!name || !brand) continue;

    // 找到对应的飞书记录
    const idx = mappedRows.findIndex((r) => r.name === name && r.brand === brand);
    if (idx < 0) continue;
    const mapped = mappedRows[idx];

    const updates: Record<string, unknown> = {};
    for (const field of fillableDbFields) {
      const dbVal = existing[field];
      const fsVal = mapped[field];
      const isDbEmpty = dbVal === null || dbVal === undefined || dbVal === "" ||
        (Array.isArray(dbVal) && dbVal.length === 0);
      const isFsValue = fsVal !== null && fsVal !== undefined && fsVal !== "" &&
        !(Array.isArray(fsVal) && fsVal.length === 0);
      if (isDbEmpty && isFsValue) {
        updates[field] = fsVal;
        fieldCount++;
      }
    }

    if (Object.keys(updates).length === 0) continue;

    const id = existing.id;
    const patchResp = await fetch(
      `${supabaseUrl}/rest/v1/pattern_assets?id=eq.${id}`,
      {
        method: "PATCH",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(updates),
      },
    );
    if (patchResp.ok) {
      filledCount++;
      console.log(`补录 ${name} 字段:`, Object.keys(updates).join(","));
    } else {
      console.error(`补录 ${name} 失败:`, await patchResp.text());
    }
  }

  return { checked: existingRecords.length, filled: filledCount, fields: fieldCount };
}

// 对已有花色同步图片数组（始终覆盖，因为图片是飞书的源数据）
// insert-only 模式下，已有记录的图片不会被插入操作更新，需要单独 PATCH
// 解决场景：之前同步时只有1张上眼图，飞书后续加了第2张，需要覆盖更新
async function syncExistingPatternImages(
  supabaseUrl: string,
  serviceKey: string,
  mappedRows: Record<string, unknown>[],
): Promise<{ checked: number; updated: number }> {
  if (mappedRows.length === 0) return { checked: 0, updated: 0 };

  // 只处理有图片数据的行
  const rowsWithImages = mappedRows.filter(
    (r) => r.lens_imgs || r.eye_imgs || r.lens_img || r.eye_img,
  );
  if (rowsWithImages.length === 0) return { checked: 0, updated: 0 };

  const names = rowsWithImages.map((r) => r.name).filter(Boolean) as string[];
  const uniqueNames = [...new Set(names)].map((v) => encodeURIComponent(v)).join(",");
  const query = `${supabaseUrl}/rest/v1/pattern_assets?name=in.(${uniqueNames})&select=id,name,brand,lens_imgs,eye_imgs`;
  const resp = await fetch(query, {
    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
  });
  if (!resp.ok) {
    console.error("查询已有花色图片失败:", await resp.text());
    return { checked: 0, updated: 0 };
  }
  const existingRecords = (await resp.json()) as Record<string, unknown>[];

  let updatedCount = 0;

  for (const existing of existingRecords) {
    const name = existing.name;
    const brand = existing.brand;
    if (!name || !brand) continue;

    const idx = mappedRows.findIndex((r) => r.name === name && r.brand === brand);
    if (idx < 0) continue;
    const mapped = mappedRows[idx];

    // 比较图片数组是否需要更新
    const updates: Record<string, unknown> = {};
    const fsLensImgs = mapped.lens_imgs;
    const fsEyeImgs = mapped.eye_imgs;
    const dbLensImgs = existing.lens_imgs;
    const dbEyeImgs = existing.eye_imgs;

    // 如果飞书有 lens_imgs 且与数据库不同，更新
    if (Array.isArray(fsLensImgs) && fsLensImgs.length > 0) {
      const dbArr = Array.isArray(dbLensImgs) ? dbLensImgs : [];
      if (dbArr.length !== fsLensImgs.length ||
          JSON.stringify(dbArr) !== JSON.stringify(fsLensImgs)) {
        updates.lens_imgs = fsLensImgs;
        updates.lens_img = fsLensImgs[0]; // 兼容字段
      }
    }

    // 如果飞书有 eye_imgs 且与数据库不同，更新
    if (Array.isArray(fsEyeImgs) && fsEyeImgs.length > 0) {
      const dbArr = Array.isArray(dbEyeImgs) ? dbEyeImgs : [];
      if (dbArr.length !== fsEyeImgs.length ||
          JSON.stringify(dbArr) !== JSON.stringify(fsEyeImgs)) {
        updates.eye_imgs = fsEyeImgs;
        updates.eye_img = fsEyeImgs[0]; // 兼容字段
      }
    }

    if (Object.keys(updates).length === 0) continue;

    const id = existing.id;
    const patchResp = await fetch(
      `${supabaseUrl}/rest/v1/pattern_assets?id=eq.${id}`,
      {
        method: "PATCH",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(updates),
      },
    );
    if (patchResp.ok) {
      updatedCount++;
      console.log(`图片同步 ${name}:`, Object.keys(updates).join(","));
    } else {
      console.error(`图片同步 ${name} 失败:`, await patchResp.text());
    }
  }

  return { checked: existingRecords.length, updated: updatedCount };
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
  // upsert 前的异步处理（如下载飞书附件并上传到 Storage）
  preUpsertFn?: (
    feishuToken: string,
    supabaseUrl: string,
    serviceKey: string,
    rawRecords: Record<string, unknown>[],
    mappedRows: Record<string, unknown>[],
  ) => Promise<Record<string, unknown>>;
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
    // 下载飞书附件图片 → 上传到 Supabase Storage → 填充 URL
    preUpsertFn: async (feishuToken, supabaseUrl, serviceKey, rawRecords, mappedRows) => {
      return await processPatternAttachments(feishuToken, supabaseUrl, serviceKey, rawRecords, mappedRows);
    },
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
  cross_sales: {
    name: "连带成交",
    tableIdEnv: "FEISHU_CROSS_SALES_TABLE_ID",
    mapFn: mapCrossSalesRecord,
    supabaseTable: "cross_sales",
    // 去重键改为飞书记录ID（部分唯一索引仅对非空 feishu_record_id 生效），
    // 因此手工粘贴/登记产生的空 feishu_record_id 记录不受约束、可保留真正重复项；
    // 飞书同步的记录带唯一 feishu_record_id，重复同步时按ID忽略，不会产生多条。
    onConflict: "feishu_record_id",
    insertOnly: true,
    filterFn: (row) => !!row.record_date && !!row.staff_name,
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

  // upsert 前的异步处理（如下载飞书附件图片并上传到 Storage）
  let attachmentInfo: Record<string, unknown> | undefined;
  if (syncType.preUpsertFn) {
    console.log(`${syncType.name}: 处理附件...`);
    attachmentInfo = await syncType.preUpsertFn(token, supabaseUrl, serviceKey, records, mappedRows);
    console.log(`${syncType.name}: 附件处理完成`, JSON.stringify(attachmentInfo));
  }

  // 统一所有行的字段：PostgREST 批量插入要求所有对象 key 一致
  const allKeys = new Set<string>();
  mappedRows.forEach((r) => Object.keys(r).forEach((k) => allKeys.add(k)));
  const normalizedRows = mappedRows.map((r) => {
    const nr: Record<string, unknown> = {};
    allKeys.forEach((k) => { nr[k] = r[k] ?? null; });
    return nr;
  });

  const upserted = await supabaseUpsert(
    supabaseUrl,
    serviceKey,
    syncType.supabaseTable,
    normalizedRows,
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

  // insertOnly 模式下：已有记录虽不覆盖，但可以为空字段补录（如后续补充的描述话术）
  let fillInfo: Record<string, unknown> | undefined;
  if (syncType.insertOnly && syncType.supabaseTable === "pattern_assets") {
    console.log(`${syncType.name}: 检查已有记录的空字段...`);
    fillInfo = await fillEmptyPatternFields(supabaseUrl, serviceKey, records, mappedRows);
    console.log(`${syncType.name}: 补录完成`, JSON.stringify(fillInfo));

    // 图片数组始终用飞书最新数据覆盖（飞书附件是图片的源数据）
    console.log(`${syncType.name}: 同步已有记录的图片...`);
    const imgSyncInfo = await syncExistingPatternImages(supabaseUrl, serviceKey, mappedRows);
    console.log(`${syncType.name}: 图片同步完成`, JSON.stringify(imgSyncInfo));
  }

  return {
    total_in_feishu: records.length,
    synced: syncedCount,
    mode: syncType.insertOnly ? "insert_only" : "upsert",
    ...(attachmentInfo ? { attachments: attachmentInfo } : {}),
    ...(fillInfo ? { filled: fillInfo } : {}),
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
    } else if (action === "sync_cross_sales") {
      typesToSync = ["cross_sales"];
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
