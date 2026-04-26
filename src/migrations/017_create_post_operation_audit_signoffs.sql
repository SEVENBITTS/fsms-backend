do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'post_operation_evidence_snapshots_mission_id_id_uniq'
  ) then
    alter table post_operation_evidence_snapshots
      add constraint post_operation_evidence_snapshots_mission_id_id_uniq
      unique (mission_id, id);
  end if;
end $$;

create table if not exists post_operation_audit_signoffs (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  post_operation_evidence_snapshot_id uuid not null,
  accountable_manager_name text not null,
  accountable_manager_role text not null,
  review_decision text not null,
  signed_at timestamptz not null,
  signature_reference text null,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint post_operation_audit_signoff_decision_chk
    check (review_decision in ('approved', 'rejected', 'requires_follow_up')),
  constraint post_operation_audit_signoff_snapshot_fk
    foreign key (mission_id, post_operation_evidence_snapshot_id)
    references post_operation_evidence_snapshots (mission_id, id)
    on delete restrict,
  constraint post_operation_audit_signoff_snapshot_uniq
    unique (post_operation_evidence_snapshot_id)
);

create index if not exists idx_post_operation_audit_signoffs_mission_created
  on post_operation_audit_signoffs (mission_id, created_at desc);
