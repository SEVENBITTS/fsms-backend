create table if not exists operational_authority_pilot_authorisations (
  id uuid primary key,
  operational_authority_profile_id uuid not null references operational_authority_profiles(id) on delete cascade,
  organisation_id uuid not null,
  pilot_id uuid not null references pilots(id) on delete cascade,
  authorisation_state text not null check (
    authorisation_state in ('authorised', 'pending_amendment', 'restricted', 'inactive')
  ),
  allowed_operation_types jsonb not null default '[]'::jsonb,
  bvlos_authorised boolean not null default false,
  requires_accountable_review boolean not null default false,
  pending_amendment_reference text,
  pending_submitted_at timestamptz,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operational_authority_profile_id, pilot_id)
);

create index if not exists operational_authority_pilot_authorisations_profile_idx
  on operational_authority_pilot_authorisations (operational_authority_profile_id);

create index if not exists operational_authority_pilot_authorisations_org_idx
  on operational_authority_pilot_authorisations (organisation_id);

create index if not exists operational_authority_pilot_authorisations_pilot_idx
  on operational_authority_pilot_authorisations (pilot_id);
