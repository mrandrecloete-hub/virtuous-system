-- Optional personal details and profile photo for every user (admins and employees). Everyone edits only their own row; admins can read all.
-- The photo is a small (256 px) JPEG stored as a data URL. Safe to run more than once.
create table if not exists profile_extra (
  user_id uuid primary key references profiles(id) on delete cascade default auth.uid(),
  phone text check (char_length(phone) <= 40),
  address text check (char_length(address) <= 300),
  birthday date,
  emergency_name text check (char_length(emergency_name) <= 100),
  emergency_phone text check (char_length(emergency_phone) <= 40),
  about text check (char_length(about) <= 500),
  avatar text check (avatar is null or (char_length(avatar) <= 150000 and avatar like 'data:image/jpeg;base64,%')),
  updated_at timestamptz not null default now()
);
alter table profile_extra enable row level security;
drop policy if exists profile_extra_read on profile_extra;
create policy profile_extra_read on profile_extra for select using (is_active() and (user_id = auth.uid() or is_admin()));
drop policy if exists profile_extra_ins on profile_extra;
create policy profile_extra_ins on profile_extra for insert with check (is_active() and user_id = auth.uid());
drop policy if exists profile_extra_upd on profile_extra;
create policy profile_extra_upd on profile_extra for update using (is_active() and user_id = auth.uid()) with check (is_active() and user_id = auth.uid());
drop policy if exists profile_extra_del on profile_extra;
create policy profile_extra_del on profile_extra for delete using (is_active() and user_id = auth.uid());
grant select, insert, update, delete on profile_extra to authenticated;
create or replace function profile_extra_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists profile_extra_touch on profile_extra;
create trigger profile_extra_touch before update on profile_extra for each row execute function profile_extra_touch();
