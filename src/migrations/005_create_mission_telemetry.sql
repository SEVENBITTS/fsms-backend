create table if not exists mission_telemetry (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  recorded_at timestamptz not null,
  lat double precision null,
  lng double precision null,
  altitude_m double precision null,
  speed_mps double precision null,
  heading_deg double precision null,
  progress_pct double precision null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_mission_telemetry_mission_recorded_at
  on mission_telemetry (mission_id, recorded_at desc);

create index if not exists idx_mission_telemetry_recorded_at
  on mission_telemetry (recorded_at desc);