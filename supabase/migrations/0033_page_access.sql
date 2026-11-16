-- Page access: an administrator can give a named employee FULL working access to specific admin pages (their "work functions"),
-- without making them an administrator. Pages: formbuilder (Form builder), receipts (Receipts), sheets (Petty cash sheet),
-- petty (Reconcile). Stored as profiles.perms (a list of page keys). Only administrators can change it (guard trigger + RPC,
-- audited through the profiles audit trigger). The extra policies below are ADDITIVE: they only open the tables, the saved
-- petty sheets setting and the storage buckets those pages use, for the people holding the matching key. Everything else stays
-- admin-only. Re-runnable.

alter table profiles add column if not exists perms text[] not null default '{}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_perms_known') then
    alter table profiles add constraint profiles_perms_known check (perms <@ array['formbuilder','receipts','sheets','petty']);
  end if;
end $$;

create or replace function has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from profiles where id = auth.uid() and access_enabled and p = any(perms))
$$;
create or replace function has_any_perm(ps text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from profiles where id = auth.uid() and access_enabled and perms && ps)
$$;
revoke all on function has_perm(text), has_any_perm(text[]) from public, anon;
grant execute on function has_perm(text), has_any_perm(text[]) to authenticated;

-- Only administrators may change role, access or perms.
create or replace function guard_profile_role() returns trigger language plpgsql as $$
begin
  if not is_admin() and (new.role is distinct from old.role or new.access_enabled is distinct from old.access_enabled
                         or new.perms is distinct from old.perms) then
    raise exception 'not permitted';
  end if;
  return new;
end $$;

create or replace function set_user_perms(p_user uuid, p_perms text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  if not (coalesce(p_perms, '{}') <@ array['formbuilder','receipts','sheets','petty']) then raise exception 'unknown page'; end if;
  update profiles set perms = coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_perms, '{}')) x), '{}') where id = p_user;
end $$;
revoke all on function set_user_perms(uuid, text[]) from public, anon;
grant execute on function set_user_perms(uuid, text[]) to authenticated;

-- Petty pages (Receipts, Petty cash sheet, Reconcile): the saved sheets setting and the documents bucket.
drop policy if exists app_settings_petty_perm on app_settings;
create policy app_settings_petty_perm on app_settings for all
  using (key = 'petty_sheets' and has_any_perm(array['receipts','sheets','petty']))
  with check (key = 'petty_sheets' and has_any_perm(array['receipts','sheets','petty']));

-- Form builder: forms, responses, notes, files.
do $$ declare t text; begin
  foreach t in array array['forms','form_submissions','submission_notes','files'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on %I', t || '_perm', t);
      execute format($p$create policy %I on %I for all using (has_perm('formbuilder')) with check (has_perm('formbuilder'))$p$, t || '_perm', t);
    end if;
  end loop;
end $$;

-- Storage: documents bucket for the petty pages, uploaded client files for the form builder.
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists docs_perm on storage.objects';
    execute 'drop policy if exists kyc_perm_read on storage.objects';
    execute 'drop policy if exists kyc_perm_delete on storage.objects';
    execute $p$create policy docs_perm on storage.objects for all
      using (bucket_id = 'documents' and has_any_perm(array['receipts','sheets','petty']))
      with check (bucket_id = 'documents' and has_any_perm(array['receipts','sheets','petty']))$p$;
    execute $p$create policy kyc_perm_read on storage.objects for select
      using (bucket_id = 'kyc-uploads' and has_perm('formbuilder'))$p$;
    execute $p$create policy kyc_perm_delete on storage.objects for delete
      using (bucket_id = 'kyc-uploads' and has_perm('formbuilder'))$p$;
  end if;
end $$;

-- One-time starting grant (owner's request): Bjorn's work functions are exactly these four pages, with full access.
-- Runs once (a marker setting stops it from re-granting after an administrator changes it). Matches an employee whose
-- name starts with "Bjorn"; the NOTICE below says who received it. Administrators can change it any time under
-- People > Employee dashboards.
do $$ declare n int;
begin
  if not exists (select 1 from app_settings where key = 'page_access_seed') then
    alter table profiles disable trigger profiles_guard;
    update profiles set perms = array['formbuilder','receipts','sheets','petty']
      where lower(name) like 'bjorn%' and role = 'emp';
    get diagnostics n = row_count;
    alter table profiles enable trigger profiles_guard;
    insert into app_settings (key, value) values ('page_access_seed', to_jsonb(now()::text)) on conflict (key) do nothing;
    raise notice 'Work functions: % employee(s) named Bjorn received Form builder, Receipts, Petty cash sheet and Reconcile.', n;
  end if;
end $$;
