-- 0023: keep the edited and signed leave form with the application. Re-runnable.
create table if not exists leave_forms (
  request_id uuid primary key references leave_requests(id) on delete cascade,
  html text not null check (length(html) <= 1500000),
  saved_by uuid, saved_at timestamptz not null default now()
);
alter table leave_forms enable row level security;
drop policy if exists leave_forms_read on leave_forms;
create policy leave_forms_read on leave_forms for select to authenticated
  using (is_admin() or exists (select 1 from leave_requests r where r.id = request_id and r.user_id = auth.uid()));
grant select on leave_forms to authenticated;

create or replace function save_leave_form(p_id uuid, p_html text) returns void
language plpgsql security definer set search_path = public as $$
declare r leave_requests%rowtype;
begin
  select * into r from leave_requests where id = p_id;
  if not found then raise exception 'Request not found.'; end if;
  if not (is_admin() or r.user_id = auth.uid()) then raise exception 'not permitted'; end if;
  if p_html is null or length(p_html) > 1500000 then raise exception 'The form is too large to save.'; end if;
  insert into leave_forms(request_id, html, saved_by, saved_at) values (p_id, p_html, auth.uid(), now())
  on conflict (request_id) do update set html = excluded.html, saved_by = excluded.saved_by, saved_at = now();
end $$;
revoke execute on function save_leave_form(uuid, text) from public, anon;
grant execute on function save_leave_form(uuid, text) to authenticated;
