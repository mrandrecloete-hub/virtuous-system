-- Claude access: an administrator can give Claude (or any MCP client) READ-ONLY access to chosen parts of the app,
-- through the 'claude-access' Edge Function. Access is by a secret token that is created in the browser, shown once,
-- and stored here ONLY as a SHA-256 hash. Each grant has scopes (what it may read), an expiry (1 to 90 days) and can be
-- revoked at any time. A master switch (app_settings key 'claude_access') must also be on. Re-runnable.

create table if not exists ai_access_grants (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 60),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_hint text not null check (char_length(token_hint) = 4),
  scopes text[] not null check (cardinality(scopes) > 0 and scopes <@ array['overview','stationery','timesheets','leave','kyc','petty']),
  expires_at timestamptz not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count integer not null default 0
);
create table if not exists ai_access_log (
  id bigint generated always as identity primary key,
  grant_id uuid references ai_access_grants(id) on delete cascade,
  at timestamptz not null default now(),
  tool text not null,
  ok boolean not null,
  detail text
);
create index if not exists ai_access_log_grant_at on ai_access_log (grant_id, at desc);

alter table ai_access_grants enable row level security;
alter table ai_access_log enable row level security;
drop policy if exists ai_grants_admin_read on ai_access_grants;
drop policy if exists ai_log_admin_read on ai_access_log;
create policy ai_grants_admin_read on ai_access_grants for select using (is_admin());
create policy ai_log_admin_read on ai_access_log for select using (is_admin());

-- No direct writes from the browser: only the two functions below (admins) and the Edge Function (service role).
revoke all on ai_access_grants from anon, authenticated;
revoke all on ai_access_log from anon, authenticated;
grant select on ai_access_grants to authenticated;
grant select on ai_access_log to authenticated;

create or replace function ai_grant_create(p_label text, p_scopes text[], p_days integer, p_hash text, p_hint text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not is_admin() then raise exception 'Only an administrator can give access.'; end if;
  if p_days is null or p_days < 1 or p_days > 90 then raise exception 'Access can last from 1 to 90 days.'; end if;
  insert into ai_access_grants (label, token_hash, token_hint, scopes, expires_at)
  values (trim(p_label), p_hash, p_hint, p_scopes, now() + make_interval(days => p_days))
  returning id into v_id;
  select name into v_name from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, table_name, row_id, detail)
  values (auth.uid(), v_name, 'INSERT', 'ai_access_grants', v_id::text,
          jsonb_build_object('label', trim(p_label), 'scopes', p_scopes, 'days', p_days));
  return v_id;
end $$;

create or replace function ai_grant_revoke(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_label text;
begin
  if not is_admin() then raise exception 'Only an administrator can remove access.'; end if;
  update ai_access_grants set revoked_at = now() where id = p_id and revoked_at is null returning label into v_label;
  if v_label is null then return; end if;
  select name into v_name from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, table_name, row_id, detail)
  values (auth.uid(), v_name, 'UPDATE', 'ai_access_grants', p_id::text, jsonb_build_object('label', v_label, 'revoked', true));
end $$;

revoke all on function ai_grant_create(text, text[], integer, text, text) from public, anon;
revoke all on function ai_grant_revoke(uuid) from public, anon;
grant execute on function ai_grant_create(text, text[], integer, text, text) to authenticated;
grant execute on function ai_grant_revoke(uuid) to authenticated;
