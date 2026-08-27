# -*- coding: utf-8 -*-
"""上传 18 张许可证图片到 Supabase Storage「licenses」桶，并生成 19 条 INSERT SQL。

用法：
  SUPABASE_SERVICE_KEY=<service_role key> python upload_licenses.py
"""
import json, os, sys, zipfile, requests

BASE = r"C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05"
XLSX = r"C:/Users/Administrator/Desktop/各店铺许可证收集(2).xlsx"
MAP = json.load(open(BASE + "/outputs/license_map.json", encoding="utf-8"))
SUPABASE_URL = "https://ienmejlxukhrxjjxvfqf.supabase.co"
BUCKET = "licenses"
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not KEY:
    sys.exit("缺少 SUPABASE_SERVICE_KEY 环境变量（Supabase Dashboard → Project Settings → API → service_role key）")

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

print(f"待上传唯一图片：{len(unique)} 张")
for (t, o), m in sorted(unique.items()):
    print(f"  {o} / {t} <- {m}")

# ---------- 3) 上传 ----------
headers = {"Authorization": "Bearer " + KEY, "apikey": KEY}
uploaded = {}
fail = 0
for (t, o), media in sorted(unique.items()):
    data = z.read("xl/" + media)
    path = f"{o}/{t}.png"
    r = requests.post(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
                      headers=headers, data=data, timeout=120)
    if r.status_code in (200, 201):
        print(f"  ✓ {path} ({len(data)//1024} KB)")
        uploaded[(t, o)] = path
    else:
        print(f"  ✗ {path} 失败 {r.status_code}: {r.text[:200]}")
        fail += 1
if fail:
    sys.exit(f"{fail} 张上传失败，已中止生成 SQL")

# ---------- 4) 生成 INSERT SQL ----------
def pub(path):
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"

def esc(s):
    return (s or "").replace("'", "''")

lines = [
    "-- ============================================================",
    "-- 查验证明：19 条店铺数据（图片已上传 licenses 桶）",
    "-- 在 Supabase SQL Editor 执行（licenses 表建好后）",
    "-- ============================================================",
    "insert into public.licenses (platform, shop_name, shop_short, company, factory, license_file, business_file, production_file, sort_order) values",
]
vals = []
for i, r in enumerate(rows, start=1):
    lic = pub(uploaded.get(("经营许可证", r["company"]), "")) if uploaded.get(("经营许可证", r["company"])) else ""
    biz = pub(uploaded.get(("营业执照", r["company"]), "")) if uploaded.get(("营业执照", r["company"])) else ""
    prod = ""
    if (r["factory"] or "").strip():
        prod = pub(uploaded.get(("生产许可证", r["factory"]), "")) if uploaded.get(("生产许可证", r["factory"])) else ""
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
