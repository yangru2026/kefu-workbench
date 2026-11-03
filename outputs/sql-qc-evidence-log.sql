-- ============================================================
-- 质查看图留痕（2026-11-03，防敷衍方案 B）
-- 需求：客服每次打开证据截图，记录停留时长；组长/管理员端可看
--       「谁没打开过图 / 打开了几秒」→ 低于阈值标「疑似未认真看」。
-- 幂等：可重复执行。
-- ============================================================

-- 1) 加列：每次看图 append 一条 {at, sec}
alter table qc_records
  add column if not exists evidence_views jsonb not null default '[]'::jsonb;

comment on column qc_records.evidence_views is
  '看图留痕：[{at:"2026-11-03 14:30", sec:25}, ...]，由 qc_log_evidence_view RPC 追加';

-- 2) 上报 RPC：只能给自己花名的记录追加（SECURITY DEFINER 绕 RLS，
--    但 where 里限死 staff_name = 本人花名，别人改不了）
create or replace function qc_log_evidence_view(p_id text, p_sec int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if p_id is null or p_id = '' then return; end if;
  select name into v_name from profiles where id = auth.uid();
  if v_name is null or v_name = '' then return; end if;   -- 未登录/无花名不写
  update qc_records
     set evidence_views = coalesce(evidence_views, '[]'::jsonb)
                          || jsonb_build_array(jsonb_build_object(
                               'at',  to_char(now() at time zone 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI'),
                               'sec', greatest(0, least(coalesce(p_sec, 0), 7200))))
   where id = p_id
     and staff_name = v_name;
end;
$$;

revoke all on function qc_log_evidence_view(text, int) from public;
grant execute on function qc_log_evidence_view(text, int) to authenticated;
