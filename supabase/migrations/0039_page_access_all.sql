-- Page access for EVERY admin-only page (follows 0033). An administrator can now give a named employee full working access to
-- any of these pages without making them an administrator: reports, team, dashedit (Employee dashboards), kyc (Client KYC),
-- formbuilder, approvals, activity, audit, receipts, sheets, petty (Reconcile), clients (admin Timesheet), stmt (Statement
-- conversion), secretarial, studio (Customize). Pages that exist for staff too (Leave, Petty cash, Stationery list, Dashboard,
-- Messages ...) are not listed: staff already have their own version and the key would clash.
-- How it works: profiles.perms keeps the page keys (only an administrator can change it: RPC + guard trigger from 0033).
-- Below, ADDITIVE row-level-security policies open exactly the tables each page uses to the holders of that key, and the few
-- administrator-only functions behind those pages are re-created so a key holder passes their check (has_perm() already says
-- yes for administrators). Pages that run only in the browser (stmt, secretarial) need no database rights.
-- Still administrator-only whatever the grant: changing anybody's account type / access / page grants, inviting, resetting or
-- removing people (Edge Function admin-users, set_user_access, admin_remove_user), firm settings and everything not listed here.
-- Re-runnable. Run AFTER 0033. (Do not re-run 0033 afterwards: it would put the four-page limit back.)

create or replace function page_perm_keys() returns text[] language sql immutable as $$
  select array['formbuilder','receipts','sheets','petty','reports','team','dashedit','kyc','approvals','activity','audit',
               'clients','stmt','secretarial','studio']
$$;

alter table profiles drop constraint if exists profiles_perms_known;
alter table profiles add constraint profiles_perms_known check (perms <@ page_perm_keys());

create or replace function set_user_perms(p_user uuid, p_perms text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  if not (coalesce(p_perms, '{}') <@ page_perm_keys()) then raise exception 'unknown page'; end if;
  update profiles set perms = coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_perms, '{}')) x), '{}') where id = p_user;
end $$;
revoke all on function set_user_perms(uuid, text[]) from public, anon;
grant execute on function set_user_perms(uuid, text[]) to authenticated;

-- Table policies: (page key, table, 'all' or 'select')
do $$ declare r record; q text;
begin
  for r in select * from (values
    ('clients','clients','all'),('clients','time_entries','all'),
    ('approvals','time_entries','all'),('approvals','leave_requests','all'),('approvals','leave_balances','select'),
    ('reports','time_entries','select'),('reports','clients','select'),('reports','leave_requests','select'),
    ('reports','leave_balances','select'),('reports','cash_advances','select'),('reports','forms','select'),
    ('reports','form_submissions','select'),('reports','profiles','select'),
    ('activity','login_events','select'),('activity','audit_log','select'),('activity','profiles','select'),
    ('audit','audit_log','select'),('audit','profiles','select'),
    ('team','profiles','all'),('team','login_events','select'),
    ('dashedit','dash_configs','select'),('dashedit','dash_task_done','select'),('dashedit','profiles','select'),
    ('kyc','forms','all'),('kyc','form_submissions','all'),('kyc','submission_notes','all'),('kyc','files','all'),
    ('kyc','client_letters','all'),
    ('studio','custom_pages','all')
  ) v(k, t, c)
  loop
    if to_regclass('public.' || r.t) is null then continue; end if;
    execute format('drop policy if exists %I on %I', r.t || '_perm_' || r.k, r.t);
    if r.c = 'all' then
      q := format('create policy %I on %I for all using (has_perm(%L)) with check (has_perm(%L))', r.t || '_perm_' || r.k, r.t, r.k, r.k);
    else
      q := format('create policy %I on %I for select using (has_perm(%L))', r.t || '_perm_' || r.k, r.t, r.k);
    end if;
    execute q;
  end loop;
end $$;

-- Customize (studio) keeps its menu and dashboard layout in two firm-settings rows only.
drop policy if exists app_settings_perm_studio on app_settings;
create policy app_settings_perm_studio on app_settings for all
  using (key in ('studio_menu','studio_dash') and has_perm('studio'))
  with check (key in ('studio_menu','studio_dash') and has_perm('studio'));

-- Client KYC: the files clients uploaded (private bucket), same rights as the Form builder already has from 0033.
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists kyc_perm_read_kyc on storage.objects';
    execute 'drop policy if exists kyc_perm_delete_kyc on storage.objects';
    execute $p$create policy kyc_perm_read_kyc on storage.objects for select
      using (bucket_id = 'kyc-uploads' and has_perm('kyc'))$p$;
    execute $p$create policy kyc_perm_delete_kyc on storage.objects for delete
      using (bucket_id = 'kyc-uploads' and has_perm('kyc'))$p$;
  end if;
end $$;

-- Administrator-only functions behind these pages: re-create the CURRENT definition with the check
-- "is_admin()" -> "has_perm('<page>')" (has_perm is true for administrators too). Nothing else in them changes.
do $$ declare r record; def text;
begin
  for r in select * from (values
    ('decide_leave','approvals'),('reconsider_leave','approvals'),('set_leave_reason','approvals'),
    ('delete_leave_request','approvals'),('publish_dashboard','dashedit'),('time_entries_billed_guard','clients')
  ) v(f, k)
  loop
    for def in select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = r.f
    loop
      if position('is_admin()' in def) > 0 then
        execute replace(def, 'is_admin()', format('has_perm(%L)', r.k));
      end if;
    end loop;
  end loop;
end $$;
