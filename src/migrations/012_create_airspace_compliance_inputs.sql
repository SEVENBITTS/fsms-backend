create table if not exists airspace_compliance_inputs (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  airspace_class text not null,
  max_altitude_ft integer not null,
  restriction_status text not null,
  permission_status text not null,
  controlled_airspace boolean not null default false,
  nearby_aerodrome boolean not null default false,
  evidence_ref text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint airspace_class_chk
    check (airspace_class in ('a', 'b', 'c', 'd', 'e', 'f', 'g')),
  constraint airspace_max_altitude_chk
    check (max_altitude_ft >= 0),
  constraint airspace_restriction_status_chk
    check (restriction_status in ('clear', 'permission_required', 'restricted', 'prohibited')),
  constraint airspace_permission_status_chk
    check (permission_status in ('not_required', 'pending', 'granted', 'denied'))
);

create index if not exists idx_airspace_compliance_inputs_mission_created
  on airspace_compliance_inputs (mission_id, created_at desc);
