create table if not exists operational_authority_conditions (
  id uuid primary key,
  operational_authority_profile_id uuid not null references operational_authority_profiles(id) on delete cascade,
  condition_code text not null,
  condition_title text not null,
  clause_reference text null,
  condition_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_authority_conditions_code_chk
    check (condition_code in ('ALLOWED_OPERATION_TYPE', 'BVLOS_AUTHORISED', 'BVLOS_REQUIRES_REVIEW'))
);

create index if not exists idx_operational_authority_conditions_profile_created
  on operational_authority_conditions (operational_authority_profile_id, created_at desc);
