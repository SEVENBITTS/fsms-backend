create table if not exists safety_action_implementation_evidence (
  id uuid primary key,
  safety_action_proposal_id uuid not null references safety_action_proposals(id) on delete cascade,
  safety_event_agenda_link_id uuid not null references safety_event_agenda_links(id) on delete cascade,
  safety_event_id uuid not null references safety_events(id) on delete cascade,
  safety_event_meeting_trigger_id uuid not null references safety_event_meeting_triggers(id) on delete cascade,
  air_safety_meeting_id uuid not null references air_safety_meetings(id) on delete cascade,
  evidence_category text not null check (
    evidence_category in (
      'sop_implementation',
      'training_completion',
      'maintenance_completion',
      'accountable_manager_review',
      'general_safety_action_closure'
    )
  ),
  implementation_summary text not null,
  evidence_reference text,
  completed_by text,
  completed_at timestamptz not null,
  reviewed_by text,
  review_notes text,
  created_at timestamptz not null default now()
);

create index if not exists safety_action_implementation_evidence_proposal_idx
  on safety_action_implementation_evidence (safety_action_proposal_id, completed_at desc, created_at desc);

create index if not exists safety_action_implementation_evidence_event_idx
  on safety_action_implementation_evidence (safety_event_id, completed_at desc, created_at desc);

create index if not exists safety_action_implementation_evidence_category_idx
  on safety_action_implementation_evidence (evidence_category, completed_at desc);
