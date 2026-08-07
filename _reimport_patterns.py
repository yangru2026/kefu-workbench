import json
import requests

# Supabase config
SUPABASE_URL = "https://ienmejlxukhrxjjxvfqf.supabase.co"
SUPABASE_KEY = "sb_publishable_emFn7uMsZYdIk0lmLCxP3A_2V4gL68s"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# Load old data
with open("old_config.json", "r", encoding="utf-8") as f:
    data = json.load(f)

brands = data["patternData"]["brands"]

# Flatten to rows
rows = []
for brand_name, types in brands.items():
    for type_name, items in types.items():
        for item in items:
            rows.append({
                "brand": brand_name,
                "type": type_name,
                "name": item["name"],
                "series": item.get("series", ""),
                "color": item.get("color", ""),
                "diameter": item.get("diameter", ""),
                "color_diameter": item.get("colorDiameter", ""),
                "material": item.get("material", ""),
                "oxygen": item.get("oxygen", ""),
                "water": item.get("water", ""),
                "spec": item.get("spec", ""),
                "lens_img": item.get("lensImg", ""),
                "eye_img": item.get("eyeImg", ""),
                "description": item.get("script", "")
            })

print(f"准备导入 {len(rows)} 条花色数据...")

# Insert in batches
BATCH_SIZE = 50
url = f"{SUPABASE_URL}/rest/v1/pattern_assets"

for i in range(0, len(rows), BATCH_SIZE):
    batch = rows[i:i+BATCH_SIZE]
    r = requests.post(url, headers=HEADERS, json=batch)
    if r.status_code in (200, 201):
        print(f"  批次 {i//BATCH_SIZE + 1}/{(len(rows)-1)//BATCH_SIZE + 1}: 成功导入 {len(batch)} 条")
    else:
        print(f"  批次 {i//BATCH_SIZE + 1} 失败: {r.status_code} - {r.text}")

print("\n导入完成！")
