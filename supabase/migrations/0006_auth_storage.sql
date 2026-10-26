-- Auth glue and storage. Self-signup must be disabled in the Supabase dashboard
-- (Authentication > Providers > Email > "Allow new users to sign up" off); admins invite staff.

-- Every new auth user gets a staff profile. Role is never taken from client-supplied metadata.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, name, email, role, must_change_password)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
          new.email, 'emp', true);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Self-service calls for the signed-in user. Narrow on purpose: staff cannot update profiles directly.
create function touch_seen() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen_at = now() where id = auth.uid() and access_enabled
$$;

create function record_login() returns void
language plpgsql security definer set search_path = public as $$
declare em text;
begin
  select email into em from profiles where id = auth.uid();
  update profiles set last_login_at = now(), last_seen_at = now() where id = auth.uid();
  insert into login_events(user_id, email, success) values (auth.uid(), em, true);
end $$;

-- Call after the user has set a new password through Supabase auth.
create function password_changed() returns void
language sql security definer set search_path = public as $$
  update profiles set must_change_password = false where id = auth.uid()
$$;

-- Admin-only: change a user's role or disable access (audited via the profiles trigger).
create function set_user_access(p_user uuid, p_role app_role, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  if p_user = auth.uid() and (p_role <> 'admin' or not p_enabled) then
    raise exception 'cannot remove your own admin access';
  end if;
  update profiles set role = p_role, access_enabled = p_enabled where id = p_user;
end $$;

revoke execute on function touch_seen, record_login, password_changed, set_user_access from public, anon;
grant execute on function touch_seen, record_login, password_changed, set_user_access to authenticated;

-- Storage buckets (skipped where the storage schema does not exist).
do $$ begin
  if to_regclass('storage.buckets') is null then return; end if;

  -- Private staff/admin documents: receipts, sheets, signatures. Path: <user uuid>/...
  insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('documents','documents', false, 10485760,
          array['application/pdf','image/jpeg','image/png',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
  on conflict (id) do nothing;

  -- Client KYC uploads: anonymous insert only, admin read.
  insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('kyc-uploads','kyc-uploads', false, 10485760,
          array['application/pdf','image/jpeg','image/png'])
  on conflict (id) do nothing;

  execute $p$create policy docs_admin on storage.objects for all
    using (bucket_id = 'documents' and is_admin()) with check (bucket_id = 'documents' and is_admin())$p$;
  execute $p$create policy docs_own_read on storage.objects for select to authenticated
    using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy docs_own_write on storage.objects for insert to authenticated
    with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy kyc_public_upload on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'kyc-uploads')$p$;
  execute $p$create policy kyc_admin_read on storage.objects for select
    using (bucket_id = 'kyc-uploads' and is_admin())$p$;
  execute $p$create policy kyc_admin_delete on storage.objects for delete
    using (bucket_id = 'kyc-uploads' and is_admin())$p$;
end $$;
