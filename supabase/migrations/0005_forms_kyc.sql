-- Forms, public KYC submissions, files metadata.
create table forms (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text, category text default 'KYC',
  audience text not null default 'client' check (audience in ('client','staff')),
  status text not null default 'open' check (status in ('open','closed')),
  fields jsonb not null default '[]', created_at timestamptz not null default now()
);
create sequence kyc_ref_seq;
create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('KYC-' || lpad(nextval('kyc_ref_seq')::text, 6, '0')),
  form_id uuid not null references forms(id), submitted_by uuid references profiles(id),
  answers jsonb not null, status text not null default 'Pending', signed boolean not null default false,
  reviewed_by uuid references profiles(id), created_at timestamptz not null default now()
);
create table submission_notes (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references form_submissions(id) on delete cascade,
  author_id uuid references profiles(id) default auth.uid(), body text not null, at timestamptz not null default now()
);

alter table forms enable row level security;
alter table form_submissions enable row level security;
alter table submission_notes enable row level security;
create policy forms_admin on forms for all using (is_admin()) with check (is_admin());
create policy forms_public_read on forms for select to anon, authenticated using (status = 'open');
-- Public may submit to open client forms only, never read submissions back.
create policy subs_public_insert on form_submissions for insert to anon, authenticated with check (
  status = 'Pending' and signed = false and reviewed_by is null
  and exists (select 1 from forms f where f.id = form_id and f.status = 'open'
              and (f.audience = 'client' or auth.uid() is not null)));
create policy subs_admin on form_submissions for all using (is_admin()) with check (is_admin());
create policy subs_own_read on form_submissions for select using (submitted_by = auth.uid());
create policy notes_admin on submission_notes for all using (is_admin()) with check (is_admin());
revoke select on form_submissions from anon;
select audit_attach('forms'); select audit_attach('form_submissions'); select audit_attach('submission_notes');

-- Files: metadata only; objects live in a private storage bucket 'documents'.
create table files (
  id uuid primary key default gen_random_uuid(), storage_path text not null unique, name text not null,
  size bigint, kind text, uploaded_by uuid references profiles(id) default auth.uid(), created_at timestamptz not null default now()
);
alter table files enable row level security;
create policy files_admin on files for all using (is_admin()) with check (is_admin());
create policy files_own on files for select using (uploaded_by = auth.uid());
