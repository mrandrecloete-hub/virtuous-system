-- Admin: remove a person from the system and free their email address.
-- 1) Tries a real delete of the sign-in account (the profile and the person's own leave records, balances,
--    messages and notifications go with it).
-- 2) If other records still point at the person (timesheets, payroll, petty cash, approvals ...), nothing is deleted:
--    the account is CLOSED instead. Sign-in is blocked, the email is replaced by a placeholder so the same
--    address can be used again for a new account, and the history stays intact.
-- Guards: admins only; the only active admin cannot be removed (make someone else an admin first).
-- Safe to run more than once.
create or replace function admin_remove_user(p_user uuid) returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  t profiles%rowtype;
  others int;
  newmail text;
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  select * into t from profiles where id = p_user;
  if not found then raise exception 'That account was not found.'; end if;
  if t.role = 'admin' and t.access_enabled then
    select count(*) into others from profiles where role = 'admin' and access_enabled and id <> p_user;
    if others = 0 then
      raise exception 'You cannot remove the only active admin. Make someone else an admin first.';
    end if;
  end if;
  begin
    delete from auth.users where id = p_user;
    if found then return 'deleted'; end if;
    raise exception 'sign-in account not found' using errcode = 'P0002';
  exception
    when foreign_key_violation or restrict_violation then
      newmail := 'removed-' || replace(p_user::text, '-', '') || '@removed.invalid';
      update auth.users set email = newmail, banned_until = 'infinity', encrypted_password = null where id = p_user;
      if to_regclass('auth.identities') is not null then
        execute 'update auth.identities set provider_id = $1, identity_data = identity_data || jsonb_build_object(''email'', $1) where user_id = $2'
          using newmail, p_user;
      end if;
      if to_regclass('auth.sessions') is not null then
        execute 'delete from auth.sessions where user_id = $1' using p_user;
      end if;
      update profiles set email = newmail, access_enabled = false where id = p_user;
      return 'closed';
    when no_data_found then
      -- profile without a sign-in account: just remove the profile if nothing uses it, else close it
      begin
        delete from profiles where id = p_user;
        return 'deleted';
      exception when foreign_key_violation or restrict_violation then
        newmail := 'removed-' || replace(p_user::text, '-', '') || '@removed.invalid';
        update profiles set email = newmail, access_enabled = false where id = p_user;
        return 'closed';
      end;
  end;
end $$;

revoke execute on function admin_remove_user(uuid) from public, anon;
grant execute on function admin_remove_user(uuid) to authenticated;
