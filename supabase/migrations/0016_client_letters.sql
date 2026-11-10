-- Client letters generated from Client KYC > Letters (management representation, transmittal, accountant's letter).
-- Admin only. Safe to run more than once.
create table if not exists client_letters (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('mgmt','trans','acct')),
  title text not null check (char_length(title) <= 200),
  client_name text not null check (char_length(client_name) between 1 and 200),
  submission_id uuid references form_submissions(id) on delete set null,
  fields jsonb not null default '{}',
  body text not null check (char_length(body) <= 20000),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_letters_created on client_letters (created_at desc);
alter table client_letters enable row level security;
drop policy if exists client_letters_admin on client_letters;
create policy client_letters_admin on client_letters for all using (is_admin()) with check (is_admin());
create or replace function client_letters_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists client_letters_touch on client_letters;
create trigger client_letters_touch before update on client_letters for each row execute function client_letters_touch();
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'audit_client_letters' and tgrelid = 'client_letters'::regclass) then
    perform audit_attach('client_letters');
  end if;
end $$;
