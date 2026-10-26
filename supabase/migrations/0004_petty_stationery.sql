-- Petty cash, cash advances, stationery. Admin manages; staff take stock and request advances.
create table petty_months (
  id uuid primary key default gen_random_uuid(),
  month date not null unique check (extract(day from month) = 1),
  opening_float numeric(14,2) not null default 0,
  locked boolean not null default false, locked_by uuid references profiles(id), sheet_path text
);
create table petty_sheet_lines (
  id uuid primary key default gen_random_uuid(), month_id uuid not null references petty_months(id) on delete cascade,
  line_date date not null, amount numeric(14,2) not null, description text, vendor text
);
create table petty_receipts (
  id uuid primary key default gen_random_uuid(), month_id uuid not null references petty_months(id) on delete cascade,
  receipt_date date not null, amount numeric(14,2) not null, vendor text, ref text, category text,
  status text not null default 'Unverified', file_path text
);
create table petty_links (
  sheet_line_id uuid primary key references petty_sheet_lines(id) on delete cascade,
  receipt_id uuid not null references petty_receipts(id) on delete cascade,
  override_reason text, set_by uuid references profiles(id)
);
create table cash_advances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) default auth.uid(),
  taken_on date not null default current_date, amount numeric(14,2) not null check (amount > 0), purpose text,
  status text not null default 'Open', spent numeric(14,2), returned numeric(14,2), expected numeric(14,2),
  diff numeric(14,2), settled_at timestamptz, alerted boolean not null default false
);
create table stationery_items (
  id uuid primary key default gen_random_uuid(), name text not null, unit text not null,
  opening_qty int not null default 0, start_month date not null, low_flag boolean not null default false
);
create table stationery_moves (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references stationery_items(id),
  user_id uuid not null references profiles(id) default auth.uid(),
  move_type text not null check (move_type in ('add','take')), qty int not null check (qty > 0),
  note text, at timestamptz not null default now()
);
create table stationery_counts (
  month date, item_id uuid references stationery_items(id), counted_qty int not null, primary key (month, item_id)
);

do $$ declare t text; begin
  foreach t in array array['petty_months','petty_sheet_lines','petty_receipts','petty_links','cash_advances',
    'stationery_items','stationery_moves','stationery_counts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t||'_admin', t);
    perform audit_attach(t::regclass);
  end loop; end $$;

-- Locked month rejects writes to its lines, receipts, links.
create function petty_lock() returns trigger language plpgsql as $$
declare mid uuid; lk boolean;
begin
  if tg_table_name = 'petty_months' then
    if old.locked and new.locked then raise exception 'month is locked'; end if; return new;
  end if;
  if tg_table_name = 'petty_links' then
    select s.month_id into mid from petty_sheet_lines s where s.id = coalesce(new.sheet_line_id, old.sheet_line_id);
  else mid := coalesce(new.month_id, old.month_id); end if;
  select locked into lk from petty_months where id = mid;
  if lk then raise exception 'month is locked'; end if;
  return coalesce(new, old);
end $$;
create trigger lock_m before update on petty_months for each row execute function petty_lock();
create trigger lock_l before insert or update or delete on petty_sheet_lines for each row execute function petty_lock();
create trigger lock_r before insert or update or delete on petty_receipts for each row execute function petty_lock();
create trigger lock_k before insert or update or delete on petty_links for each row execute function petty_lock();

-- Staff access.
create policy adv_own_read on cash_advances for select using (user_id = auth.uid());
create policy adv_own_insert on cash_advances for insert with check (user_id = auth.uid() and status = 'Open');
create policy st_items_read on stationery_items for select using (is_active());
create policy st_moves_read on stationery_moves for select using (is_active());
create policy st_moves_take on stationery_moves for insert with check (user_id = auth.uid() and move_type = 'take');
create policy st_counts_read on stationery_counts for select using (is_active());
