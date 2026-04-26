create table if not exists organisation_documents (
  id text primary key,
  organisation_id text not null,
  category text not null,
  title text not null,
  status text not null default 'draft',
  issuing_body text null,
  reference_number text null,
  issue_date timestamptz null,
  effective_from timestamptz null,
  expires_at timestamptz null,
  uploaded_file_id text null,
  source_document_type text null,
  uploaded_file_name text null,
  uploaded_file_checksum text null,
  tags jsonb not null default '[]'::jsonb,
  review_notes text null,
  uploaded_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organisation_documents_organisation_idx
  on organisation_documents (organisation_id, updated_at desc);

create index if not exists organisation_documents_category_idx
  on organisation_documents (organisation_id, category, updated_at desc);

create index if not exists organisation_documents_expiry_idx
  on organisation_documents (organisation_id, expires_at);
