-- Zoho Projects connection: each person connects their OWN Zoho account (OAuth). The tokens are kept here and are only ever
-- read by the 'zoho' Edge Function (service role). Nobody can read them from the browser: no policy and no grant exists
-- for anon or authenticated on these tables. The browser only gets a safe status through zoho_my_status(). Re-runnable.

create table if not exists zoho_connections (
  user_id uuid primary key references profiles(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_expires_at timestamptz,
  scope text,
  portals jsonb not null default '[]',
  portals_at timestamptz,
  cache jsonb,
  cache_at timestamptz,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz
);
create table if not exists zoho_oauth_states (
  state text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  return_url text,
  created_at timestamptz not null default now()
);
alter table zoho_connections enable row level security;
alter table zoho_oauth_states enable row level security;
revoke all on zoho_connections, zoho_oauth_states from anon, authenticated;

create or replace function zoho_my_status()
returns table (connected boolean, connected_at timestamptz, last_sync_at timestamptz, portals jsonb)
language sql security definer set search_path = public as $$
  select true, c.connected_at, c.last_sync_at, c.portals from zoho_connections c where c.user_id = auth.uid()
  union all
  select false, null::timestamptz, null::timestamptz, '[]'::jsonb where not exists (select 1 from zoho_connections c where c.user_id = auth.uid())
$$;
revoke all on function zoho_my_status() from public, anon;
grant execute on function zoho_my_status() to authenticated;
