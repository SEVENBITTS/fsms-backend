create table if not exists post_operation_evidence_snapshots (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  evidence_type text not null default 'post_operation_completion',
  lifecycle_state text not null,
  completion_snapshot jsonb not null,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint post_operation_evidence_type_chk
    check (evidence_type in ('post_operation_completion'))
);

create index if not exists idx_post_operation_evidence_snapshots_mission_created
  on post_operation_evidence_snapshots (mission_id, created_at desc);
