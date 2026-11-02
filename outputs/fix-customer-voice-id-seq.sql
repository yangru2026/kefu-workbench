-- 修复 customer_voice.id 缺自增默认值（2026-11-02）
-- 现象：登记客户之声报「null value in column "id" ... violates not-null constraint」
-- 根因：2026-10-20 迁移建表时 id 只搬了 bigint not null，没带序列默认值
--       （对照 daily_reports：id bigint default nextval('daily_reports_id_seq') 有默认）
-- 用法：茹姐在 Supabase SQL Editor 整段执行，幂等可重复跑

create sequence if not exists public.customer_voice_id_seq
  owned by public.customer_voice.id;

-- 序列起点 = 当前最大 id，避免与已有 1966 条数据撞主键
select setval('public.customer_voice_id_seq',
  (select coalesce(max(id), 1) from public.customer_voice));

alter table public.customer_voice
  alter column id set default nextval('public.customer_voice_id_seq'::regclass);
