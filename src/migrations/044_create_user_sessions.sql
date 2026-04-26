create table if not exists user_sessions (
  id text primary key,
  user_id text not null references users(id),
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists user_sessions_user_idx
  on user_sessions (user_id, created_at desc);
