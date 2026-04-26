create table if not exists insurance_conditions (
  id uuid primary key,
  insurance_profile_id uuid not null references insurance_profiles(id) on delete cascade,
  condition_code text not null,
  condition_title text not null,
  clause_reference text null,
  condition_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_conditions_code_chk
    check (condition_code in ('ALLOWED_OPERATION_TYPE', 'BVLOS_COVERED', 'BVLOS_REQUIRES_REVIEW'))
);

create index if not exists idx_insurance_conditions_profile_created
  on insurance_conditions (insurance_profile_id, created_at desc);
