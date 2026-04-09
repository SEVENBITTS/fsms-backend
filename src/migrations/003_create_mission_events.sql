create table if not exists mission_events (
  id bigserial primary key,

  mission_id uuid not null references missions(id) on delete cascade,
  mission_plan_id text null,

  event_type text not null,
  event_version integer not null default 1,

  event_ts timestamptz not null,
  recorded_at timestamptz not null default now(),

  sequence_no integer not null,

  actor_type text not null,
  actor_id text null,

  from_state text null,
  to_state text null,

  summary text not null,
  details jsonb not null default '{}'::jsonb,

  source_component text not null,
  source text not null,

  causation_id text null,
  correlation_id text null,
  request_id text null,

  severity text not null default 'info',
  safety_relevant boolean not null default false,
  compliance_relevant boolean not null default false,

  metadata jsonb not null default '{}'::jsonb,

  supersedes_event_id bigint null references mission_events(id)
);