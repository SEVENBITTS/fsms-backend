create table if not exists mission_risk_inputs (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  operating_category text not null,
  mission_complexity text not null,
  population_exposure text not null,
  airspace_complexity text not null,
  weather_risk text not null,
  payload_risk text not null,
  mitigation_summary text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_risk_operating_category_chk
    check (operating_category in ('open', 'specific', 'certified')),
  constraint mission_risk_complexity_chk
    check (mission_complexity in ('low', 'medium', 'high')),
  constraint mission_risk_population_exposure_chk
    check (population_exposure in ('low', 'medium', 'high')),
  constraint mission_risk_airspace_complexity_chk
    check (airspace_complexity in ('low', 'medium', 'high')),
  constraint mission_risk_weather_risk_chk
    check (weather_risk in ('low', 'medium', 'high')),
  constraint mission_risk_payload_risk_chk
    check (payload_risk in ('low', 'medium', 'high'))
);

create index if not exists idx_mission_risk_inputs_mission_created
  on mission_risk_inputs (mission_id, created_at desc);
