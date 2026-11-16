-- Meetings: company video/audio meetings with chat. The call itself is WebRTC between browsers; Supabase Realtime
-- (a PRIVATE broadcast channel per meeting, topic 'meeting:<id>') is only the signalling line (who is here, connection
-- offers, chat, reactions). This migration adds: the meetings list, the saved chat of each meeting, and the rules that
-- decide who may use a meeting's channel (any active staff member, and only for a meeting that exists). Re-runnable.

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  starts_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','ended')),
  created_by uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists meetings_starts on meetings (starts_at desc);

create table if not exists meeting_messages (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  author text check (author is null or char_length(author) <= 80),
  body text not null check (char_length(body) between 1 and 2000),
  at timestamptz not null default now()
);
alter table meeting_messages add column if not exists author text check (author is null or char_length(author) <= 80);
create index if not exists meeting_messages_m on meeting_messages (meeting_id, at);

alter table meetings enable row level security;
alter table meeting_messages enable row level security;
drop policy if exists meetings_read on meetings;
drop policy if exists meetings_insert on meetings;
drop policy if exists meetings_update on meetings;
drop policy if exists meetings_delete on meetings;
create policy meetings_read   on meetings for select using (is_active());
create policy meetings_insert on meetings for insert with check (is_active() and created_by = auth.uid());
create policy meetings_update on meetings for update using (is_admin() or created_by = auth.uid()) with check (is_admin() or created_by = auth.uid());
create policy meetings_delete on meetings for delete using (is_admin() or created_by = auth.uid());
drop policy if exists mm_read on meeting_messages;
drop policy if exists mm_insert on meeting_messages;
create policy mm_read   on meeting_messages for select using (is_active());
create policy mm_insert on meeting_messages for insert with check (is_active() and user_id = auth.uid()
  and exists (select 1 from meetings m where m.id = meeting_id and m.status = 'open'));

revoke all on meetings, meeting_messages from anon;
grant select, insert, update, delete on meetings to authenticated;
grant select, insert on meeting_messages to authenticated;

-- Who may use a meeting's realtime channel (Supabase "Realtime Authorization"): active staff, for an existing, open meeting.
do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists meeting_channel_read on realtime.messages';
    execute 'drop policy if exists meeting_channel_write on realtime.messages';
    execute $p$create policy meeting_channel_read on realtime.messages for select to authenticated
      using (realtime.messages.extension in ('broadcast') and realtime.topic() like 'meeting:%' and is_active()
             and exists (select 1 from public.meetings m where 'meeting:' || m.id::text = realtime.topic() and m.status = 'open'))$p$;
    execute $p$create policy meeting_channel_write on realtime.messages for insert to authenticated
      with check (realtime.messages.extension in ('broadcast') and realtime.topic() like 'meeting:%' and is_active()
             and exists (select 1 from public.meetings m where 'meeting:' || m.id::text = realtime.topic() and m.status = 'open'))$p$;
  end if;
end $$;
