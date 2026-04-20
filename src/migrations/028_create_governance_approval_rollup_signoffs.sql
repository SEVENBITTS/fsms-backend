create table if not exists governance_approval_rollup_signoffs (
  id uuid primary key,
  accountable_manager_name text not null,
  accountable_manager_role text not null,
  review_decision text not null check (
    review_decision in ('approved', 'rejected', 'requires_follow_up')
  ),
  signed_at timestamptz not null,
  signature_reference text null,
  review_notes text null,
  created_by text null,
  created_at timestamptz not null default now()
);
