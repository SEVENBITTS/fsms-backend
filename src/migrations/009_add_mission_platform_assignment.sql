alter table missions
add column if not exists platform_id uuid null references platforms(id) on delete set null;

create index if not exists idx_missions_platform_id
  on missions (platform_id);
