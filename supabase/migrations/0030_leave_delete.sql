-- Let a person (or an admin) delete their own leave application once it has been decided
-- (Approved/Rejected) or withdrawn - just removes it from the list, does not restore any
-- balance already deducted for an approved request. A Pending request still uses
-- withdraw_request (migration 0011) instead, so it isn't silently erased while awaiting a
-- decision. Safe to run more than once.
create or replace function delete_leave_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r leave_requests%rowtype;
begin
  select * into r from leave_requests where id = p_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if not (r.user_id = auth.uid() or is_admin()) then raise exception 'not permitted'; end if;
  if r.status not in ('Approved','Rejected','Withdrawn') then
    raise exception 'Only an approved, rejected or withdrawn request can be deleted.';
  end if;
  delete from leave_requests where id = p_id;
end $$;
grant execute on function delete_leave_request(uuid) to authenticated;
