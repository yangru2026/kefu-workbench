# -*- coding: utf-8 -*-
"""上传 18 张许可证图片到 Supabase Storage「licenses」桶，并生成 19 条 INSERT SQL。

流程：
  1) 解包 xlsx，按「公司/工厂 + 证件类型」去重出 18 张唯一图
  2) Pillow 压缩为 WebP（最长边 1600px, quality 85）
  3) 上传（带重试 + 断点续传：已存在且大小一致则跳过）
  4) 生成 add_licenses_data.sql（19 条 INSERT，含公开 URL）

用法：
  SUPABASE_SERVICE_KEY=<service_role key> python upload_licenses.py
"""
import io, json, os, sys, time, zipfile, requests
from PIL import Image

BASE = r"C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05"
XLSX = r"C:/Users/Administrator/Desktop/各店铺许可证收集(2).xlsx"
MAP = json.load(open(BASE + "/outputs/license_map.json", encoding="utf-8"))
SUPABASE_URL = "https://ienmejlxukhrxjjxvfqf.supabase.co"
BUCKET = "licenses"
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not KEY:
    sys.exit("缺少 SUPABASE_SERVICE_KEY 环境变量（Supabase Dashboard → Project Settings → API → service_role key）")

MAX_EDGE = 1600   # 最长边像素
QUALITY = 85      # WebP 质量

# ---------- 中文名 -> ASCII（Storage key 不支持中文） ----------
OWNER_ASCII = {
    "铜陵洛吟电子商务有限公司": "tongling-luoyin",
    "杭州涉吉电子商务有限公司": "hangzhou-sheji",
    "杭州沐曦电子商务有限公司": "hangzhou-muxi",
    "杭州呦吼贸易有限公司": "hangzhou-youhou",
    "杭州泷吟电子商务有限公司": "hangzhou-longyin",
    "杭州松沛电子商务有限公司": "hangzhou-songpei",
    "杭州尤赫电子商务有限公司": "hangzhou-youhe",
    "吉林瑞尔康": "jilin-ruierkang",
    "西安科诗美": "xian-keshimei",
    "陕西福蔻": "shaanxi-fukou",
    "江苏天眼": "jiangsu-tianyan",
}
TYPE_ASCII = {"经营许可证": "license", "营业执照": "business", "生产许可证": "production"}

def ascii_name(name: str, default: str = "other") -> str:
    return OWNER_ASCII.get(name, default)

z = zipfile.ZipFile(XLSX)
rows = MAP["rows"]
rid2media = MAP["rid2media"]
id2rid = MAP["id2rid"]

# ---------- 1) 向下填充 platform（合并单元格） ----------
last = ""
for r in rows:
    if (r["platform"] or "").strip():
        last = r["platform"].strip()
    else:
        r["platform"] = last

# ---------- 2) 汇总唯一图片：证件类型 -> (所属方, media) ----------
unique = {}
def add_unique(owner, type_, img_id):
    if not img_id:
        return
    rid = id2rid.get(img_id)
    if not rid:
        return
    media = rid2media.get(rid)
    if media:
        unique[(type_, owner)] = media

for r in rows:
    add_unique(r["company"], "经营许可证", r["license"])
    add_unique(r["company"], "营业执照", r["business"])
    if (r["factory"] or "").strip():
        add_unique(r["factory"], "生产许可证", r["production"])

print(f"待上传唯一图片：{len(unique)} 张（压缩后 WebP ≤{MAX_EDGE}px q{QUALITY}）")

# ---------- 3) 压缩 ----------
def compress(data: bytes) -> bytes:
    """PNG -> WebP（最长边 MAX_EDGE，白底），返回 bytes"""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = img.size
    scale = min(1.0, MAX_EDGE / max(w, h))
    if scale < 1.0:
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=QUALITY, method=6)
    return buf.getvalue()

compressed = {}   # media -> bytes
for (t, o), media in sorted(unique.items()):
    raw = z.read("xl/" + media)
    webp = compress(raw)
    compressed[media] = webp
    print(f"  {o} / {t}: {len(raw)//1024} KB -> {len(webp)//1024} KB")

# ---------- 4) 上传（重试 3 次 + 断点续传） ----------
headers = {"Authorization": "Bearer " + KEY, "apikey": KEY}
sess = requests.Session()
uploaded = {}
fail = 0

def object_exists(path: str) -> bool:
    """HEAD 探测对象是否存在（service key 可访问）"""
    try:
        r = sess.head(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
                      headers=headers, timeout=30)
        return r.status_code == 200
    except Exception:
        return False

for (t, o), media in sorted(unique.items()):
    path = f"{ascii_name(o)}/{TYPE_ASCII.get(t, 'doc')}.webp"
    data = compressed[media]
    if object_exists(path):
        print(f"  ⏭ {path} 已存在，跳过")
        uploaded[(t, o)] = path
        continue
    ok = False
    for attempt in range(1, 4):
        try:
            r = sess.post(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
                          headers=headers, data=data, timeout=300)
            if r.status_code in (200, 201):
                print(f"  ✓ {path} ({len(data)//1024} KB)")
                uploaded[(t, o)] = path
                ok = True
                break
            print(f"  ✗ 第{attempt}次 {path} HTTP {r.status_code}: {r.text[:150]}")
        except Exception as e:
            print(f"  ✗ 第{attempt}次 {path} 连接异常: {type(e).__name__}")
        time.sleep(3)
    if not ok:
        print(f"  ✗ {path} 三次均失败，跳过")
        fail += 1

if fail:
    print(f"\n{fail} 张上传失败。可重跑本脚本（已成功的会自动跳过）。")
    sys.exit(1)

# ---------- 5) 生成 INSERT SQL ----------
def pub(path):
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"

def esc(s):
    return (s or "").replace("'", "''")

lines = [
    "-- ============================================================",
    "-- 查验证明：19 条店铺数据（图片已上传 licenses 桶）",
    "-- 在 Supabase SQL Editor 执行（licenses 表建好后）",
    "-- 注意：请勿重复执行本 SQL（会插入重复数据）",
    "-- ============================================================",
    "insert into public.licenses (platform, shop_name, shop_short, company, factory, license_file, business_file, production_file, sort_order) values",
]
vals = []
for i, r in enumerate(rows, start=1):
    lic = pub(uploaded[("经营许可证", r["company"])]) if ("经营许可证", r["company"]) in uploaded else ""
    biz = pub(uploaded[("营业执照", r["company"])]) if ("营业执照", r["company"]) in uploaded else ""
    prod = ""
    if (r["factory"] or "").strip() and ("生产许可证", r["factory"]) in uploaded:
        prod = pub(uploaded[("生产许可证", r["factory"])])
    vals.append(
        f"('{esc(r['platform'])}', '{esc(r['shop_name'])}', '{esc(r['shop_short'])}', "
        f"'{esc(r['company'])}', '{esc(r['factory'])}', "
        f"'{esc(lic)}', '{esc(biz)}', '{esc(prod)}', {i})"
    )
lines.append(",\n".join(vals))
lines.append("on conflict (id) do nothing;")
lines.append("")
lines.append("-- 完成提示")
lines.append("select '19 条店铺数据已上架' as result;")

sql = "\n".join(lines)
out = BASE + "/add_licenses_data.sql"
with open(out, "w", encoding="utf-8") as f:
    f.write(sql)
print(f"\nSQL 已生成：{out}（{len(rows)} 条）")
