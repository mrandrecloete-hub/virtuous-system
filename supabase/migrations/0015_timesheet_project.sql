-- Timesheet: optional project name on each time entry (shown in the Project column and filter).
-- Safe to run more than once. The app still works without it (the Project column shows '--').
alter table time_entries
  add column if not exists project text check (project is null or char_length(project) <= 120);
create index if not exists time_entries_project on time_entries (project) where project is not null;
