create table if not exists live_ops_map_view_state_snapshots (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  evidence_type text not null default 'live_ops_map_view_state',
  replay_cursor text not null,
  replay_timestamp timestamptz null,
  area_freshness_filter text not null,
  visible_area_overlay_count integer not null,
  total_area_overlay_count integer not null,
  degraded_area_overlay_count integer not null,
  open_alert_count integer not null,
  active_conflict_count integer not null,
  area_refresh_run_count integer not null,
  view_state_url text null,
  snapshot_metadata jsonb not null,
  capture_scope text not null default 'metadata_only',
  pilot_instruction_status text not null default 'not_a_pilot_command',
  created_by text null,
  created_at timestamptz not null default now(),
  constraint live_ops_map_view_state_evidence_type_chk
    check (evidence_type = 'live_ops_map_view_state'),
  constraint live_ops_map_view_state_area_filter_chk
    check (area_freshness_filter in ('all', 'degraded', 'hidden')),
  constraint live_ops_map_view_state_counts_chk
    check (
      visible_area_overlay_count >= 0
      and total_area_overlay_count >= 0
      and degraded_area_overlay_count >= 0
      and open_alert_count >= 0
      and active_conflict_count >= 0
      and area_refresh_run_count >= 0
      and visible_area_overlay_count <= total_area_overlay_count
      and degraded_area_overlay_count <= total_area_overlay_count
    ),
  constraint live_ops_map_view_state_capture_scope_chk
    check (capture_scope = 'metadata_only'),
  constraint live_ops_map_view_state_pilot_instruction_chk
    check (pilot_instruction_status = 'not_a_pilot_command')
);

create index if not exists idx_live_ops_map_view_state_mission_created
  on live_ops_map_view_state_snapshots (mission_id, created_at desc);
