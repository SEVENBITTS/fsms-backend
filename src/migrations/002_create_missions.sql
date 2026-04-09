create table if not exists missions (
  id uuid primary key,
  status text not null,
  mission_plan_id text null,
  last_event_sequence_no integer not null default 0
);