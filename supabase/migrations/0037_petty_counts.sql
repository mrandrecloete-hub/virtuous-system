-- Cash counted in the petty cash drawer (a physical count on a date), compared with the balance in the float ledger.
-- Administrators only. Safe to run more than once.
create table if not exists petty_counts (
  id uuid primary key default gen_random_uuid(),
  counted_on date not null default current_date,
  amount numeric(14,2) not null check (amount >= 0 and amount <= 10000000),
  counted_by text check (counted_by is null or char_length(counted_by) <= 60),
  note text check (note is null or char_length(note) <= 120),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists petty_counts_date on petty_counts (counted_on, created_at);
alter table petty_counts enable row level security;
drop policy if exists petty_counts_admin on petty_counts;
create policy petty_counts_admin on petty_counts for all using (is_admin()) with check (is_admin());
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'audit_petty_counts' and tgrelid = 'petty_counts'::regclass) then
    perform audit_attach('petty_counts');
  end if;
end $$;
