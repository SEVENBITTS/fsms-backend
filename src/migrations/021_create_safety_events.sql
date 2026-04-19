create table if not exists safety_events (
  id uuid primary key,
  event_type text not null check (
    event_type in (
      'sop_breach',
      'training_need',
      'maintenance_concern',
      'airspace_deviation',
      'mission_planning_issue',
      'platform_readiness_issue',
      'pilot_readiness_issue',
      'operational_incident',
      'near_miss',
      'post_operation_finding'
    )
  ),
  severity text not null check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  status text not null check (
    status in ('open', 'under_review', 'closed')
  ),
  mission_id uuid references missions(id) on delete set null,
  platform_id uuid references platforms(id) on delete set null,
  pilot_id uuid references pilots(id) on delete set null,
  post_operation_evidence_snapshot_id uuid
    references post_operation_evidence_snapshots(id) on delete set null,
  air_safety_meeting_id uuid
    references air_safety_meetings(id) on delete set null,
  reported_by text,
  event_occurred_at timestamptz not null,
  reported_at timestamptz not null default now(),
  summary text not null,
  description text,
  immediate_action_taken text,
  sop_reference text,
  meeting_required boolean not null default false,
  sop_review_required boolean not null default false,
  training_required boolean not null default false,
  maintenance_review_required boolean not null default false,
  accountable_manager_review_required boolean not null default false,
  regulator_reportable_review_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_safety_events_type_status
  on safety_events (event_type, status, event_occurred_at desc);

create index if not exists idx_safety_events_mission
  on safety_events (mission_id, event_occurred_at desc)
  where mission_id is not null;

create index if not exists idx_safety_events_review_flags
  on safety_events (
    meeting_required,
    sop_review_required,
    training_required,
    maintenance_review_required,
    accountable_manager_review_required,
    regulator_reportable_review_required
  );
