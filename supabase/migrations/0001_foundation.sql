-- Foundation: profiles, roles, audit log, settings, notifications.
create extension if not exists pgcrypto;

create type app_role as enum ('admin','emp');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  title text,
  email text not null unique,
  role app_role not null default 'emp',
  access_enabled boolean not null default true,
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Security-definer helpers avoid RLS recursion on profiles.
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and access_enabled)
$$;

create function is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and access_enabled)
$$;

alter table profiles enable row level security;
create policy profiles_read on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_admin_write on profiles for all using (is_admin()) with check (is_admin());
-- Staff may update only their own seen/login timestamps and password flag via RPC, not directly.

-- Prevent non-admins escalating role through any path.
create function guard_profile_role() returns trigger language plpgsql as $$
begin
  if not is_admin() and (new.role is distinct from old.role or new.access_enabled is distinct from old.access_enabled) then
    raise exception 'not permitted';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles for each row execute function guard_profile_role();

-- Audit log: append-only, written by triggers.
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  action text not null,
  table_name text,
  row_id text,
  detail jsonb
);
alter table audit_log enable row level security;
create policy audit_admin_read on audit_log for select using (is_admin());
-- No insert/update/delete policies: only security-definer triggers write.
revoke update, delete, truncate on audit_log from public, anon, authenticated;

create function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; nm text;
begin
  r := to_jsonb(coalesce(new, old));
  select name into nm from profiles where id = auth.uid();
  insert into audit_log(actor_id, actor_name, action, table_name, row_id, detail)
  values (auth.uid(), coalesce(nm,'System'), tg_op, tg_table_name, r->>'id',
          case tg_op when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
                     when 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create function audit_attach(t regclass) returns void language plpgsql as $$
begin
  execute format('create trigger audit_%s after insert or update or delete on %s for each row execute function audit_row()', replace(t::text,'.','_'), t);
end $$;

select audit_attach('profiles');

create table login_events (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete set null,
  email text, at timestamptz not null default now(), success boolean not null
);
alter table login_events enable row level security;
create policy login_admin_read on login_events for select using (is_admin());

create table app_settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
create policy settings_read on app_settings for select using (is_active());
create policy settings_admin on app_settings for all using (is_admin()) with check (is_admin());
select audit_attach('app_settings');
insert into app_settings values
  ('petty_tolerance','2'), ('petty_match_threshold','0.6'), ('stationery_low_threshold','2');

create table notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null, message text not null,
  to_user_id uuid references profiles(id) on delete cascade, -- null = role broadcast
  staff_visible boolean not null default false,
  created_at timestamptz not null default now()
);
create table notification_reads (
  notification_id uuid references notifications(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
alter table notifications enable row level security;
alter table notification_reads enable row level security;
create policy notes_read on notifications for select using (
  is_admin() or (is_active() and (to_user_id = auth.uid() or (to_user_id is null and staff_visible))));
create policy notes_admin_write on notifications for all using (is_admin()) with check (is_admin());
create policy reads_own on notification_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
