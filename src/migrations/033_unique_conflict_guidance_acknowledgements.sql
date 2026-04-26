do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conflict_guidance_ack_guidance_uniq'
  ) then
    alter table conflict_guidance_acknowledgements
      add constraint conflict_guidance_ack_guidance_uniq
      unique (
        mission_id,
        overlay_id,
        guidance_action_code,
        evidence_action
      );
  end if;
end $$;
