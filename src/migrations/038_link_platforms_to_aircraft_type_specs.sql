alter table platforms
  add column if not exists aircraft_type_spec_id uuid null
    references aircraft_type_specs(id) on delete set null;

create index if not exists idx_platforms_aircraft_type_spec_id
  on platforms (aircraft_type_spec_id);
