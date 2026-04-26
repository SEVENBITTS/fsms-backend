do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_evidence_snapshots_mission_id_id_uniq'
  ) then
    alter table audit_evidence_snapshots
      add constraint audit_evidence_snapshots_mission_id_id_uniq
      unique (mission_id, id);
  end if;
end $$;

create table if not exists mission_decision_evidence_links (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  audit_evidence_snapshot_id uuid not null,
  decision_type text not null,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint mission_decision_type_chk
    check (decision_type in ('approval', 'dispatch')),
  constraint mission_decision_snapshot_fk
    foreign key (mission_id, audit_evidence_snapshot_id)
    references audit_evidence_snapshots (mission_id, id)
    on delete restrict
);

create index if not exists idx_mission_decision_evidence_links_mission_created
  on mission_decision_evidence_links (mission_id, created_at desc);

create index if not exists idx_mission_decision_evidence_links_snapshot
  on mission_decision_evidence_links (audit_evidence_snapshot_id);
