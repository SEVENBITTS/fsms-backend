import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { OrganisationDocument } from "./organisation-documents.types";

interface OrganisationDocumentRow extends QueryResultRow {
  id: string;
  organisation_id: string;
  category: OrganisationDocument["category"];
  title: string;
  status: OrganisationDocument["status"];
  issuing_body: string | null;
  reference_number: string | null;
  issue_date: Date | null;
  effective_from: Date | null;
  expires_at: Date | null;
  uploaded_file_id: string | null;
  source_document_type: string | null;
  uploaded_file_name: string | null;
  uploaded_file_checksum: string | null;
  tags: string[] | null;
  review_notes: string | null;
  uploaded_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const toDocument = (row: OrganisationDocumentRow): OrganisationDocument => ({
  id: row.id,
  organisationId: row.organisation_id,
  category: row.category,
  title: row.title,
  status: row.status,
  issuingBody: row.issuing_body,
  referenceNumber: row.reference_number,
  issueDate: row.issue_date ? row.issue_date.toISOString() : null,
  effectiveFrom: row.effective_from ? row.effective_from.toISOString() : null,
  expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
  uploadedFileId: row.uploaded_file_id,
  sourceDocumentType: row.source_document_type,
  uploadedFileName: row.uploaded_file_name,
  uploadedFileChecksum: row.uploaded_file_checksum,
  tags: row.tags ?? [],
  reviewNotes: row.review_notes,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class OrganisationDocumentsRepository {
  async insertDocument(
    tx: PoolClient,
    params: {
      organisationId: string;
      category: OrganisationDocument["category"];
      title: string;
      issuingBody: string | null;
      referenceNumber: string | null;
      issueDate: string | null;
      effectiveFrom: string | null;
      expiresAt: string | null;
      tags: string[];
      uploadedBy: string | null;
    },
  ): Promise<OrganisationDocument> {
    const result = await tx.query<OrganisationDocumentRow>(
      `
      insert into organisation_documents (
        id,
        organisation_id,
        category,
        title,
        status,
        issuing_body,
        reference_number,
        issue_date,
        effective_from,
        expires_at,
        uploaded_file_id,
        source_document_type,
        uploaded_file_name,
        uploaded_file_checksum,
        tags,
        review_notes,
        uploaded_by
      )
      values (
        $1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, null, null, null, null, $10::jsonb, null, $11
      )
      returning *
      `,
      [
        randomUUID(),
        params.organisationId,
        params.category,
        params.title,
        params.issuingBody,
        params.referenceNumber,
        params.issueDate,
        params.effectiveFrom,
        params.expiresAt,
        JSON.stringify(params.tags),
        params.uploadedBy,
      ],
    );

    return toDocument(result.rows[0]);
  }

  async getDocumentById(
    tx: PoolClient,
    documentId: string,
  ): Promise<OrganisationDocument | null> {
    const result = await tx.query<OrganisationDocumentRow>(
      `
      select *
      from organisation_documents
      where id = $1
      `,
      [documentId],
    );

    return result.rows[0] ? toDocument(result.rows[0]) : null;
  }

  async listDocumentsByOrganisation(
    tx: PoolClient,
    organisationId: string,
  ): Promise<OrganisationDocument[]> {
    const result = await tx.query<OrganisationDocumentRow>(
      `
      select *
      from organisation_documents
      where organisation_id = $1
      order by updated_at desc, created_at desc, id desc
      `,
      [organisationId],
    );

    return result.rows.map((row) => toDocument(row));
  }

  async updateDocumentUpload(
    tx: PoolClient,
    documentId: string,
    params: {
      uploadedFileId: string;
      sourceDocumentType: string;
      uploadedFileName: string | null;
      uploadedFileChecksum: string | null;
      reviewNotes: string | null;
      uploadedBy: string | null;
    },
  ): Promise<OrganisationDocument> {
    const result = await tx.query<OrganisationDocumentRow>(
      `
      update organisation_documents
      set
        uploaded_file_id = $2,
        source_document_type = $3,
        uploaded_file_name = $4,
        uploaded_file_checksum = $5,
        review_notes = $6,
        uploaded_by = coalesce($7, uploaded_by),
        status = case when status = 'draft' then 'active' else status end,
        updated_at = now()
      where id = $1
      returning *
      `,
      [
        documentId,
        params.uploadedFileId,
        params.sourceDocumentType,
        params.uploadedFileName,
        params.uploadedFileChecksum,
        params.reviewNotes,
        params.uploadedBy,
      ],
    );

    return toDocument(result.rows[0]);
  }
}
