-- 0025: online / last seen for Messages (and the "delivered" tick). Re-runnable.
create table if not exists user_presence (
  user_id uuid primary key references profiles(id) on delete cascade,
  is_admin boolean not null default false,
  last_seen timestamptz not null default now()
);
alter table user_presence enable row level security;
drop policy if exists user_presence_read on user_presence;
create policy user_presence_read on user_presence for select to authenticated using (is_active());
grant select on user_presence to authenticated;

create or replace function touch_presence() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_active() then return; end if;
  insert into user_presence(user_id, is_admin, last_seen) values (auth.uid(), is_admin(), now())
  on conflict (user_id) do update set last_seen = now(), is_admin = excluded.is_admin;
end $$;
revoke execute on function touch_presence() from public, anon;
grant execute on function touch_presence() to authenticated;
