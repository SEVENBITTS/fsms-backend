create table if not exists operational_authority_sop_documents (
  id uuid primary key,
  operational_authority_profile_id uuid not null references operational_authority_profiles(id) on delete cascade,
  organisation_id uuid not null,
  sop_code text not null,
  title text not null,
  version text not null,
  status text not null default 'draft' check (
    status in ('draft', 'active', 'under_review', 'superseded')
  ),
  owner text,
  source_document_id text,
  source_document_type text,
  source_clause_refs jsonb not null default '[]'::jsonb,
  linked_oa_condition_ids jsonb not null default '[]'::jsonb,
  change_recommendation_scope jsonb not null default '[]'::jsonb,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operational_authority_profile_id, sop_code, version)
);

create index if not exists operational_authority_sop_documents_profile_idx
  on operational_authority_sop_documents (operational_authority_profile_id);

create index if not exists operational_authority_sop_documents_org_idx
  on operational_authority_sop_documents (organisation_id);

create index if not exists operational_authority_sop_documents_status_idx
  on operational_authority_sop_documents (status);
