alter table mission_external_overlays
  drop constraint if exists mission_external_overlays_kind_chk;

alter table mission_external_overlays
  add constraint mission_external_overlays_kind_chk
    check (overlay_kind in ('weather', 'crewed_traffic', 'drone_traffic', 'area_conflict'));
