create table if not exists safety_event_meeting_triggers (
  id uuid primary key,
  safety_event_id uuid not null
    references safety_events(id) on delete cascade,
  meeting_required boolean not null,
  recommended_meeting_type text check (
    recommended_meeting_type is null or recommended_meeting_type in (
      'event_triggered_safety_review',
      'sop_breach_review',
      'training_review',
      'maintenance_safety_review',
      'accountable_manager_review'
    )
  ),
  trigger_reasons jsonb not null default '[]'::jsonb,
  review_flags jsonb not null default '{}'::jsonb,
  assessed_by text,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_safety_event_meeting_triggers_event
  on safety_event_meeting_triggers (safety_event_id, assessed_at desc);

create index if not exists idx_safety_event_meeting_triggers_required
  on safety_event_meeting_triggers (
    meeting_required,
    recommended_meeting_type,
    assessed_at desc
  );
