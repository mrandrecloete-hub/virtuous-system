-- 0022: optional decision reason on leave decisions; the employee's alert includes it. Re-runnable.
alter table leave_requests add column if not exists decision_reason text;

drop function if exists decide_leave(uuid, boolean);
create or replace function decide_leave(p_id uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r leave_requests%rowtype; bal numeric; why text := nullif(left(btrim(coalesce(p_reason,'')),300),'');
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  select * into r from leave_requests where id = p_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'Pending' then raise exception 'That request has already been decided.'; end if;
  if p_approve then
    select days into bal from leave_balances where user_id = r.user_id and leave_type = r.leave_type for update;
    if found then
      if r.days > bal then raise exception 'Not enough % leave left (% days).', lower(r.leave_type), bal; end if;
      update leave_balances set days = days - r.days where user_id = r.user_id and leave_type = r.leave_type;
    end if;
  end if;
  update leave_requests set status = case when p_approve then 'Approved' else 'Rejected' end::approval_status,
    decided_by = auth.uid(), decided_at = now(), decision_reason = why where id = p_id;
  insert into notifications(kind, message, to_user_id)
  values ('Leave', 'Your ' || lower(r.leave_type) || ' leave from ' || to_char(r.from_date,'DD Mon') || ' to ' || to_char(r.to_date,'DD Mon')
          || ' was ' || case when p_approve then 'approved.' else 'rejected.' end || coalesce(' Reason: ' || why, ''), r.user_id);
end $$;

drop function if exists reconsider_leave(uuid, boolean);
create or replace function reconsider_leave(p_id uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r leave_requests%rowtype; bal numeric; why text := nullif(left(btrim(coalesce(p_reason,'')),300),'');
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
    decided_by = auth.uid(), decided_at = now(), decision_reason = why where id = p_id;
  insert into notifications(kind, message, to_user_id)
  values ('Leave', 'Your ' || lower(r.leave_type) || ' leave from ' || to_char(r.from_date,'DD Mon') || ' to ' || to_char(r.to_date,'DD Mon')
          || ' was changed to ' || case when p_approve then 'approved.' else 'declined.' end || coalesce(' Reason: ' || why, ''), r.user_id);
end $$;

revoke execute on function decide_leave(uuid, boolean, text), reconsider_leave(uuid, boolean, text) from public, anon;
grant execute on function decide_leave(uuid, boolean, text), reconsider_leave(uuid, boolean, text) to authenticated;
