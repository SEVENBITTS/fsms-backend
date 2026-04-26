update conflict_guidance_acknowledgements
set guidance_summary = 'Summary not captured before guidance-summary enforcement'
where guidance_summary is null
   or btrim(guidance_summary) = '';

alter table conflict_guidance_acknowledgements
  alter column guidance_summary set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conflict_guidance_ack_summary_nonempty_chk'
  ) then
    alter table conflict_guidance_acknowledgements
      add constraint conflict_guidance_ack_summary_nonempty_chk
      check (btrim(guidance_summary) <> '');
  end if;
end $$;
