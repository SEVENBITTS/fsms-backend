create table if not exists aircraft_type_specs (
  id uuid primary key,
  display_name text not null,
  manufacturer text not null,
  model text not null,
  aircraft_type text null,
  mtom_kg numeric(10, 3) null,
  max_payload_kg numeric(10, 3) null,
  max_wind_mps numeric(10, 3) null,
  max_gust_mps numeric(10, 3) null,
  min_operating_temp_c numeric(10, 3) null,
  max_operating_temp_c numeric(10, 3) null,
  max_flight_time_min integer null,
  max_range_m integer null,
  ip_rating text null,
  gnss_capability text null,
  rtk_capable boolean not null default false,
  source_type text not null default 'curated',
  source_reference text not null,
  source_version text null,
  source_url text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint aircraft_type_specs_source_type_chk
    check (source_type in ('manufacturer', 'curated', 'operator', 'api')),
  constraint aircraft_type_specs_positive_numbers_chk
    check (
      (mtom_kg is null or mtom_kg > 0)
      and (max_payload_kg is null or max_payload_kg >= 0)
      and (max_wind_mps is null or max_wind_mps > 0)
      and (max_gust_mps is null or max_gust_mps > 0)
      and (max_flight_time_min is null or max_flight_time_min > 0)
      and (max_range_m is null or max_range_m > 0)
    ),
  constraint aircraft_type_specs_temp_range_chk
    check (
      min_operating_temp_c is null
      or max_operating_temp_c is null
      or min_operating_temp_c <= max_operating_temp_c
    )
);

create unique index if not exists idx_aircraft_type_specs_identity
  on aircraft_type_specs (
    lower(manufacturer),
    lower(model),
    coalesce(lower(source_version), '')
  );

create index if not exists idx_aircraft_type_specs_manufacturer_model
  on aircraft_type_specs (manufacturer, model);
