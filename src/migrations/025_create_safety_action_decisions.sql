create table if not exists safety_action_decisions (
  id uuid primary key,
  safety_action_proposal_id uuid not null
    references safety_action_proposals(id) on delete cascade,
  safety_event_agenda_link_id uuid not null
    references safety_event_agenda_links(id) on delete cascade,
  safety_event_id uuid not null
    references safety_events(id) on delete cascade,
  safety_event_meeting_trigger_id uuid not null
    references safety_event_meeting_triggers(id) on delete cascade,
  air_safety_meeting_id uuid not null
    references air_safety_meetings(id) on delete cascade,
  decision text not null check (
    decision in ('accepted', 'rejected', 'completed')
  ),
  decided_by text,
  decision_notes text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_safety_action_decisions_proposal
  on safety_action_decisions (safety_action_proposal_id, decided_at desc);

create index if not exists idx_safety_action_decisions_event
  on safety_action_decisions (safety_event_id, decided_at desc);
