-- Payroll (NON-TAX): draft generation, per-person inputs, finalise with loan instalments, pay details.
-- No PAYE, SSC or other statutory deductions are calculated. They need verified, effective-dated rules.

alter table payslips add column period date, add column overtime_hours numeric(6,2) not null default 0;

-- Firm settings for the overtime formula (editable by admin; not statutory figures).
insert into app_settings(key, value) values ('payroll_monthly_hours','173.33'), ('payroll_overtime_multiplier','1.5')
on conflict (key) do nothing;

create function payroll_setting(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from app_settings where key = p_key), p_default)
$$;

-- overtime pay = hours x (basic / monthly hours) x multiplier, rounded to cents
create function payroll_overtime_pay(p_base numeric, p_hours numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select round(p_hours * (p_base / greatest(payroll_setting('payroll_monthly_hours',173.33),1))
               * payroll_setting('payroll_overtime_multiplier',1.5), 2)
$$;

-- Effective-dated pay details: closes the current record and starts a new one.
create function set_pay_profile(p_user uuid, p_base numeric, p_allow numeric, p_other numeric, p_from date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  if p_base < 0 or p_allow < 0 or p_other < 0 then raise exception 'Amounts cannot be negative.'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'Employee not found.'; end if;
  if exists (select 1 from pay_profiles where user_id = p_user and effective_from >= p_from) then
    raise exception 'A pay record already starts on or after that date.';
  end if;
  update pay_profiles set effective_to = p_from - 1 where user_id = p_user and (effective_to is null or effective_to >= p_from);
  insert into pay_profiles(user_id, base_salary, allowance, overtime_hours, loan_deduction, other_deduction, effective_from)
  values (p_user, p_base, p_allow, 0, 0, p_other, p_from);
end $$;

-- Create (or, with p_regenerate, rebuild) the draft payslips for a month.
create function generate_payroll(p_period date, p_regenerate boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare per date := date_trunc('month', p_period)::date; pend date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
        run payroll_runs%rowtype; r record; n int := 0; skipped text[] := '{}'; loan numeric; lo loans%rowtype;
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  select * into run from payroll_runs where period = per for update;
  if found and run.status = 'Finalised' then raise exception 'That month is finalised and locked.'; end if;
  if not found then insert into payroll_runs(period) values (per) returning * into run; end if;
  if exists (select 1 from payslips where run_id = run.id) then
    if not p_regenerate then raise exception 'Payslips already exist for that month.'; end if;
    delete from payslips where run_id = run.id;
  end if;
  for r in select p.id, p.name, pp.base_salary, pp.allowance, pp.overtime_hours, pp.other_deduction
           from profiles p
           left join lateral (select * from pay_profiles x where x.user_id = p.id and x.effective_from <= pend
                              and (x.effective_to is null or x.effective_to >= per) order by x.effective_from desc limit 1) pp on true
           where p.access_enabled and p.role = 'emp' order by p.name loop
    if r.base_salary is null then skipped := skipped || r.name; continue; end if;
    loan := 0;
    select * into lo from loans where user_id = r.id and status = 'Active' order by created_at limit 1;
    if found then loan := greatest(0, least(lo.instalment, lo.amount - lo.instalments_paid * lo.instalment)); end if;
    insert into payslips(run_id, user_id, period, base, allowance, overtime_hours, overtime, loan_deduction, other_deduction, net)
    values (run.id, r.id, per, r.base_salary, r.allowance, r.overtime_hours, payroll_overtime_pay(r.base_salary, r.overtime_hours), loan, r.other_deduction,
            r.base_salary + r.allowance + payroll_overtime_pay(r.base_salary, r.overtime_hours) - loan - r.other_deduction);
    n := n + 1;
  end loop;
  return jsonb_build_object('run_id', run.id, 'created', n, 'skipped', to_jsonb(skipped));
end $$;

-- Per-person inputs on a DRAFT payslip. Recalculates server-side.
create function set_payslip_inputs(p_slip uuid, p_ot_hours numeric, p_other numeric) returns void
language plpgsql security definer set search_path = public as $$
declare s payslips%rowtype; ot numeric;
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  select * into s from payslips where id = p_slip for update;
  if not found then raise exception 'Payslip not found.'; end if;
  if exists (select 1 from payroll_runs where id = s.run_id and status = 'Finalised') then raise exception 'That payroll is finalised and locked.'; end if;
  if p_ot_hours < 0 or p_ot_hours > 300 then raise exception 'Overtime hours must be between 0 and 300.'; end if;
  if p_other < 0 then raise exception 'Deductions cannot be negative.'; end if;
  ot := payroll_overtime_pay(s.base, p_ot_hours);
  if s.base + s.allowance + ot - s.loan_deduction - p_other < 0 then raise exception 'Deductions are more than the pay.'; end if;
  update payslips set overtime_hours = p_ot_hours, overtime = ot, other_deduction = p_other,
    net = s.base + s.allowance + ot - s.loan_deduction - p_other where id = p_slip;
end $$;

-- Finalise: blocked by pending timesheets; advances each deducted loan by one instalment; then locks.
create or replace function finalise_run(p_run uuid, p_signature text default null) returns void
language plpgsql security definer set search_path = public as $$
declare per date; s record; lo loans%rowtype;
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  select period into per from payroll_runs where id = p_run and status = 'Draft' for update;
  if per is null then raise exception 'run not found or already finalised'; end if;
  if exists (select 1 from time_entries where status = 'Pending'
             and work_date >= per and work_date < per + interval '1 month') then
    raise exception 'timesheets still awaiting approval';
  end if;
  if not exists (select 1 from payslips where run_id = p_run) then raise exception 'run has no payslips'; end if;
  for s in select user_id, loan_deduction from payslips where run_id = p_run and loan_deduction > 0 loop
    select * into lo from loans where user_id = s.user_id and status = 'Active' order by created_at limit 1 for update;
    if found then
      update loans set instalments_paid = instalments_paid + 1,
        status = case when (instalments_paid + 1) * instalment >= amount then 'Completed' else 'Active' end where id = lo.id;
    end if;
  end loop;
  update payroll_runs set status = 'Finalised', finalised_by = auth.uid(), finalised_at = now(), signature_path = p_signature where id = p_run;
end $$;

revoke execute on function set_pay_profile, generate_payroll, set_payslip_inputs, finalise_run from public, anon;
grant execute on function set_pay_profile, generate_payroll, set_payslip_inputs, finalise_run to authenticated;
revoke execute on function payroll_setting, payroll_overtime_pay from public, anon;
