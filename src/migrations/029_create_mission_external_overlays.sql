create table if not exists mission_external_overlays (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  overlay_kind text not null,
  source_provider text not null,
  source_type text not null,
  source_record_id text null,
  observed_at timestamptz not null,
  valid_from timestamptz null,
  valid_to timestamptz null,
  geometry_type text not null,
  latitude double precision null,
  longitude double precision null,
  altitude_msl_ft double precision null,
  heading_degrees double precision null,
  speed_knots double precision null,
  severity text null,
  confidence double precision null,
  freshness_seconds integer null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_external_overlays_kind_chk
    check (overlay_kind in ('weather', 'crewed_traffic', 'drone_traffic')),
  constraint mission_external_overlays_geometry_chk
    check (geometry_type in ('point', 'polyline', 'polygon', 'circle')),
  constraint mission_external_overlays_severity_chk
    check (severity in ('info', 'caution', 'critical') or severity is null)
);

create index if not exists idx_mission_external_overlays_mission_observed_at
  on mission_external_overlays (mission_id, observed_at desc);

create index if not exists idx_mission_external_overlays_kind
  on mission_external_overlays (overlay_kind);
