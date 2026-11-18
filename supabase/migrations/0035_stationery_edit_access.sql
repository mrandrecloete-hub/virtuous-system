-- Stationery list: every active person can edit it. Office Essentials: administrators and Alexis can edit it.
-- Only these two settings are opened (app_settings keys 'stationery_sheet' and 'office_list'); everything else stays admin-only.
-- Safe to run more than once.
create or replace function is_office_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from profiles p where p.id = auth.uid() and p.access_enabled and p.name ~* '^\s*alexis\M');
$$;
grant execute on function is_office_editor() to authenticated;

drop policy if exists settings_stationery_all on app_settings;
create policy settings_stationery_all on app_settings for all
  using (key = 'stationery_sheet' and is_active()) with check (key = 'stationery_sheet' and is_active());

drop policy if exists settings_office_editor on app_settings;
create policy settings_office_editor on app_settings for all
  using (key = 'office_list' and is_office_editor()) with check (key = 'office_list' and is_office_editor());
