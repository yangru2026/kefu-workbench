# -*- coding: utf-8 -*-
# 校验花名数据质量
import json, sys, collections
sys.stdout.reconfigure(encoding='utf-8')
d = json.load(open(r'C:\Users\Administrator\WorkBuddy\2026-07-28-10-50-05\outputs\feishu\hua_ming_raw.json', encoding='utf-8'))
ws = d['花名大全']
rows = [r for r in ws['rows'] if r]
print('总行数(非空):', len(rows))
print('表头:', rows[0])
data = rows[1:]
print('数据行:', len(data))
c1 = collections.Counter(r[1] for r in data)
print('定轴/普通 分布:', dict(c1))
c2 = collections.Counter(r[2] for r in data)
print('抛型 分布:', dict(c2))
c3 = collections.Counter(r[3] for r in data)
print('系列 分布:', dict(c3))
# 重名检查
names = [r[0] for r in data]
dup = [n for n, c in collections.Counter(names).items() if c > 1]
print('重名花色:', dup)
# 空花名
print('空花名行数:', sum(1 for r in data if not r[0]))
# 定轴值异常样例
odd = [r for r in data if r[1] not in ('定轴', '普通')]
print('分类值异常行:', odd[:5])
