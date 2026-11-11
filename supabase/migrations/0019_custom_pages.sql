-- Customize studio: pages an administrator builds from blocks (text, checklist, table, numbers, links, live stats).
-- Admins manage them. Employees can only read pages the admin marked for staff. Safe to run more than once.
create table if not exists custom_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  icon text not null default 'star' check (char_length(icon) <= 20),
  audience text not null default 'admin' check (audience in ('admin','staff')),
  position int not null default 0,
  blocks jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) <= 200000),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_pages_position on custom_pages (position, created_at);
alter table custom_pages enable row level security;
drop policy if exists custom_pages_admin on custom_pages;
create policy custom_pages_admin on custom_pages for all using (is_admin()) with check (is_admin());
drop policy if exists custom_pages_staff_read on custom_pages;
create policy custom_pages_staff_read on custom_pages for select using (audience = 'staff' and is_active());
create or replace function custom_pages_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists custom_pages_touch on custom_pages;
create trigger custom_pages_touch before update on custom_pages for each row execute function custom_pages_touch();
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'audit_custom_pages' and tgrelid = 'custom_pages'::regclass) then
    perform audit_attach('custom_pages');
  end if;
end $$;
