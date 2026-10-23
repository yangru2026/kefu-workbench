# -*- coding: utf-8 -*-
# 读 花名大全.xlsx 全部工作表 → outputs/feishu/hua_ming.json（只读）
import json, sys
import openpyxl
sys.stdout.reconfigure(encoding='utf-8')

SRC = r'D:\桌面\花名大全.xlsx'
wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
out = {}
for ws in wb.worksheets:
    rows = []
    for row in ws.iter_rows(values_only=True):
        # 整行全空跳过
        if row is None or all(c is None or str(c).strip() == '' for c in row):
            rows.append(None)
            continue
        rows.append(['' if c is None else str(c).strip() for c in row])
    out[ws.title] = {'max_row': ws.max_row, 'max_col': ws.max_column, 'rows': rows}
    print(f'[{ws.title}] rows={ws.max_row} cols={ws.max_column}')
    for r in rows[:6]:
        print('  ', r)
with open(r'C:\Users\Administrator\WorkBuddy\2026-07-28-10-50-05\outputs\feishu\hua_ming_raw.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False)
print('saved')
