create table if not exists operational_authority_sop_change_recommendation_reviews (
  id uuid primary key,
  operational_authority_sop_change_recommendation_id uuid not null references operational_authority_sop_change_recommendations(id) on delete cascade,
  mission_id uuid not null references missions(id) on delete cascade,
  organisation_id uuid not null,
  decision text not null check (
    decision in ('accepted_for_action', 'rejected', 'deferred', 'closed')
  ),
  reviewed_by text not null,
  review_rationale text not null,
  evidence_ref text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists operational_authority_sop_change_recommendation_reviews_recommendation_idx
  on operational_authority_sop_change_recommendation_reviews (operational_authority_sop_change_recommendation_id);

create index if not exists operational_authority_sop_change_recommendation_reviews_mission_idx
  on operational_authority_sop_change_recommendation_reviews (mission_id);

create index if not exists operational_authority_sop_change_recommendation_reviews_org_idx
  on operational_authority_sop_change_recommendation_reviews (organisation_id);
