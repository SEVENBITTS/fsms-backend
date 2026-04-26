create table if not exists alerts (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,

  alert_type text not null,
  severity text not null,
  status text not null default 'open',

  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'telemetry',

  triggered_at timestamptz not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz null,
  resolved_at timestamptz null,

  constraint alerts_alert_type_chk
    check (alert_type in (
      'ALTITUDE_HIGH',
      'SPEED_HIGH',
      'RESTRICTED_ZONE',
      'MISSION_INACTIVE_TELEMETRY'
    )),

  constraint alerts_severity_chk
    check (severity in ('info', 'warning', 'critical')),

  constraint alerts_status_chk
    check (status in ('open', 'acknowledged', 'resolved'))
);

create index if not exists idx_alerts_mission_triggered_at
  on alerts (mission_id, triggered_at desc);

create index if not exists idx_alerts_status
  on alerts (status);

create index if not exists idx_alerts_type
  on alerts (alert_type);

create index if not exists idx_alerts_created_at
  on alerts (created_at desc);