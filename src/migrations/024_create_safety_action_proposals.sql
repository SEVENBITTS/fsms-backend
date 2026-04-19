create table if not exists safety_action_proposals (
  id uuid primary key,
  safety_event_agenda_link_id uuid not null
    references safety_event_agenda_links(id) on delete cascade,
  safety_event_id uuid not null
    references safety_events(id) on delete cascade,
  safety_event_meeting_trigger_id uuid not null
    references safety_event_meeting_triggers(id) on delete cascade,
  air_safety_meeting_id uuid not null
    references air_safety_meetings(id) on delete cascade,
  proposal_type text not null check (
    proposal_type in (
      'sop_change',
      'training_action',
      'maintenance_action',
      'accountable_manager_review',
      'general_safety_action'
    )
  ),
  status text not null check (
    status in ('proposed', 'accepted', 'rejected', 'completed')
  ),
  summary text not null,
  rationale text,
  proposed_owner text,
  proposed_due_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_safety_action_proposals_agenda_link
  on safety_action_proposals (safety_event_agenda_link_id, created_at desc);

create index if not exists idx_safety_action_proposals_event
  on safety_action_proposals (safety_event_id, created_at desc);

create index if not exists idx_safety_action_proposals_status
  on safety_action_proposals (status, proposal_type, proposed_due_at asc);
