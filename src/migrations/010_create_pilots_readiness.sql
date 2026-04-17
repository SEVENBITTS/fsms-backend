create table if not exists pilots (
  id uuid primary key,
  display_name text not null,
  caa_reference text null,
  status text not null default 'active',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilots_status_chk
    check (status in ('active', 'inactive', 'suspended', 'retired'))
);

create unique index if not exists idx_pilots_caa_reference_unique
  on pilots (caa_reference)
  where caa_reference is not null;

create index if not exists idx_pilots_status
  on pilots (status);

create table if not exists pilot_readiness_evidence (
  id uuid primary key,
  pilot_id uuid not null references pilots(id) on delete cascade,
  evidence_type text not null,
  title text not null,
  issued_at timestamptz null,
  expires_at timestamptz null,
  status text not null default 'active',
  evidence_ref text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_readiness_evidence_status_chk
    check (status in ('active', 'inactive', 'revoked'))
);

create index if not exists idx_pilot_readiness_evidence_pilot
  on pilot_readiness_evidence (pilot_id);

alter table missions
add column if not exists pilot_id uuid null references pilots(id) on delete set null;

create index if not exists idx_missions_pilot_id
  on missions (pilot_id);
