-- Timesheet entries: notes and a billed flag (only admins can change billing status).
alter table time_entries
  add column notes text check (notes is null or char_length(notes) <= 1000),
  add column billed boolean not null default false;

create function time_entries_billed_guard() returns trigger language plpgsql as $$
begin
  if not is_admin() then
    if tg_op = 'INSERT' and new.billed then raise exception 'not permitted'; end if;
    if tg_op = 'UPDATE' and new.billed is distinct from old.billed then raise exception 'not permitted'; end if;
  end if;
  return new;
end $$;
create trigger time_entries_billed_guard before insert or update on time_entries for each row execute function time_entries_billed_guard();

create index time_entries_billed on time_entries (billed) where status = 'Approved';
