-- Clients, time, leave, loans, pay profiles.
create type approval_status as enum ('Draft','Pending','Approved','Rejected');

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null, hourly_rate numeric(14,2) not null default 0, billable boolean not null default true
);
alter table clients enable row level security;
create policy clients_read on clients for select using (is_active());
create policy clients_admin on clients for all using (is_admin()) with check (is_admin());
select audit_attach('clients');

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  client_id uuid references clients(id),
  work_date date not null, task text not null, hours numeric(5,2) not null check (hours >= 0 and hours <= 24),
  status approval_status not null default 'Draft',
  decided_by uuid references profiles(id), decided_at timestamptz
);
alter table time_entries enable row level security;
create policy te_read on time_entries for select using (user_id = auth.uid() or is_admin());
create policy te_own_insert on time_entries for insert with check (user_id = auth.uid() and status in ('Draft','Pending'));
create policy te_own_update on time_entries for update using (user_id = auth.uid() and status in ('Draft','Rejected'))
  with check (user_id = auth.uid() and status in ('Draft','Pending'));
create policy te_own_delete on time_entries for delete using (user_id = auth.uid() and status = 'Draft');
create policy te_admin on time_entries for all using (is_admin()) with check (is_admin());
select audit_attach('time_entries');

create table leave_balances (
  user_id uuid references profiles(id) on delete cascade, leave_type text, days numeric(5,1) not null,
  primary key (user_id, leave_type)
);
alter table leave_balances enable row level security;
create policy lb_read on leave_balances for select using (user_id = auth.uid() or is_admin());
create policy lb_admin on leave_balances for all using (is_admin()) with check (is_admin());
select audit_attach('leave_balances');

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  leave_type text not null, from_date date not null, to_date date not null check (to_date >= from_date),
  days numeric(5,1) not null, reason text, cover_user_id uuid references profiles(id),
  status approval_status not null default 'Pending',
  decided_by uuid references profiles(id), decided_at timestamptz
);
alter table leave_requests enable row level security;
create policy lr_read on leave_requests for select using (user_id = auth.uid() or is_admin());
create policy lr_own_insert on leave_requests for insert with check (user_id = auth.uid() and status = 'Pending');
create policy lr_admin on leave_requests for all using (is_admin()) with check (is_admin());
select audit_attach('leave_requests');

create table loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  label text not null, amount numeric(14,2) not null check (amount > 0),
  instalment numeric(14,2) not null check (instalment > 0), instalments_paid int not null default 0,
  status text not null default 'Pending',
  decided_by uuid references profiles(id), decided_at timestamptz
);
alter table loans enable row level security;
create policy loans_read on loans for select using (user_id = auth.uid() or is_admin());
create policy loans_own_insert on loans for insert with check (user_id = auth.uid() and status = 'Pending' and instalments_paid = 0);
create policy loans_admin on loans for all using (is_admin()) with check (is_admin());
select audit_attach('loans');

-- Effective-dated pay data. Staff cannot read other people's pay or edit their own.
create table pay_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  base_salary numeric(14,2) not null default 0, allowance numeric(14,2) not null default 0,
  overtime_hours numeric(6,2) not null default 0, loan_deduction numeric(14,2) not null default 0,
  other_deduction numeric(14,2) not null default 0,
  bank_account_encrypted bytea,
  effective_from date not null, effective_to date,
  check (effective_to is null or effective_to >= effective_from)
);
alter table pay_profiles enable row level security;
create policy pp_read on pay_profiles for select using (user_id = auth.uid() or is_admin());
create policy pp_admin on pay_profiles for all using (is_admin()) with check (is_admin());
select audit_attach('pay_profiles');
