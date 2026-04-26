do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mission_external_overlays_mission_id_id_uniq'
  ) then
    alter table mission_external_overlays
      add constraint mission_external_overlays_mission_id_id_uniq
      unique (mission_id, id);
  end if;
end $$;

create table if not exists conflict_guidance_acknowledgements (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  conflict_id text not null,
  overlay_id uuid not null,
  guidance_action_code text not null,
  evidence_action text not null,
  acknowledgement_role text not null,
  acknowledged_by text not null,
  acknowledgement_note text null,
  guidance_summary text null,
  pilot_instruction_status text not null default 'not_a_pilot_command',
  created_at timestamptz not null default now(),
  constraint conflict_guidance_ack_action_chk
    check (
      guidance_action_code in (
        'review_separation',
        'prepare_deconfliction',
        'hold_or_suspend'
      )
    ),
  constraint conflict_guidance_ack_evidence_action_chk
    check (
      evidence_action in (
        'record_operator_review',
        'record_supervisor_review'
      )
    ),
  constraint conflict_guidance_ack_role_chk
    check (acknowledgement_role in ('operator', 'supervisor')),
  constraint conflict_guidance_ack_pilot_status_chk
    check (pilot_instruction_status = 'not_a_pilot_command'),
  constraint conflict_guidance_ack_overlay_fk
    foreign key (mission_id, overlay_id)
    references mission_external_overlays (mission_id, id)
    on delete restrict
);

create index if not exists idx_conflict_guidance_ack_mission_created
  on conflict_guidance_acknowledgements (mission_id, created_at desc);

create index if not exists idx_conflict_guidance_ack_overlay
  on conflict_guidance_acknowledgements (overlay_id, created_at desc);
