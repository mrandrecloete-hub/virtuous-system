-- Daily per-user cap on assistant calls, to bound cost and abuse.
create table assistant_usage (
  user_id uuid references profiles(id) on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  primary key (user_id, day)
);
alter table assistant_usage enable row level security;
create policy usage_read on assistant_usage for select using (user_id = auth.uid() or is_admin());

-- Returns true if the call is allowed, and counts it.
create function assistant_bump(p_limit int default 100) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if not is_active() then return false; end if;
  insert into assistant_usage(user_id) values (auth.uid())
    on conflict (user_id, day) do update set calls = assistant_usage.calls + 1
    returning calls into c;
  return c <= p_limit;
end $$;
revoke execute on function assistant_bump from public, anon;
grant execute on function assistant_bump to authenticated;
