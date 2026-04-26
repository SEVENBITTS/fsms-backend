create table if not exists operational_authority_documents (
  id uuid primary key,
  organisation_id uuid not null,
  authority_name text not null,
  reference_number text not null,
  issue_date timestamptz not null,
  effective_from timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'draft',
  uploaded_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_authority_documents_status_chk
    check (status in ('draft', 'active', 'expired', 'superseded', 'revoked'))
);

create index if not exists idx_operational_authority_documents_org_created
  on operational_authority_documents (organisation_id, created_at desc);
