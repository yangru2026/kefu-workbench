-- 考核成绩人工评分：允许主管（admin/leader）修改 quiz_results（回写评分与总分）
-- 在 Supabase SQL Editor 里执行一次即可
drop policy if exists "admin_leader_update_quiz_results" on quiz_results;
create policy "admin_leader_update_quiz_results"
on quiz_results for update to authenticated
using (is_admin_or_leader())
with check (is_admin_or_leader());

-- 验证：select * from pg_policies where tablename='quiz_results';
