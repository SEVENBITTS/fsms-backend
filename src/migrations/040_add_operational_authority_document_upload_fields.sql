alter table operational_authority_documents
  add column if not exists uploaded_file_id text null,
  add column if not exists source_document_type text null,
  add column if not exists uploaded_file_name text null,
  add column if not exists uploaded_file_checksum text null,
  add column if not exists source_clause_refs jsonb not null default '[]'::jsonb,
  add column if not exists document_review_notes text null;
