create index if not exists idx_operational_authority_profiles_org_active
  on operational_authority_profiles (organisation_id, activation_status, created_at desc);

create index if not exists idx_insurance_profiles_org_active
  on insurance_profiles (organisation_id, activation_status, created_at desc);
