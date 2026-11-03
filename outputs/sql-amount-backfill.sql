-- 存量补账：amount=0 但 raw 里「扣罚金额%」有值的行，从 raw 里捞出来回填（幂等，只补 0 值）
update qc_records q
set amount = t.amt
from (
  select r.id,
         (select round(btrim(regexp_replace(e.value #>> '{}', '[^0-9.]', '', 'g'))::numeric, 2)
          from jsonb_each(r.raw) e
          where e.key like '扣罚金额%'
            and e.value #>> '{}' ~ '[1-9]'
          limit 1) as amt
  from qc_records r
) t
where q.id = t.id and coalesce(q.amount, 0) = 0 and coalesce(t.amt, 0) > 0
returning q.id, q.amount;
