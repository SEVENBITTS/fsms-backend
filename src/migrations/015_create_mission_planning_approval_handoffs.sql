create table if not exists mission_planning_approval_handoffs (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  audit_evidence_snapshot_id uuid not null,
  mission_decision_evidence_link_id uuid not null references mission_decision_evidence_links(id) on delete cascade,
  planning_review jsonb not null,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint mission_planning_approval_handoff_snapshot_fk
    foreign key (mission_id, audit_evidence_snapshot_id)
    references audit_evidence_snapshots (mission_id, id),
  constraint mission_planning_approval_handoff_link_uniq
    unique (mission_decision_evidence_link_id)
);

create index if not exists idx_mission_planning_approval_handoffs_mission_created
  on mission_planning_approval_handoffs (mission_id, created_at desc);

