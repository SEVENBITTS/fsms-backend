create table if not exists audit_evidence_snapshots (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  evidence_type text not null,
  readiness_result text not null,
  gate_result text not null,
  blocks_approval boolean not null,
  blocks_dispatch boolean not null,
  requires_review boolean not null,
  readiness_snapshot jsonb not null,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint audit_evidence_type_chk
    check (evidence_type in ('mission_readiness_gate')),
  constraint audit_readiness_result_chk
    check (readiness_result in ('pass', 'warning', 'fail')),
  constraint audit_gate_result_chk
    check (gate_result in ('pass', 'warning', 'fail'))
);

create index if not exists idx_audit_evidence_snapshots_mission_created
  on audit_evidence_snapshots (mission_id, created_at desc);
