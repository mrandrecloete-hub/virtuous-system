-- Monthly processing: one fillable month calendar per person per month (notes and highlighted days).
-- A person reads and writes only their own sheet; administrators read and write everyone's. Safe to run more than once.
create table if not exists monthly_tracker (
  user_id uuid not null references profiles(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  cells jsonb not null default '{}' check (jsonb_typeof(cells) = 'object' and pg_column_size(cells) <= 200000),
  updated_by uuid references profiles(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);
alter table monthly_tracker enable row level security;
drop policy if exists monthly_tracker_admin on monthly_tracker;
create policy monthly_tracker_admin on monthly_tracker for all using (is_admin()) with check (is_admin());
drop policy if exists monthly_tracker_own on monthly_tracker;
create policy monthly_tracker_own on monthly_tracker for all using (is_active() and user_id = auth.uid()) with check (is_active() and user_id = auth.uid());
create or replace function monthly_tracker_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end $$;
drop trigger if exists monthly_tracker_touch on monthly_tracker;
create trigger monthly_tracker_touch before insert or update on monthly_tracker for each row execute function monthly_tracker_touch();
-- Not audited row by row: every note save would copy the whole month into the audit log.
