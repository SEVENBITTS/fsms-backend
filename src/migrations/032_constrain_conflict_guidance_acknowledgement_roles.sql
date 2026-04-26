do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conflict_guidance_ack_evidence_role_chk'
  ) then
    alter table conflict_guidance_acknowledgements
      add constraint conflict_guidance_ack_evidence_role_chk
      check (
        (evidence_action = 'record_operator_review' and acknowledgement_role = 'operator')
        or
        (evidence_action = 'record_supervisor_review' and acknowledgement_role = 'supervisor')
      );
  end if;
end $$;
