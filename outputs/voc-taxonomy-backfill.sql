-- 客户之声：一级(topic) + 二级(subtopic) 分类体系落地 + 历史 1967 条回填
-- 2026-11-02，幂等可重复执行
-- 一级：询货咨询 / 使用反馈 / 售后抱怨 / 好评 / 价格 / 物流 / 其他
-- 询货二级：库存·还会出吗 / 抛型 / 直径·着色直径 / 度数 / 花色·款式 / 材质工艺 / 包装·规格 / 定轴·散光 / 未细分

alter table public.customer_voice add column if not exists subtopic text;

update public.customer_voice v
set topic = c.t_topic,
    subtopic = c.t_sub
from (
  select id, t_topic,
    case t_topic
      when '询货咨询' then case
        when raw_text ~* '还会出|还会有|还有吗|还有没有|还有么|什么时候有|补货|缺货|有货|会出吗|还上吗|返场|什么时候' then '库存·还会出吗'
        when raw_text ~* '日抛|月抛|半年抛|年抛|季抛|抛' then '抛型'
        when raw_text ~* '直径|着色|1[3-4]\.[0-9]|小直径|大直径|锁边' then '直径·着色直径'
        when raw_text ~* '多少度|度数|度|近视|基弧' then '度数'
        when raw_text ~* '花色|色号|颜色|款式|系列|新款|上新|pro|版|链接' then '花色·款式'
        when raw_text ~* '硅水|非离子|材质|工艺|透氧|含水量' then '材质工艺'
        when raw_text ~* '两片|一片|盒|包装|伴侣|几片|片装|大瓶|护理液' then '包装·规格'
        when raw_text ~* '定轴|散光|轴位|会转|转动' then '定轴·散光'
        else '未细分' end
      when '使用反馈' then case
        when raw_text ~* '红血丝|发炎|过敏|刺痛|充血' then '红血丝发炎'
        when raw_text ~* '滑片|看不清|模糊|移位' then '滑片看不清'
        when raw_text ~* '结膜炎|孕妇|岁以下|以下|不能带|不能戴|可以戴|能戴|戴着|戴久' then '适用人群禁忌'
        when raw_text ~* '磨眼|干涩|干|疼|不适' then '磨眼干涩'
        else '其他反馈' end
      when '售后抱怨' then case
        when raw_text ~* '退货|退款' then '退货退款'
        when raw_text ~* '破损|质量|坏|瑕疵' then '质量破损'
        when raw_text ~* '态度|敷衍|不理' then '客服态度'
        else '其他抱怨' end
      when '好评' then case
        when raw_text ~* '回购|推荐' then '回购推荐'
        when raw_text ~* '舒服|水润|不干' then '夸舒适'
        else '夸颜色' end
      when '价格' then case
        when raw_text ~* '优惠|活动|折扣|满减' then '要优惠'
        else '嫌贵' end
      when '物流' then case
        when raw_text ~* '慢|迟迟|还没收到' then '发货慢'
        else '快递问题' end
      else '未分类' end as t_sub
  from (
    select id, raw_text,
      case
        when raw_text ~* '退货|退款|差评|投诉|假货|虚假|骗子|垃圾|气死|恶心|坑人|骗人' then '售后抱怨'
        when raw_text ~* '磨眼|干涩|红血丝|发炎|过敏|刺痛|不舒服|异物|滑片|看不清|模糊|结膜炎|孕妇|孕期|岁以下|以下|不能带|不能戴|可以带|可以戴|能带|能戴|带么|戴着|戴久|长时间|疼' then '使用反馈'
        when raw_text ~* '贵|便宜|优惠|活动价|折扣|多少钱|价位|性价比|满减|买不起' then '价格'
        when raw_text ~* '物流|快递|发货|到货|收货|配送|顺丰|邮政|包裹|送到|地址' then '物流'
        when raw_text ~* '好看|喜欢|满意|回购|推荐|舒服|自然|惊艳|显白|超爱|绝了|太美'
             and raw_text !~* '吗|嘛|么|有没有|有么|多少|几|还有|没有|哪' then '好评'
        when raw_text ~* '抛|直径|着色|1[3-4]\.[0-9]|度|片|盒|色号|花色|系列|款|材质|硅水|非离子|轴|散光|库存|货|颜色|基弧|链接|返场|什么时候|有没有|有吗|有么|还有|没有|大瓶|护理液|锁边|个装' then '询货咨询'
        else '其他'
      end as t_topic
    from public.customer_voice
  ) base
) c
where v.id = c.id;
