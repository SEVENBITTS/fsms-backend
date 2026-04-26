create table if not exists insurance_documents (
  id uuid primary key,
  organisation_id uuid not null,
  provider_name text not null,
  policy_number text not null,
  issue_date timestamptz not null,
  effective_from timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'draft',
  uploaded_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_documents_status_chk
    check (status in ('draft', 'active', 'expired', 'superseded', 'cancelled'))
);

create index if not exists idx_insurance_documents_org_created
  on insurance_documents (organisation_id, created_at desc);
