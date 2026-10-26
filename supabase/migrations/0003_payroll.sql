-- Payroll runs and payslips. Non-tax. Finalised runs are immutable.
create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period date not null unique check (extract(day from period) = 1),
  status text not null default 'Draft' check (status in ('Draft','Finalised')),
  finalised_by uuid references profiles(id), finalised_at timestamptz,
  signature_path text
);
create table payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payroll_runs(id) on delete cascade,
  user_id uuid not null references profiles(id),
  base numeric(14,2) not null, allowance numeric(14,2) not null, overtime numeric(14,2) not null,
  loan_deduction numeric(14,2) not null, other_deduction numeric(14,2) not null,
  net numeric(14,2) not null,
  unique (run_id, user_id)
);
create table payroll_corrections (
  id uuid primary key default gen_random_uuid(),
  source_ref text not null, user_id uuid references profiles(id), amount numeric(14,2) not null,
  note text, target_run_id uuid references payroll_runs(id), created_at timestamptz not null default now()
);

alter table payroll_runs enable row level security;
alter table payslips enable row level security;
alter table payroll_corrections enable row level security;
create policy runs_admin on payroll_runs for all using (is_admin()) with check (is_admin());
create policy slips_admin on payslips for all using (is_admin()) with check (is_admin());
-- Security definer: staff cannot read payroll_runs directly, so the policy must check status via a helper.
create function run_is_final(p_run uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from payroll_runs where id = p_run and status = 'Finalised')
$$;
create policy slips_own on payslips for select using (user_id = auth.uid() and run_is_final(run_id));
create policy corr_admin on payroll_corrections for all using (is_admin()) with check (is_admin());

create function lock_finalised() returns trigger language plpgsql as $$
declare rid uuid; st text;
begin
  if tg_table_name = 'payroll_runs' then
    if tg_op = 'DELETE' and old.status = 'Finalised' then raise exception 'finalised run is locked'; end if;
    if tg_op = 'UPDATE' and old.status = 'Finalised' then raise exception 'finalised run is locked'; end if;
    return coalesce(new, old);
  end if;
  rid := coalesce(new.run_id, old.run_id);
  select status into st from payroll_runs where id = rid;
  if st = 'Finalised' then raise exception 'payslips of a finalised run are locked'; end if;
  return coalesce(new, old);
end $$;
create trigger runs_lock before update or delete on payroll_runs for each row execute function lock_finalised();
create trigger slips_lock before insert or update or delete on payslips for each row execute function lock_finalised();

select audit_attach('payroll_runs'); select audit_attach('payslips'); select audit_attach('payroll_corrections');

-- Finalise: blocks while timesheets are pending, then locks in one transaction.
create function finalise_run(p_run uuid, p_signature text default null) returns void
language plpgsql security definer set search_path = public as $$
declare per date;
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  select period into per from payroll_runs where id = p_run and status = 'Draft';
  if per is null then raise exception 'run not found or already finalised'; end if;
  if exists (select 1 from time_entries where status = 'Pending'
             and work_date >= per and work_date < per + interval '1 month') then
    raise exception 'timesheets still awaiting approval';
  end if;
  if not exists (select 1 from payslips where run_id = p_run) then raise exception 'run has no payslips'; end if;
  update payroll_runs set status = 'Finalised', finalised_by = auth.uid(), finalised_at = now(),
    signature_path = p_signature where id = p_run;
end $$;
