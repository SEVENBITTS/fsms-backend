create table if not exists operational_authority_sop_change_recommendations (
  id uuid primary key,
  mission_id uuid not null references missions(id) on delete cascade,
  organisation_id uuid not null,
  operational_authority_profile_id uuid not null references operational_authority_profiles(id) on delete cascade,
  operational_authority_sop_document_id uuid not null references operational_authority_sop_documents(id) on delete cascade,
  parent_oa_condition_id uuid references operational_authority_conditions(id) on delete set null,
  sop_code text not null,
  sop_clause_ref text,
  recommendation_type text not null check (
    recommendation_type in (
      'sop_review_recommended',
      'sop_amendment_recommended',
      'new_sop_required',
      'oa_variation_review_recommended'
    )
  ),
  status text not null default 'draft' check (
    status in ('draft', 'under_review', 'accepted_for_action', 'rejected', 'closed')
  ),
  evidence_source_type text not null,
  evidence_source_id text not null,
  finding_summary text not null,
  recommendation text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_authority_sop_change_recommendations_mission_idx
  on operational_authority_sop_change_recommendations (mission_id);

create index if not exists operational_authority_sop_change_recommendations_sop_idx
  on operational_authority_sop_change_recommendations (operational_authority_sop_document_id);

create index if not exists operational_authority_sop_change_recommendations_status_idx
  on operational_authority_sop_change_recommendations (status);
