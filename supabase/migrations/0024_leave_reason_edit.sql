-- 0024: admin can add or change the reason on an already decided leave application; the employee is alerted. Re-runnable.
create or replace function set_leave_reason(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r leave_requests%rowtype; why text := nullif(left(btrim(coalesce(p_reason,'')),300),'');
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  select * into r from leave_requests where id = p_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status = 'Pending' then raise exception 'Decide the request first.'; end if;
  update leave_requests set decision_reason = why where id = p_id;
  insert into notifications(kind, message, to_user_id)
  values ('Leave', 'Your ' || lower(r.leave_type) || ' leave from ' || to_char(r.from_date,'DD Mon') || ' to ' || to_char(r.to_date,'DD Mon')
          || ' (' || case when r.status = 'Approved' then 'approved' else 'not approved' end || '): '
          || coalesce('reason: ' || why, 'the reason was removed.'), r.user_id);
end $$;
revoke execute on function set_leave_reason(uuid, text) from public, anon;
grant execute on function set_leave_reason(uuid, text) to authenticated;
