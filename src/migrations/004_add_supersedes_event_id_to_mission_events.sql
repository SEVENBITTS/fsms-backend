alter table mission_events
add column if not exists supersedes_event_id bigint null references mission_events(id);