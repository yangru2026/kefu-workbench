-- 排查扣罚金额没同步：看 raw 里实际字段名 + amount 现值
select id, amount,
       raw->>'扣罚金额（主香填）' as amt_zhuxiang,
       raw->>'扣罚金额' as amt_plain,
       (select string_agg(k, ' | ') from jsonb_object_keys(raw) k) as all_fields
from qc_records
where detail like '%99.7%' or severity like '严重%'
order by qc_date desc limit 5;
