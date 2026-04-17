-- db/migrations/20260412_add_mission_telemetry.sql

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
  created_at timestamptz not null default now(),

  constraint mission_telemetry_progress_pct_chk
    check (progress_pct is null or (progress_pct >= 0 and progress_pct <= 100)),

  constraint mission_telemetry_lat_chk
    check (lat is null or (lat >= -90 and lat <= 90)),

  constraint mission_telemetry_lng_chk
    check (lng is null or (lng >= -180 and lng <= 180))
);

create index if not exists idx_mission_telemetry_mission_recorded_at
  on mission_telemetry (mission_id, recorded_at desc);

create index if not exists idx_mission_telemetry_recorded_at
  on mission_telemetry (recorded_at desc);