create table if not exists organisation_memberships (
  id text primary key,
  organisation_id text not null,
  user_id text not null references users(id),
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

create index if not exists organisation_memberships_org_idx
  on organisation_memberships (organisation_id, role, status);
