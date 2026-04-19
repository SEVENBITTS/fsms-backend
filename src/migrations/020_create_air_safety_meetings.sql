create table if not exists air_safety_meetings (
  id uuid primary key,
  meeting_type text not null check (
    meeting_type in (
      'quarterly_air_safety_review',
      'event_triggered_safety_review',
      'sop_breach_review',
      'training_review',
      'maintenance_safety_review',
      'accountable_manager_review'
    )
  ),
  scheduled_period_start date,
  scheduled_period_end date,
  due_at timestamptz not null,
  held_at timestamptz,
  status text not null check (status in ('scheduled', 'completed', 'cancelled')),
  chairperson text,
  attendees jsonb not null default '[]'::jsonb,
  agenda jsonb not null default '[]'::jsonb,
  minutes text,
  created_by text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint air_safety_meetings_completed_held_at_chk
    check (status <> 'completed' or held_at is not null),
  constraint air_safety_meetings_cancelled_held_at_chk
    check (status <> 'cancelled' or held_at is null),
  constraint air_safety_meetings_period_order_chk
    check (
      scheduled_period_start is null
      or scheduled_period_end is null
      or scheduled_period_end >= scheduled_period_start
    )
);

create index if not exists idx_air_safety_meetings_type_status_held
  on air_safety_meetings (meeting_type, status, held_at desc);

create index if not exists idx_air_safety_meetings_due
  on air_safety_meetings (due_at asc);
