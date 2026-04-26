import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { StoredFile } from "./stored-files.types";

interface StoredFileRow extends QueryResultRow {
  id: string;
  organisation_id: string;
  original_file_name: string;
  content_type: string | null;
  source_document_type: string | null;
  file_size_bytes: number;
  file_checksum: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const toStoredFile = (row: StoredFileRow): StoredFile => ({
  id: row.id,
  organisationId: row.organisation_id,
  originalFileName: row.original_file_name,
  contentType: row.content_type,
  sourceDocumentType: row.source_document_type,
  fileSizeBytes: Number(row.file_size_bytes),
  fileChecksum: row.file_checksum,
  storagePath: row.storage_path,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class StoredFilesRepository {
  async insertStoredFile(
    tx: PoolClient,
    params: {
      organisationId: string;
      originalFileName: string;
      contentType: string | null;
      sourceDocumentType: string | null;
      fileSizeBytes: number;
      fileChecksum: string;
      storagePath: string;
      uploadedBy: string | null;
    },
  ): Promise<StoredFile> {
    const result = await tx.query<StoredFileRow>(
      `
      insert into stored_files (
        id,
        organisation_id,
        original_file_name,
        content_type,
        source_document_type,
        file_size_bytes,
        file_checksum,
        storage_path,
        uploaded_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        randomUUID(),
        params.organisationId,
        params.originalFileName,
        params.contentType,
        params.sourceDocumentType,
        params.fileSizeBytes,
        params.fileChecksum,
        params.storagePath,
        params.uploadedBy,
      ],
    );

    return toStoredFile(result.rows[0]);
  }

  async getStoredFileById(
    tx: PoolClient,
    fileId: string,
  ): Promise<StoredFile | null> {
    const result = await tx.query<StoredFileRow>(
      `
      select *
      from stored_files
      where id = $1
      `,
      [fileId],
    );

    return result.rows[0] ? toStoredFile(result.rows[0]) : null;
  }
}
