-- Petty cash float: what Barry puts into the petty cash box (an opening balance and fill-ups).
-- Together with cash taken and change returned (cash_advances) this gives the running balance and the balance sheet.
-- Administrators only. Safe to run more than once.
create table if not exists petty_fills (
  id uuid primary key default gen_random_uuid(),
  filled_on date not null default current_date,
  amount numeric(14,2) not null check (amount > 0 and amount <= 10000000),
  kind text not null default 'fill' check (kind in ('open','fill')),
  filled_by text check (filled_by is null or char_length(filled_by) <= 60),
  note text check (note is null or char_length(note) <= 120),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists petty_fills_date on petty_fills (filled_on, created_at);
alter table petty_fills enable row level security;
drop policy if exists petty_fills_admin on petty_fills;
create policy petty_fills_admin on petty_fills for all using (is_admin()) with check (is_admin());
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'audit_petty_fills' and tgrelid = 'petty_fills'::regclass) then
    perform audit_attach('petty_fills');
  end if;
end $$;
