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
  // type 有 NOT NULL 约束：飞书没填抛型时给空串，避免整批插入失败
  const row: Record<string, unknown> = {
    name: fieldValue(f["花色名称"]),
    brand: fieldValue(f["品牌"]),
    type: fieldValue(f["抛型"]) || "",
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

// ============================================================
// 排班表 · 直读飞书电子表格（Sheets API）
// 之所以不走多维表格：排班是普通电子表格，组别/姓名/1~31日 的横向版式，
// 运营随时手改，原表不动、工作台只读，改完 30 分钟内自动同步。
// ============================================================
const SHEETS_V1 = "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets";
const SHEETS_V3 = "https://open.feishu.cn/open-apis/sheets/v3/spreadsheets";

// 解析飞书文档链接：支持 /sheets/xxx、/wiki/xxx?sheet=yyy、/base/xxx、纯 token
type SheetRef = { kind: "sheets" | "wiki" | "base" | "token"; token: string; sheetParam: string };

function parseSheetUrl(raw: string): SheetRef {
  const s = String(raw || "").trim();
  const sheetParam = (s.match(/[?&]sheet=([A-Za-z0-9_-]+)/) || [])[1] || "";
  let m = s.match(/\/wiki\/([A-Za-z0-9]{10,})/);
  if (m) return { kind: "wiki", token: m[1], sheetParam };
  m = s.match(/\/sheets\/([A-Za-z0-9]{10,})/);
  if (m) return { kind: "sheets", token: m[1], sheetParam };
  m = s.match(/\/base\/([A-Za-z0-9]{10,})/);
  if (m) return { kind: "base", token: m[1], sheetParam };
  if (/^[A-Za-z0-9]{10,}$/.test(s)) return { kind: "token", token: s, sheetParam };
  return { kind: "token", token: "", sheetParam };
}

// 旧的简易版（保留给别处调用）
function extractSpreadsheetToken(raw: string): string {
  return parseSheetUrl(raw).token;
}

// wiki 节点 → 真实文档 token
async function resolveWikiNode(token: string, wikiToken: string) {
  const data = await feishuJson(
    `${FEISHU_BASE}/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`,
    token,
  );
  const node = (data?.node || data) as Record<string, unknown>;
  return {
    objToken: String(node?.obj_token || ""),
    objType: String(node?.obj_type || ""),
    title: String(node?.title || ""),
  };
}

function feishuErrHint(code: number): string {
  // 91403 / 1770002 / 99991672 等基本都是"应用没有这份文档的权限"
  if ([91403, 1770002, 99991672, 99991663, 1061004].includes(code)) {
    return "（应用读不到这份表格：请在飞书表格右上角「分享」→ 添加协作者，搜索应用名并给「可阅读」权限；或把表格设为「组织内获得链接可阅读」）";
  }
  return "";
}

async function feishuJson(url: string, token: string, init?: RequestInit) {
  const resp = await fetch(url, {
    ...(init || {}),
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...((init && init.headers) || {}),
    },
  });
  const data = await resp.json().catch(() => ({}));
  if (data.code !== 0) {
    throw new Error(
      `飞书接口失败(${data.code}): ${data.msg || "HTTP " + resp.status}${feishuErrHint(Number(data.code))}`,
    );
  }
  return data.data;
}

async function listSheets(token: string, ssToken: string) {
  const data = await feishuJson(`${SHEETS_V3}/${ssToken}/sheets/query`, token);
  return (data?.sheets || []) as Array<Record<string, unknown>>;
}

async function readSheetValues(token: string, ssToken: string, range: string) {
  const url = `${SHEETS_V1}/${ssToken}/values/${encodeURI(range)}` +
    `?valueRenderOption=ToString&dateTimeRenderOption=FormattedString`;
  const data = await feishuJson(url, token);
  const vr = (data?.valueRange || {}) as Record<string, unknown>;
  return (vr.values || []) as unknown[][];
}

function colLetter(n: number): string {
  let s = "";
  let x = Math.max(1, Math.floor(n));
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (Array.isArray(v)) return v.map(cellStr).join("").trim();
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.text !== undefined) return String(o.text).trim();
    if (o.value !== undefined) return cellStr(o.value);
  }
  return String(v).trim();
}

const NAME_HEADER_RE = /^(姓名|名字|人员|客服|客服姓名)$/;
// 统计行/图例行不是人：「周末早」「早」「中」「晚」「休」这些都在表尾
const SKIP_NAME_RE = /^(合计|小计|总计|备注|说明|注|组长|组别|早|中|晚|休|班|调|调休|周末早|周末晚|早班|中班|晚班|统计)$/;
// 「分流-小雪」这种把组别写在名字里的，拆出来
const SPLIT_GROUP_RE = /^(分流|售前[A-Za-z]?组?|售后[A-Za-z]?组?|机动|支援)\s*[-－—]\s*(.+)$/;

// 「售前A组」→「A组」，和库里既有口径保持一致
function normGroup(g: string): string {
  return String(g || "").trim().replace(/^售前\s*/, "");
}

// 公式行（COUNTIFS 统计）要跳过：valueRenderOption=ToString 会把公式原文读出来
function isFormulaRow(row: unknown[]): boolean {
  return row.some((c) => {
    const s = cellStr(c);
    return s.startsWith("=") || s.includes("COUNTIFS(") || s.includes("SUM(");
  });
}

// 纵向版式兜底：第一列是 1..31 日，表头一行是各人姓名
function tryVerticalSheet(values: unknown[][]) {
  const dayRows: Array<{ row: number; day: number }> = [];
  for (let i = 0; i < values.length; i++) {
    const t = cellStr((values[i] || [])[0]).replace(/[日号\s]/g, "");
    if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      if (n >= 1 && n <= 31) dayRows.push({ row: i, day: n });
    }
  }
  if (dayRows.length < 15) return null;
  const headerRowIdx = dayRows[0].row - 1;
  if (headerRowIdx < 0) return null;
  const namesRow = (values[headerRowIdx] || []).map(cellStr);
  const cols: Array<{ col: number; name: string }> = [];
  for (let c = 1; c < namesRow.length; c++) {
    const nm = namesRow[c];
    if (!nm || SKIP_NAME_RE.test(nm) || /^(日期|日|星期|班次)/.test(nm)) continue;
    cols.push({ col: c, name: nm });
  }
  if (cols.length < 2) return null;

  const map = new Map<string, Record<string, string>>();
  cols.forEach((c) => map.set(c.name, {}));
  for (const dr of dayRows) {
    const row = values[dr.row] || [];
    for (const c of cols) {
      const v = cellStr(row[c.col]);
      if (v) map.get(c.name)![String(dr.day)] = v;
    }
  }
  const rows = cols
    .map((c) => ({ group_name: "", staff_name: c.name, schedule: map.get(c.name)! }))
    .filter((r) => Object.keys(r.schedule).length > 0);
  if (!rows.length) return null;
  return { rows, headerIdx: headerRowIdx, headerRow: namesRow, dayColCount: dayRows.length, layout: "vertical" };
}

// 解析排班表：优先横向（组别 | 姓名 | 1日 … 31日），认不出再试纵向
export function parseScheduleSheet(values: unknown[][]) {
  // 1) 找表头行（含「姓名」）
  let headerIdx = -1;
  for (let i = 0; i < Math.min(values.length, 12); i++) {
    const row = values[i] || [];
    if (row.some((c) => NAME_HEADER_RE.test(cellStr(c)))) { headerIdx = i; break; }
  }
  if (headerIdx < 0) {
    const v = tryVerticalSheet(values);
    if (v) return v;
    throw new Error("没找到「姓名」表头行，也认不出纵向版式（表头里要有「姓名」列）");
  }

  const headerRow = (values[headerIdx] || []).map(cellStr);
  let nameCol = headerRow.findIndex((c) => NAME_HEADER_RE.test(c));
  if (nameCol < 0) nameCol = 1;
  const groupCol = nameCol > 0 ? nameCol - 1 : -1;

  const pickDays = (arr: string[]) => {
    const out: Array<{ col: number; day: number }> = [];
    for (let c = 0; c < arr.length; c++) {
      const t = (arr[c] || "").replace(/[日号\s]/g, "");
      if (/^\d+$/.test(t)) {
        const n = parseInt(t, 10);
        if (n >= 1 && n <= 31) out.push({ col: c, day: n });
      }
    }
    return out;
  };

  // 2) 日期列：优先表头上方那行 "1,2,3…"，其次表头自己写 "1日 2日…"
  let dayCols = headerIdx > 0 ? pickDays((values[headerIdx - 1] || []).map(cellStr)) : [];
  if (dayCols.length < 15) dayCols = pickDays(headerRow);
  if (dayCols.length < 15) {
    const v = tryVerticalSheet(values);
    if (v) return v;
    // 最后兜底：姓名列右边依次当 1..N 日
    dayCols = [];
    const maxCol = Math.max(headerRow.length, (values[headerIdx + 1] || []).length, nameCol + 31);
    for (let c = nameCol + 1; c <= maxCol; c++) dayCols.push({ col: c, day: c - nameCol });
  }

  // 3) 数据行
  const rows: Array<{ group_name: string; staff_name: string; schedule: Record<string, string> }> = [];
  let group = "";
  for (let i = headerIdx + 1; i < values.length; i++) {
    const row = values[i] || [];
    if (isFormulaRow(row)) continue;
    const g = groupCol >= 0 ? cellStr(row[groupCol]) : "";
    let nm = cellStr(row[nameCol]);
    if (g) group = g;
    if (!nm || SKIP_NAME_RE.test(nm)) continue;

    // 「分流-小雪」→ 组别=分流，姓名=小雪
    let rowGroup = group;
    const sm = nm.match(SPLIT_GROUP_RE);
    if (sm) { rowGroup = sm[1]; nm = sm[2].trim(); }
    if (!nm) continue;

    const schedule: Record<string, string> = {};
    for (const dc of dayCols) {
      const v = cellStr(row[dc.col]);
      if (v) schedule[String(dc.day)] = v;
    }
    if (Object.keys(schedule).length === 0) continue;
    // 同名去重（合并单元格重复渲染时可能出现两条）
    if (rows.some((r) => r.staff_name === nm)) continue;
    rows.push({ group_name: normGroup(rowGroup), staff_name: nm, schedule });
  }

  if (rows.length === 0) throw new Error("表头找到了，但没解析到任何人的排班（检查姓名是否在「姓名」列下方）");
  return { rows, headerIdx, headerRow, dayColCount: dayCols.length, layout: "horizontal" };
}

// 从表格标题/前几行里猜月份：2026年11月 / 11月 / 2026-11
function detectMonth(values: unknown[][], sheetTitle: string): string {
  const texts: string[] = [String(sheetTitle || "")];
  for (let i = 0; i < Math.min(values.length, 4); i++) {
    (values[i] || []).slice(0, 10).forEach((c) => texts.push(cellStr(c)));
  }
  for (const t of texts) {
    let m = t.match(/(20\d{2})\s*[年\-\/.]\s*(\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}`;
  }
  for (const t of texts) {
    const m = t.match(/(\d{1,2})\s*月/);
    if (m) {
      const mm = parseInt(m[1], 10);
      if (mm >= 1 && mm <= 12) {
        const y = new Date().getFullYear();
        return `${y}-${String(mm).padStart(2, "0")}`;
      }
    }
  }
  return "";
}

function currentMonthKey(): string {
  // 用东八区算"现在是几月"
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function stableJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj ?? null);
  if (Array.isArray(obj)) return `[${obj.map(stableJson).join(",")}]`;
  const o = obj as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(",")}}`;
}

async function sbGet(url: string, serviceKey: string) {
  const resp = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  return await resp.json().catch(() => null);
}

async function sbWrite(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  method: string,
  body?: unknown,
  upsert = false,
) {
  // ⚠️ PostgREST 的 on_conflict 参数必须配合 Prefer: resolution=merge-duplicates 才生效，
  // 光带 on_conflict 会当普通 INSERT 处理 → 撞唯一键 23505
  const prefer = upsert
    ? "resolution=merge-duplicates,return=representation"
    : "return=representation";
  const resp = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!resp.ok) throw new Error(`${method} ${path} 失败: ${await resp.text()}`);
  return await resp.json().catch(() => null);
}

// 把同步结果记到 sync_config，前端显示"上次同步时间"
// 失败时保留上一次的 last_ok_at（前端据此判断"偶发失败，下轮自动重试"还是"持续失败"）
async function saveScheduleStatus(
  supabaseUrl: string,
  serviceKey: string,
  status: Record<string, unknown>,
): Promise<string | null> {
  try {
    let prev: Record<string, unknown> = {};
    try {
      const arr = await sbGet(
        `${supabaseUrl}/rest/v1/sync_config?key=eq.schedule_sheet_status&select=value`,
        serviceKey,
      );
      if (Array.isArray(arr) && arr[0]?.value) prev = arr[0].value as Record<string, unknown>;
    } catch (_) { /* 读不到就当没有 */ }

    const merged: Record<string, unknown> = { ...prev, ...status };
    if (status.ok === true) {
      merged.last_ok_at = status.at;
      delete merged.error; // 成功后清掉历史报错，避免误导
    }
    await sbWrite(supabaseUrl, serviceKey, "sync_config?on_conflict=key", "POST", [{
      key: "schedule_sheet_status",
      value: merged,
      note: "排班表最近一次同步结果",
    }], true);
    return null;
  } catch (e) {
    console.warn("写同步状态失败（不影响同步）:", e);
    return e.message || String(e);
  }
}

async function syncScheduleFromSheet(
  token: string,
  supabaseUrl: string,
  serviceKey: string,
  override: Record<string, unknown> = {},
  dryRun = false,
) {
  // 1) 配置：请求体 > sync_config 表 > 环境变量
  let cfg: Record<string, unknown> = {};
  try {
    const arr = await sbGet(
      `${supabaseUrl}/rest/v1/sync_config?key=eq.schedule_sheet&select=value`,
      serviceKey,
    );
    if (Array.isArray(arr) && arr[0]?.value) cfg = arr[0].value as Record<string, unknown>;
  } catch (e) {
    console.warn("读 sync_config 失败:", e);
  }
  const merged: Record<string, unknown> = {
    ...cfg,
    ...(Deno.env.get("FEISHU_SCHEDULE_SHEET_URL")
      ? { url: Deno.env.get("FEISHU_SCHEDULE_SHEET_URL") }
      : {}),
    ...override,
  };

  // 2) 解析链接
  // 实测：飞书 wiki 里的电子表格，wiki 节点 token 可以直接当 spreadsheet_token 用，
  // 所以先直连；直连失败（比如换成了别的文档类型）再用 wiki 接口换真实 token。
  const ref = parseSheetUrl(String(merged.url || ""));
  if (!ref.token) {
    throw new Error("还没关联飞书排班表：请在「排班表」页点「🔗 关联飞书表格」，把飞书表格链接粘贴进去");
  }
  if (ref.kind === "base") {
    throw new Error("这是多维表格链接；排班表请贴「电子表格」的链接（地址栏里带 /sheets/ 或 /wiki/ 的那种）");
  }
  let ssToken = ref.token;
  let wikiTitle = "";

  // 3) 选工作表：优先指定表名 → 否则按「当月」找（26-11月 / 2026-11 / 11月）
  let sheets: Array<Record<string, unknown>> = [];
  try {
    sheets = await listSheets(token, ssToken);
  } catch (err) {
    if (ref.kind !== "wiki") throw err;
    const node = await resolveWikiNode(token, ref.token);
    wikiTitle = node.title;
    if (node.objType && node.objType !== "sheet") {
      throw new Error(`这条链接指向的是「${node.objType}」不是电子表格；请在飞书里打开排班表格本体再复制链接`);
    }
    if (!node.objToken) throw err;
    ssToken = node.objToken;
    sheets = await listSheets(token, ssToken);
  }
  if (!sheets.length) throw new Error("这份飞书表格里没有任何工作表");
  const wantSheet = String(merged.sheet_name || "").trim();
  const monthWanted = String(merged.month_key || "").trim() || currentMonthKey();
  const [yearStr, monStr] = monthWanted.split("-");
  const mm = parseInt(monStr || "0", 10);
  const yy = yearStr ? parseInt(yearStr.slice(-2), 10) : 0;

  // 表名打分：越精确越优先
  // "2026-11"/"2026年11月"=2 分，"26-11月"/"26年-11月"=1.5 分，光写"11月"=1 分
  // 这样 12 月新增了「26-12月」后，不会误选到去年的「12月」
  const titleMonthScore = (title: string) => {
    const t = String(title || "").replace(/\s/g, "");
    if (!t || mm < 1 || mm > 12) return 0;
    if (t.includes(`${yearStr}-${monStr}`) || t.includes(`${yearStr}年${mm}月`)) return 2;
    if (yy && new RegExp(`${yy}[^0-9]{0,3}${mm}月`).test(t)) return 1.5;
    if (new RegExp(`(^|[^0-9])${mm}月`).test(t)) return 1;
    return 0;
  };

  let sheet: Record<string, unknown> | undefined;
  if (wantSheet) sheet = sheets.find((s) => String(s.title || "").trim() === wantSheet);
  if (!sheet) {
    let best = 0;
    for (const s of sheets) {
      const sc = titleMonthScore(String(s.title || ""));
      if (sc > best) { best = sc; sheet = s; }
    }
  }
  if (!sheet && ref.sheetParam) sheet = sheets.find((s) => String(s.sheet_id) === ref.sheetParam);
  if (!sheet) sheet = sheets[0];

  const sheetId = String(sheet.sheet_id);
  const sheetTitle = String(sheet.title || "");
  const gp = (sheet.grid_properties || {}) as Record<string, number>;
  const rowCount = Math.min(Math.max(Number(gp.row_count || 80), 20), 300);
  const colCount = Math.min(Math.max(Number(gp.column_count || 35), 10), 60);
  const range = `${sheetId}!A1:${colLetter(colCount)}${rowCount}`;

  // 3) 读值 + 解析
  const values = await readSheetValues(token, ssToken, range);
  const parsed = parseScheduleSheet(values);

  const monthKey = String(merged.month_key || "").trim()
    || detectMonth(values, sheetTitle)
    || monthWanted;
  const monthMatched = titleMonthScore(sheetTitle) > 0 || monthKey === monthWanted;

  // 4) 对比已有数据，只写有变化的（避免每 30 分钟无谓写库）
  const existing = (await sbGet(
    `${supabaseUrl}/rest/v1/schedule_data?month_key=eq.${encodeURIComponent(monthKey)}` +
    `&select=staff_name,group_name,schedule`,
    serviceKey,
  ) || []) as Array<Record<string, unknown>>;
  const exMap = new Map(existing.map((r) => [String(r.staff_name), r]));

  const toWrite: Array<Record<string, unknown>> = [];
  const changesPreview: Array<Record<string, unknown>> = [];
  let unchanged = 0;
  let newCount = 0;
  for (const row of parsed.rows) {
    const cur = exMap.get(row.staff_name);
    if (!cur) newCount++;
    const same = !!cur &&
      String(cur.group_name || "") === row.group_name &&
      stableJson(cur.schedule) === stableJson(row.schedule);
    if (same) { unchanged++; continue; }

    if (cur && changesPreview.length < 6) {
      const oldSc = (cur.schedule || {}) as Record<string, string>;
      const diff: string[] = [];
      const keys = new Set([...Object.keys(oldSc), ...Object.keys(row.schedule)]);
      for (const k of Array.from(keys).sort((a, b) => Number(a) - Number(b))) {
        if ((oldSc[k] || "") !== (row.schedule[k] || "")) {
          diff.push(`${k}日:${oldSc[k] || "空"}→${row.schedule[k] || "空"}`);
        }
        if (diff.length >= 5) break;
      }
      if (String(cur.group_name || "") !== row.group_name) {
        diff.unshift(`组别:${cur.group_name || "空"}→${row.group_name || "空"}`);
      }
      changesPreview.push({ name: row.staff_name, diff });
    }

    toWrite.push({
      month_key: monthKey,
      staff_name: row.staff_name,
      group_name: row.group_name,
      schedule: row.schedule,
    });
  }

  // 5) 飞书里已删掉的人（清理要保守：解析人数至少 10 且不少于原有的 80%）
  const names = new Set(parsed.rows.map((r) => r.staff_name));
  const stale = existing.filter((r) => !names.has(String(r.staff_name)));
  const guard = parsed.rows.length >= Math.max(10, Math.ceil(existing.length * 0.8));
  const doCleanup = merged.cleanup !== false && guard;

  let removed = 0;
  if (!dryRun && toWrite.length > 0) {
    await supabaseUpsert(supabaseUrl, serviceKey, "schedule_data", toWrite, "month_key,staff_name");
  }
  if (!dryRun && doCleanup) {
    for (const s of stale) {
      await sbWrite(
        supabaseUrl,
        serviceKey,
        `schedule_data?month_key=eq.${encodeURIComponent(monthKey)}` +
        `&staff_name=eq.${encodeURIComponent(String(s.staff_name))}`,
        "DELETE",
      );
      removed++;
    }
  }

  const result = {
    month_key: monthKey,
    month_matched: monthMatched,
    sheet_title: sheetTitle,
    wiki_title: wikiTitle,
    layout: parsed.layout,
    sheet_names: sheets.map((s) => String(s.title || "")),
    range,
    total_in_feishu: parsed.rows.length,
    added: newCount,
    changed: toWrite.length,
    unchanged,
    removed: dryRun ? stale.length : removed,
    stale_pending: doCleanup ? 0 : stale.length,
    staff: parsed.rows.map((r) => `${r.group_name ? r.group_name + "/" : ""}${r.staff_name}`),
    dry_run: dryRun,
    changes_preview: changesPreview,
    head: parsed.rows.slice(0, 3).map((r) => ({
      name: r.staff_name,
      group: r.group_name,
      days: Object.keys(r.schedule).length,
      d1: r.schedule["1"] || "",
      d2: r.schedule["2"] || "",
    })),
  };

  if (!dryRun) {
    const statusErr = await saveScheduleStatus(supabaseUrl, serviceKey, {
      at: new Date().toISOString(),
      month_key: monthKey,
      sheet_title: sheetTitle,
      staff_count: parsed.rows.length,
      changed: toWrite.length,
      removed,
      ok: true,
    });
    if (statusErr) (result as Record<string, unknown>).status_write_error = statusErr;
  }

  console.log("排班表同步结果:", JSON.stringify({ ...result, staff: result.staff.length }));
  return result;
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

// 对已有花色同步飞书内容（飞书是数据源，以飞书为准覆盖）
// - 规格字段（抛型/系列/色系/直径/基弧/定轴/着色直径/材质/氧透率/含水量/规格/推荐话术）：飞书有值 → 覆盖；飞书为空 → 保留本地
// - 图片数组：始终以飞书为准
// - 本地专属字段（价格档/直径组/排序/下架标记等）不动
async function fillEmptyPatternFields(
  supabaseUrl: string,
  serviceKey: string,
  rawRecords: Record<string, unknown>[],
  mappedRows: Record<string, unknown>[],
): Promise<{ checked: number; filled: number; fields: number }> {
  if (mappedRows.length === 0) return { checked: 0, filled: 0, fields: 0 };

  const fillableDbFields = [
    "type", "series", "color", "diameter", "base_curve", "fixed_axis",
    "color_diameter", "material", "oxygen", "water", "spec", "description",
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
      const isFsValue = fsVal !== null && fsVal !== undefined && fsVal !== "" &&
        !(Array.isArray(fsVal) && fsVal.length === 0);
      // 飞书有值且与本地不同 → 以飞书为准覆盖（含原本为空的补录）
      if (isFsValue && JSON.stringify(fsVal) !== JSON.stringify(dbVal)) {
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
      console.log(`同步 ${name} 字段变更:`, Object.keys(updates).join(","));
    } else {
      console.error(`同步 ${name} 失败:`, await patchResp.text());
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

    if (!appId || !appSecret) {
      return json(
        { ok: false, error: "缺少飞书环境变量配置（FEISHU_APP_ID / FEISHU_APP_SECRET）" },
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

    // ★ 排班表：直读飞书电子表格（不走多维表格）
    // action = 'sync_schedule_sheet'，body.config 可临时覆盖链接/工作表/月份，body.dry_run = 只读不写
    if (action === "sync_schedule_sheet") {
      try {
        const result = await syncScheduleFromSheet(
          token,
          supabaseUrl,
          serviceKey,
          (body.config || {}) as Record<string, unknown>,
          body.dry_run === true,
        );
        return json({
          ok: true,
          message: body.dry_run ? "试读成功（未写入）" : "排班同步完成",
          results: { schedule: result },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("排班表（电子表格）同步失败:", err);
        await saveScheduleStatus(supabaseUrl, serviceKey, {
          at: new Date().toISOString(),
          ok: false,
          error: err.message || String(err),
        });
        return json({
          ok: false,
          error: err.message || String(err),
          results: { schedule: { error: err.message || String(err) } },
        });
      }
    }

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

      if (!appToken) {
        console.log(`${syncType.name}: 未配置 FEISHU_BITABLE_APP_TOKEN，跳过`);
        results[typeKey] = { skipped: true, reason: "未配置 FEISHU_BITABLE_APP_TOKEN" };
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
