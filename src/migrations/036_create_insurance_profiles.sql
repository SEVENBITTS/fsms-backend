create table if not exists insurance_profiles (
  id uuid primary key,
  organisation_id uuid not null,
  insurance_document_id uuid not null references insurance_documents(id) on delete cascade,
  version_number integer not null,
  review_status text not null default 'draft',
  activation_status text not null default 'draft',
  activated_by text null,
  activated_at timestamptz null,
  superseded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_profiles_version_chk
    check (version_number >= 1),
  constraint insurance_profiles_review_status_chk
    check (review_status in ('draft', 'reviewed')),
  constraint insurance_profiles_activation_status_chk
    check (activation_status in ('draft', 'active', 'superseded'))
);

create unique index if not exists idx_insurance_profiles_document_version
  on insurance_profiles (insurance_document_id, version_number);

create index if not exists idx_insurance_profiles_org_created
  on insurance_profiles (organisation_id, created_at desc);
