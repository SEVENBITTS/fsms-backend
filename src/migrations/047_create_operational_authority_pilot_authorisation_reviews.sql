create table if not exists operational_authority_pilot_authorisation_reviews (
  id uuid primary key,
  operational_authority_pilot_authorisation_id uuid not null references operational_authority_pilot_authorisations(id) on delete cascade,
  organisation_id uuid not null,
  decision text not null check (
    decision in ('accepted_for_tracking', 'not_accepted', 'deferred', 'amendment_approved')
  ),
  reviewed_by text not null,
  review_rationale text not null,
  evidence_ref text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists operational_authority_pilot_authorisation_reviews_authorisation_idx
  on operational_authority_pilot_authorisation_reviews (operational_authority_pilot_authorisation_id);

create index if not exists operational_authority_pilot_authorisation_reviews_org_idx
  on operational_authority_pilot_authorisation_reviews (organisation_id);
