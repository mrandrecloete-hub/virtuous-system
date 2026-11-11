-- 0021: admin can change a leave decision after the fact (approved -> declined, declined -> approved).
-- Keeps leave balances right (only for types that have a balance row). Re-runnable.
create or replace function reconsider_leave(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r leave_requests%rowtype; bal numeric;
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  select * into r from leave_requests where id = p_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status = 'Pending' then raise exception 'Use the normal approve or decline for pending requests.'; end if;
  if p_approve and r.status = 'Approved' then return; end if;
  if not p_approve and r.status <> 'Approved' then return; end if;
  if p_approve then
    select days into bal from leave_balances where user_id = r.user_id and leave_type = r.leave_type for update;
    if found then
      if r.days > bal then raise exception 'Not enough % leave left (% days).', lower(r.leave_type), bal; end if;
      update leave_balances set days = days - r.days where user_id = r.user_id and leave_type = r.leave_type;
    end if;
  else
    update leave_balances set days = days + r.days where user_id = r.user_id and leave_type = r.leave_type;
  end if;
  update leave_requests set status = case when p_approve then 'Approved' else 'Rejected' end::approval_status,
    decided_by = auth.uid(), decided_at = now() where id = p_id;
  insert into notifications(kind, message, to_user_id)
  values ('Leave', 'Your ' || lower(r.leave_type) || ' leave from ' || to_char(r.from_date,'DD Mon') || ' to ' || to_char(r.to_date,'DD Mon')
          || ' was changed to ' || case when p_approve then 'approved.' else 'declined.' end, r.user_id);
end $$;
revoke execute on function reconsider_leave(uuid, boolean) from public, anon;
grant execute on function reconsider_leave(uuid, boolean) to authenticated;
