alter table missions
  add column if not exists organisation_id uuid null;

alter table missions
  add column if not exists operation_type text null default 'vlos_commercial';

alter table missions
  add column if not exists requires_bvlos boolean not null default false;

create index if not exists idx_missions_organisation_id
  on missions (organisation_id);
