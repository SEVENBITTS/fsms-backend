create table if not exists stored_files (
  id text primary key,
  organisation_id text not null,
  original_file_name text not null,
  content_type text null,
  source_document_type text null,
  file_size_bytes integer not null,
  file_checksum text not null,
  storage_path text not null,
  uploaded_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stored_files_organisation_idx
  on stored_files (organisation_id, created_at desc);
