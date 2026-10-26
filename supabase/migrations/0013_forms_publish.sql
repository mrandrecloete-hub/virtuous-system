-- Forms: saved design/settings, sharing, and safe public submissions.

alter table forms
  add column thanks text,
  add column design jsonb not null default '{}',
  add column settings jsonb not null default '{}',
  add column public_link boolean not null default false,
  add column updated_at timestamptz not null default now();

create function forms_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger forms_touch before update on forms for each row execute function forms_touch();

-- Who can read forms:
--  * admins: everything (policy forms_admin)
--  * signed-in staff: open staff forms
--  * anyone (no sign-in): only open CLIENT forms the admin has shared with a public link
drop policy if exists forms_public_read on forms;
create policy forms_staff_read on forms for select to authenticated
  using (is_admin() or (status = 'open' and audience = 'staff'));
create policy forms_public_read on forms for select to anon
  using (status = 'open' and audience = 'client' and public_link);

-- Who can submit: anonymous visitors only to a shared, open client form; signed-in people to open forms
-- of the matching audience. Never able to set their own status, signature flag or reviewer.
drop policy if exists subs_public_insert on form_submissions;
create policy subs_public_insert on form_submissions for insert to anon, authenticated with check (
  status = 'Pending' and signed = false and reviewed_by is null
  and exists (select 1 from forms f where f.id = form_id and f.status = 'open'
    and ((f.audience = 'client' and (f.public_link or auth.uid() is not null))
      or (f.audience = 'staff' and auth.uid() is not null))));

-- Basic abuse limits for public submissions.
alter table form_submissions add constraint form_submissions_answers_size check (pg_column_size(answers) < 3000000);
create function form_submission_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from form_submissions where form_id = new.form_id and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'This form is receiving too many submissions right now. Try again later.';
  end if;
  return new;
end $$;
create trigger form_submission_guard before insert on form_submissions for each row execute function form_submission_guard();

-- Anonymous visitors may read only the columns needed to show a shared form. The `settings` column
-- (quiz answer keys, email text) stays private to signed-in people allowed by the policies above.
revoke select on forms from anon;
grant select (id, title, description, thanks, category, audience, status, fields, design, public_link) on forms to anon;
