create table if not exists platforms (
  id uuid primary key,
  name text not null,
  registration text null,
  platform_type text null,
  manufacturer text null,
  model text null,
  serial_number text null,
  status text not null default 'active',
  total_flight_hours numeric(10, 2) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint platforms_status_chk
    check (status in (
      'active',
      'inactive',
      'maintenance_due',
      'grounded',
      'retired'
    )),

  constraint platforms_total_flight_hours_chk
    check (total_flight_hours >= 0)
);

create unique index if not exists idx_platforms_registration_unique
  on platforms (registration)
  where registration is not null;

create index if not exists idx_platforms_status
  on platforms (status);

create table if not exists maintenance_schedules (
  id uuid primary key,
  platform_id uuid not null references platforms(id) on delete cascade,
  task_name text not null,
  description text null,
  interval_days integer null,
  interval_flight_hours numeric(10, 2) null,
  last_completed_at timestamptz null,
  last_completed_flight_hours numeric(10, 2) null,
  next_due_at timestamptz null,
  next_due_flight_hours numeric(10, 2) null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint maintenance_schedules_status_chk
    check (status in ('active', 'inactive')),

  constraint maintenance_schedules_interval_days_chk
    check (interval_days is null or interval_days > 0),

  constraint maintenance_schedules_interval_flight_hours_chk
    check (interval_flight_hours is null or interval_flight_hours > 0),

  constraint maintenance_schedules_next_due_flight_hours_chk
    check (next_due_flight_hours is null or next_due_flight_hours >= 0),

  constraint maintenance_schedules_last_completed_flight_hours_chk
    check (
      last_completed_flight_hours is null
      or last_completed_flight_hours >= 0
    )
);

create index if not exists idx_maintenance_schedules_platform
  on maintenance_schedules (platform_id);

create index if not exists idx_maintenance_schedules_next_due_at
  on maintenance_schedules (next_due_at);

create table if not exists maintenance_records (
  id uuid primary key,
  platform_id uuid not null references platforms(id) on delete cascade,
  schedule_id uuid null references maintenance_schedules(id) on delete set null,
  task_name text not null,
  completed_at timestamptz not null,
  completed_by text not null,
  completed_flight_hours numeric(10, 2) null,
  notes text null,
  evidence_ref text null,
  created_at timestamptz not null default now(),

  constraint maintenance_records_completed_flight_hours_chk
    check (
      completed_flight_hours is null
      or completed_flight_hours >= 0
    )
);

create index if not exists idx_maintenance_records_platform_completed
  on maintenance_records (platform_id, completed_at desc);

create index if not exists idx_maintenance_records_schedule
  on maintenance_records (schedule_id);
