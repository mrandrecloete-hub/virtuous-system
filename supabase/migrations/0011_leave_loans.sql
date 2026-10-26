-- Leave and loans: validation, atomic decisions, withdrawals, default balances.
-- Starting leave balances are PLACEHOLDERS (Annual 15, Sick 10, Family responsibility 3).
-- Admins must set the real entitlements per person (Employees > Leave balances).

alter type approval_status add value if not exists 'Withdrawn';

alter table loans add column created_at timestamptz not null default now();

alter table leave_requests
  add column cover_name text, add column phone text,
  add column half_day boolean not null default false, add column doc_path text;

-- Server-side checks on a new leave request (the browser checks are only for convenience).
create function leave_request_check() returns trigger language plpgsql as $$
declare bal numeric; v_name text;
begin
  if new.days <= 0 or new.days > (new.to_date - new.from_date) + 1 then
    raise exception 'The number of days does not match the dates.';
  end if;
  if new.half_day and (new.from_date <> new.to_date or new.days <> 0.5) then
    raise exception 'A half day must be a single day.';
  end if;
  if exists (select 1 from leave_requests r where r.user_id = new.user_id and r.status in ('Pending','Approved')
             and r.id is distinct from new.id and not (new.to_date < r.from_date or new.from_date > r.to_date)) then
    raise exception 'These dates overlap another application.';
  end if;
  select days into bal from leave_balances where user_id = new.user_id and leave_type = new.leave_type;
  if found and new.days > bal then
    raise exception 'You only have % % days left.', bal, lower(new.leave_type);
  end if;
  if new.leave_type = 'Sick' and new.days > 2 and new.doc_path is null then
    raise exception 'Attach a doctor''s note for sick leave over 2 days.';
  end if;
  return new;
end $$;
create trigger leave_request_check before insert on leave_requests for each row execute function leave_request_check();

-- Default balances for everyone, now and for new people.
create function seed_leave_balances(p_user uuid) returns void
language sql security definer set search_path = public as $$
  insert into leave_balances(user_id, leave_type, days)
  values (p_user,'Annual',15),(p_user,'Sick',10),(p_user,'Family responsibility',3)
  on conflict do nothing
$$;
revoke execute on function seed_leave_balances from public, anon, authenticated;
create function profiles_seed_leave() returns trigger language plpgsql security definer set search_path = public as $$
begin perform seed_leave_balances(new.id); return new; end $$;
create trigger profiles_seed_leave after insert on profiles for each row execute function profiles_seed_leave();
select seed_leave_balances(id) from profiles;

-- Admin decides on leave. Deducts the balance in the same transaction.
create function decide_leave(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r leave_requests%rowtype; bal numeric;
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  select * into r from leave_requests where id = p_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'Pending' then raise exception 'That request has already been decided.'; end if;
  if p_approve then
    select days into bal from leave_balances where user_id = r.user_id and leave_type = r.leave_type for update;
    if found then
      if r.days > bal then raise exception 'Not enough % leave left (% days).', lower(r.leave_type), bal; end if;
      update leave_balances set days = days - r.days where user_id = r.user_id and leave_type = r.leave_type;
    end if;
  end if;
  update leave_requests set status = case when p_approve then 'Approved' else 'Rejected' end::approval_status,
    decided_by = auth.uid(), decided_at = now() where id = p_id;
  insert into notifications(kind, message, to_user_id)
  values ('Leave', 'Your ' || lower(r.leave_type) || ' leave from ' || to_char(r.from_date,'DD Mon') || ' to ' || to_char(r.to_date,'DD Mon')
          || ' was ' || case when p_approve then 'approved.' else 'rejected.' end, r.user_id);
end $$;

-- Admin decides on a salary advance. One active loan per person.
create function decide_loan(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r loans%rowtype;
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  select * into r from loans where id = p_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'Pending' then raise exception 'That request has already been decided.'; end if;
  if p_approve and exists (select 1 from loans where user_id = r.user_id and status = 'Active' and id <> r.id) then
    raise exception 'This person already has an active loan.';
  end if;
  update loans set status = case when p_approve then 'Active' else 'Rejected' end,
    decided_by = auth.uid(), decided_at = now() where id = p_id;
  insert into notifications(kind, message, to_user_id)
  values ('Loan', 'Your salary advance request (' || r.label || ') was ' || case when p_approve then 'approved.' else 'rejected.' end, r.user_id);
end $$;

-- The owner (or an admin) can withdraw a request that is still pending.
create function withdraw_request(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_kind = 'leave' then
    update leave_requests set status = 'Withdrawn'
      where id = p_id and status = 'Pending' and (user_id = auth.uid() or is_admin());
  elsif p_kind = 'loan' then
    update loans set status = 'Withdrawn'
      where id = p_id and status = 'Pending' and (user_id = auth.uid() or is_admin());
  else raise exception 'unknown request type'; end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'That request cannot be withdrawn.'; end if;
end $$;

-- Admin sets an entitlement. Audited through the table trigger.
create function set_leave_balance(p_user uuid, p_type text, p_days numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  if p_days < 0 or p_days > 366 then raise exception 'Days must be between 0 and 366.'; end if;
  if length(trim(p_type)) < 2 then raise exception 'Choose a leave type.'; end if;
  insert into leave_balances(user_id, leave_type, days) values (p_user, trim(p_type), p_days)
  on conflict (user_id, leave_type) do update set days = excluded.days;
end $$;

revoke execute on function decide_leave, decide_loan, withdraw_request, set_leave_balance from public, anon;
grant execute on function decide_leave, decide_loan, withdraw_request, set_leave_balance to authenticated;
