-- Staff who have no dashboard (no sign-in) can still have petty cash booked in their name by an administrator.
-- They live in petty_people; a cash_advances row belongs to EITHER a signed-in person (user_id) OR one of these people (person_id).
-- Mara is added to start with. Safe to run more than once.
create table if not exists petty_people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  title text check (title is null or char_length(title) <= 60),
  created_at timestamptz not null default now()
);
alter table petty_people enable row level security;
drop policy if exists petty_people_admin on petty_people;
create policy petty_people_admin on petty_people for all using (is_admin()) with check (is_admin());
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'audit_petty_people' and tgrelid = 'petty_people'::regclass) then
    perform audit_attach('petty_people');
  end if;
end $$;

alter table cash_advances alter column user_id drop not null;
alter table cash_advances add column if not exists person_id uuid references petty_people(id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cash_adv_one_owner') then
    alter table cash_advances add constraint cash_adv_one_owner check ((user_id is not null) <> (person_id is not null));
  end if;
end $$;

-- settling works for these rows too (admin only, because they have no sign-in); the alert names the right person
create or replace function settle_advance(p_id uuid, p_spent numeric, p_returned numeric) returns void
language plpgsql security definer set search_path = public as $$
declare a cash_advances%rowtype; exp numeric; d numeric; nm text;
begin
  select * into a from cash_advances where id = p_id for update;
  if not found or not (a.user_id = auth.uid() or is_admin()) then raise exception 'not permitted'; end if;
  if a.status <> 'Open' then raise exception 'already settled'; end if;
  if p_spent is null or p_returned is null or p_spent < 0 or p_returned < 0 or p_spent > a.amount then
    raise exception 'invalid amounts';
  end if;
  exp := round(a.amount - p_spent, 2);
  d := round(p_returned - exp, 2);
  update cash_advances set spent = p_spent, returned = p_returned, expected = exp, diff = d,
    status = case when d = 0 then 'Settled' else 'Settled with difference' end, settled_at = now()
  where id = p_id;
  if d <> 0 then
    if a.user_id is not null then select name into nm from profiles where id = a.user_id;
    else select name into nm from petty_people where id = a.person_id; end if;
    insert into notifications(kind, message, staff_visible)
    values ('Cash', coalesce(nm,'A staff member') || ' settled petty cash with a difference of N$ ' || to_char(d, 'FM999990.00') || '.', false);
  end if;
end $$;
revoke execute on function settle_advance from public, anon;
grant execute on function settle_advance to authenticated;

insert into petty_people (name, title)
select 'Mara', 'Staff' where not exists (select 1 from petty_people where lower(name) = 'mara');
