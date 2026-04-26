create table if not exists air_safety_meeting_signoffs (
  id uuid primary key,
  air_safety_meeting_id uuid not null
    references air_safety_meetings(id)
    on delete cascade,
  accountable_manager_name text not null,
  accountable_manager_role text not null,
  review_decision text not null,
  signed_at timestamptz not null,
  signature_reference text null,
  review_notes text null,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint air_safety_meeting_signoff_decision_chk
    check (review_decision in ('approved', 'rejected', 'requires_follow_up'))
);

create index if not exists idx_air_safety_meeting_signoffs_meeting_created
  on air_safety_meeting_signoffs (air_safety_meeting_id, created_at desc);
