-- Unique client names (case-insensitive) and indexes for the timesheet screens.
create unique index clients_name_key on clients (lower(name));
create index time_entries_user_date on time_entries (user_id, work_date);
create index time_entries_status on time_entries (status);
