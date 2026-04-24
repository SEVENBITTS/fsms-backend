alter table aircraft_type_specs
  add column if not exists manufacturer_maintenance_schedule_ref text null,
  add column if not exists manufacturer_maintenance_schedule_version text null,
  add column if not exists manufacturer_maintenance_schedule_url text null,
  add column if not exists manufacturer_maintenance_advice text null,
  add column if not exists recommended_inspection_interval_days integer null,
  add column if not exists recommended_inspection_interval_flight_hours numeric(10, 3) null;

alter table aircraft_type_specs
  drop constraint if exists aircraft_type_specs_maintenance_guidance_chk;

alter table aircraft_type_specs
  add constraint aircraft_type_specs_maintenance_guidance_chk check (
    (recommended_inspection_interval_days is null or recommended_inspection_interval_days > 0)
    and (
      recommended_inspection_interval_flight_hours is null
      or recommended_inspection_interval_flight_hours > 0
    )
  );
