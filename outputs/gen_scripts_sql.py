import openpyxl, json, re
from collections import Counter, defaultdict

PATH = r"C:/Users/Administrator/Downloads/抖音_弥生电子美瞳专卖店_店铺场景_2026-08-27.xlsx"
OUT = r"C:/Users/Administrator/WorkBuddy/2026-07-28-10-50-05/add_scripts_from_excel.sql"

wb = openpyxl.load_workbook(PATH, data_only=True)
ws = wb['场景']
data = list(ws.iter_rows(values_only=True))[1:]

STYLES = ['标准', '亲切', '简短', '专业', '安抚']

def clean(v):
    if v is None:
        return ''
    return str(v).replace('<新消息分隔符>', '\n').strip()

def get_tag(scene, strategy):
    for s in [strategy, scene]:
        if '售后' in s:
            return '售后'
        if '售前' in s:
            return '售前'
    return '通用'

STRONG_AFTER = ['破损', '退款', '补发', '退换', '发错货', '色差', '与实物不符',
                '镜片干', '镜片脏', '买多了', '拍错', '剪片', '快递破损', '重新清洗']

def classify(scene, strategy, tag):
    t = scene + ' ' + strategy
    if tag == '售后':
        return '售后处理'
    if any(k in t for k in STRONG_AFTER):
        return '售后处理'
    if any(k in t for k in ['一等奖', '活动', '最划算', '赠品', '运费险', '优惠', '39.9', '29.9']):
        return '价格优惠'
    if any(k in t for k in ['引导下单', '推荐', '感谢', '买三幅', '引导']):
        return '促单成交'
    if any(k in t for k in ['发货', '快递', '地址', '下单', '预定', '付款', '订单', '三幅',
                            '单买', '改地址', '备注', '更换花色', '别发错', '已下单', '忘记备注',
                            '告知自身度数', '买家确认', '包装', '转运', '国外', '香港', '台湾']):
        return '订单物流'
    if any(k in t for k in ['眼睛小', '敏感', '新手', '佩戴', '摘', '吃火锅', '化妆', '午睡',
                            '可以戴吗', '干眼', '适应', '区分正反', '区分左右', '左右', '正反',
                            '度数怎么', '怎么分辨', '怎么区分', '怎么看', '后顶焦度']):
        return '佩戴问题'
    if any(k in t for k in ['直径', '基弧', '厚度', '含水', '着色', '高光', '材质', '透氧',
                            '保质期', '片数', '一片', '两片', '正品', '注册证', '花色', '加深',
                            '护理液', '浸泡', '三明治', '小直径', '自然花色', '参数', '工艺', '度数']):
        return '产品咨询'
    if any(k in t for k in ['注册证', '资质', '医疗器械', '试戴规则', '转运']):
        return '平台规则'
    return '产品咨询'

def make_title(scene, strategy):
    s2 = re.sub(r'^【[^】]*】', '', str(strategy or '').strip()).strip()
    if s2 and s2 != '通用':
        return s2
    return str(scene or '').strip()

records = []
for i, r in enumerate(data):
    r = list(r) + [''] * (7 - len(r))
    scene, strategy = str(r[0] or ''), str(r[1] or '')
    scripts = [clean(r[2 + k]) for k in range(5)]
    if not any(scripts):
        continue
    tag = get_tag(scene, strategy)
    sub = classify(scene, strategy, tag)
    if sub == '售后处理':   # 用户要求：剔除所有售后相关内容
        continue
    records.append({
        'title': make_title(scene, strategy),
        'sub': sub,
        'tag': tag,
        'styles': {STYLES[k]: scripts[k] for k in range(5)},
        'sort': i + 1,
    })

cnt = Counter(r['sub'] for r in records)
print("总条数:", len(records))
for k in ['佩戴问题', '产品咨询', '订单物流', '价格优惠', '平台规则', '促单成交']:
    print(f"  {k}: {cnt.get(k,0)}")

subs = [('佩戴问题', 510), ('产品咨询', 520), ('订单物流', 530),
        ('价格优惠', 550), ('平台规则', 560), ('促单成交', 570)]

L = []
L.append("-- ============================================================")
L.append("-- 售前话术批量导入：抖音_弥生电子美瞳专卖店_店铺场景 (2026-08-27)")
L.append(f"-- 本文件自包含：建表 + 权限 + 大类/小类 + {len(records)} 条场景话术（已剔除全部售后相关内容）")
L.append("-- 在 Supabase SQL Editor 一次性执行即可（幂等，可重复执行）")
L.append("-- 说明：Excel 的 5 列话术依次映射为 标准/亲切/简短/专业/安抚 5 种风格；")
L.append("--       分类依据【售前】/【售后】标记 + 关键词，导入后可在界面后台微调小类。")
L.append("-- 注意：所有「售后」标记或含退款/破损/退换等关键词的条目已排除。")
L.append("-- ============================================================")
L.append("")
L.append("-- 1) 建表")
L.append("create table if not exists public.training_scripts (")
L.append("  id          uuid primary key default gen_random_uuid(),")
L.append("  category    text not null default '售前话术',")
L.append("  subcategory text not null default '未分类',")
L.append("  title       text not null,")
L.append("  styles      jsonb not null default '{\"标准\":\"\",\"亲切\":\"\",\"简短\":\"\",\"专业\":\"\",\"安抚\":\"\"}'::jsonb,")
L.append("  tags        text[] not null default '{}',")
L.append("  sort_order  int not null default 0,")
L.append("  is_active   boolean not null default true,")
L.append("  script_group text not null default '通用',")
L.append("  created_at  timestamptz not null default now(),")
L.append("  updated_at  timestamptz not null default now()")
L.append(");")
L.append("create index if not exists idx_training_scripts_cat on public.training_scripts (category);")
L.append("create index if not exists idx_training_scripts_sub on public.training_scripts (subcategory);")
L.append("alter table public.training_scripts add column if not exists script_group text not null default '通用';")
L.append("")
L.append("-- 2) 权限（全员可读，登录可写）")
L.append("alter table public.training_scripts enable row level security;")
L.append("drop policy if exists \"scripts public read\" on public.training_scripts;")
L.append("create policy \"scripts public read\" on public.training_scripts for select using (true);")
L.append("drop policy if exists \"scripts authed write\" on public.training_scripts;")
L.append("create policy \"scripts authed write\" on public.training_scripts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');")
L.append("")
L.append("-- 3) updated_at 自动刷新")
L.append("create or replace function public.set_updated_at()")
L.append("returns trigger language plpgsql as $$")
L.append("begin")
L.append("  new.updated_at = now();")
L.append("  return new;")
L.append("end;")
L.append("$$;")
L.append("drop trigger if exists trg_training_scripts_updated on public.training_scripts;")
L.append("create trigger trg_training_scripts_updated before update on public.training_scripts")
L.append("  for each row execute function public.set_updated_at();")
L.append("")
L.append("-- 4) 大类「售前话术」+ 7 个标准小类")
L.append("insert into public.training_categories (name, sort_order, parent_id)")
L.append("select '售前话术', 500, ''")
L.append("where not exists (select 1 from public.training_categories where name='售前话术' and (parent_id is null or parent_id=''));")
for name, so in subs:
    L.append(f"insert into public.training_categories (name, sort_order, parent_id) select '{name}', {so}, '售前话术' where not exists (select 1 from public.training_categories where name='{name}' and parent_id='售前话术');")
L.append("")
L.append("-- 5) 清空本类旧数据（幂等，重复执行不会堆积）")
L.append("delete from public.training_scripts where category = '售前话术';")
L.append("")
L.append("-- 6) 插入全部场景话术")
tuples = []
for r in records:
    styles_json = json.dumps(r['styles'], ensure_ascii=False).replace("'", "''")
    title_sql = r['title'].replace("'", "''")
    sub_sql = r['sub'].replace("'", "''")
    tuples.append(f"  ('售前话术', '{sub_sql}', '{title_sql}', '{styles_json}'::jsonb, array['{r['tag']}'], {r['sort']}, '通用')")
L.append("insert into public.training_scripts (category, subcategory, title, styles, tags, sort_order, script_group) values")
L.append(",\n".join(tuples) + ";")

with open(OUT, 'w', encoding='utf-8') as f:
    f.write("\n".join(L))
print("SQL 已写出:", OUT)
