create table if not exists safety_event_agenda_links (
  id uuid primary key,
  safety_event_id uuid not null
    references safety_events(id) on delete cascade,
  safety_event_meeting_trigger_id uuid not null
    references safety_event_meeting_triggers(id) on delete cascade,
  air_safety_meeting_id uuid not null
    references air_safety_meetings(id) on delete cascade,
  agenda_item text not null,
  linked_by text,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint safety_event_agenda_links_unique
    unique (safety_event_meeting_trigger_id, air_safety_meeting_id)
);

create index if not exists idx_safety_event_agenda_links_event
  on safety_event_agenda_links (safety_event_id, linked_at desc);

create index if not exists idx_safety_event_agenda_links_meeting
  on safety_event_agenda_links (air_safety_meeting_id, linked_at desc);
