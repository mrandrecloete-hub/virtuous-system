-- Staff may edit their own timesheet entries, including approved ones. An edited approved or pending entry
-- goes back to Pending so it must be approved again; billed entries stay locked. Safe to run more than once.
alter table time_entries add column if not exists project text;
create or replace function edit_own_time_entry(p_id uuid, p_client uuid, p_date date, p_task text, p_hours numeric, p_notes text, p_project text)
returns text language plpgsql security definer set search_path = public as $$
declare r time_entries%rowtype; s text;
begin
  select * into r from time_entries where id = p_id for update;
  if r.id is null or r.user_id is distinct from auth.uid() or not is_active() then raise exception 'You are not allowed to change this entry.'; end if;
  if r.billed then raise exception 'This entry has been billed and can no longer be changed.'; end if;
  if p_date is null or p_date > (now() at time zone 'Africa/Windhoek')::date then raise exception 'Choose a date that is not in the future.'; end if;
  if p_hours is null or p_hours < 0.25 or p_hours > 24 then raise exception 'Hours must be between 0.25 and 24.'; end if;
  if coalesce(btrim(p_task), '') = '' then raise exception 'Say what you worked on.'; end if;
  s := case when r.status::text in ('Approved','Pending') then 'Pending' else 'Draft' end;
  update time_entries set client_id = p_client, work_date = p_date, task = left(btrim(p_task), 200), hours = p_hours,
         notes = nullif(left(btrim(coalesce(p_notes, '')), 500), ''), project = nullif(left(btrim(coalesce(p_project, '')), 120), ''),
         status = s::approval_status, decided_by = null, decided_at = null
   where id = p_id;
  return s;
end $$;
revoke execute on function edit_own_time_entry(uuid, uuid, date, text, numeric, text, text) from public, anon;
grant execute on function edit_own_time_entry(uuid, uuid, date, text, numeric, text, text) to authenticated;
