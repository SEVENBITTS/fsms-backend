import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  InsuranceCondition,
  InsuranceDocument,
  InsuranceProfile,
} from "./insurance.types";

interface MissionGovernanceRow extends QueryResultRow {
  id: string;
  organisation_id: string | null;
  operation_type: string | null;
  requires_bvlos: boolean;
}

interface InsuranceDocumentRow extends QueryResultRow {
  id: string;
  organisation_id: string;
  provider_name: string;
  policy_number: string;
  issue_date: Date;
  effective_from: Date;
  expires_at: Date;
  status: InsuranceDocument["status"];
  uploaded_file_id: string | null;
  source_document_type: string | null;
  uploaded_file_name: string | null;
  uploaded_file_checksum: string | null;
  policy_schedule_refs: string[] | null;
  document_review_notes: string | null;
  uploaded_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface InsuranceProfileRow extends QueryResultRow {
  id: string;
  organisation_id: string;
  insurance_document_id: string;
  version_number: number;
  review_status: InsuranceProfile["reviewStatus"];
  activation_status: InsuranceProfile["activationStatus"];
  activated_by: string | null;
  activated_at: Date | null;
  superseded_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface InsuranceConditionRow extends QueryResultRow {
  id: string;
  insurance_profile_id: string;
  condition_code: InsuranceCondition["conditionCode"];
  condition_title: string;
  clause_reference: string | null;
  condition_payload: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const toDocument = (row: InsuranceDocumentRow): InsuranceDocument => ({
  id: row.id,
  organisationId: row.organisation_id,
  providerName: row.provider_name,
  policyNumber: row.policy_number,
  issueDate: row.issue_date.toISOString(),
  effectiveFrom: row.effective_from.toISOString(),
  expiresAt: row.expires_at.toISOString(),
  status: row.status,
  uploadedFileId: row.uploaded_file_id,
  sourceDocumentType: row.source_document_type,
  uploadedFileName: row.uploaded_file_name,
  uploadedFileChecksum: row.uploaded_file_checksum,
  policyScheduleRefs: row.policy_schedule_refs ?? [],
  documentReviewNotes: row.document_review_notes,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toProfile = (row: InsuranceProfileRow): InsuranceProfile => ({
  id: row.id,
  organisationId: row.organisation_id,
  insuranceDocumentId: row.insurance_document_id,
  versionNumber: Number(row.version_number),
  reviewStatus: row.review_status,
  activationStatus: row.activation_status,
  activatedBy: row.activated_by,
  activatedAt: row.activated_at ? row.activated_at.toISOString() : null,
  supersededAt: row.superseded_at ? row.superseded_at.toISOString() : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toCondition = (row: InsuranceConditionRow): InsuranceCondition => ({
  id: row.id,
  insuranceProfileId: row.insurance_profile_id,
  conditionCode: row.condition_code,
  conditionTitle: row.condition_title,
  clauseReference: row.clause_reference,
  conditionPayload: row.condition_payload,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class InsuranceRepository {
  async insertDocument(
    tx: PoolClient,
    params: {
      organisationId: string;
      providerName: string;
      policyNumber: string;
      issueDate: string;
      effectiveFrom: string;
      expiresAt: string;
      uploadedBy: string | null;
    },
  ): Promise<InsuranceDocument> {
    const result = await tx.query<InsuranceDocumentRow>(
      `
      insert into insurance_documents (
        id,
        organisation_id,
        provider_name,
        policy_number,
        issue_date,
        effective_from,
        expires_at,
        uploaded_file_id,
        source_document_type,
        uploaded_file_name,
        uploaded_file_checksum,
        policy_schedule_refs,
        document_review_notes,
        uploaded_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, null, null, null, null, '[]'::jsonb, null, $8)
      returning *
      `,
      [
        randomUUID(),
        params.organisationId,
        params.providerName,
        params.policyNumber,
        params.issueDate,
        params.effectiveFrom,
        params.expiresAt,
        params.uploadedBy,
      ],
    );

    return toDocument(result.rows[0]);
  }

  async insertProfile(
    tx: PoolClient,
    params: {
      organisationId: string;
      documentId: string;
      versionNumber: number;
    },
  ): Promise<InsuranceProfile> {
    const result = await tx.query<InsuranceProfileRow>(
      `
      insert into insurance_profiles (
        id,
        organisation_id,
        insurance_document_id,
        version_number
      )
      values ($1, $2, $3, $4)
      returning *
      `,
      [randomUUID(), params.organisationId, params.documentId, params.versionNumber],
    );

    return toProfile(result.rows[0]);
  }

  async insertCondition(
    tx: PoolClient,
    params: {
      profileId: string;
      conditionCode: InsuranceCondition["conditionCode"];
      conditionTitle: string;
      clauseReference: string | null;
      conditionPayload: Record<string, unknown>;
    },
  ): Promise<InsuranceCondition> {
    const result = await tx.query<InsuranceConditionRow>(
      `
      insert into insurance_conditions (
        id,
        insurance_profile_id,
        condition_code,
        condition_title,
        clause_reference,
        condition_payload
      )
      values ($1, $2, $3, $4, $5, $6::jsonb)
      returning *
      `,
      [
        randomUUID(),
        params.profileId,
        params.conditionCode,
        params.conditionTitle,
        params.clauseReference,
        JSON.stringify(params.conditionPayload),
      ],
    );

    return toCondition(result.rows[0]);
  }

  async getProfileById(
    tx: PoolClient,
    profileId: string,
  ): Promise<InsuranceProfile | null> {
    const result = await tx.query<InsuranceProfileRow>(
      `
      select *
      from insurance_profiles
      where id = $1
      `,
      [profileId],
    );

    return result.rows[0] ? toProfile(result.rows[0]) : null;
  }

  async getDocumentById(
    tx: PoolClient,
    documentId: string,
  ): Promise<InsuranceDocument | null> {
    const result = await tx.query<InsuranceDocumentRow>(
      `
      select *
      from insurance_documents
      where id = $1
      `,
      [documentId],
    );

    return result.rows[0] ? toDocument(result.rows[0]) : null;
  }

  async updateDocumentUpload(
    tx: PoolClient,
    documentId: string,
    params: {
      uploadedFileId: string;
      sourceDocumentType: string;
      uploadedFileName: string | null;
      uploadedFileChecksum: string | null;
      policyScheduleRefs: string[];
      documentReviewNotes: string | null;
      uploadedBy: string | null;
    },
  ): Promise<InsuranceDocument> {
    const result = await tx.query<InsuranceDocumentRow>(
      `
      update insurance_documents
      set
        uploaded_file_id = $2,
        source_document_type = $3,
        uploaded_file_name = $4,
        uploaded_file_checksum = $5,
        policy_schedule_refs = $6::jsonb,
        document_review_notes = $7,
        uploaded_by = coalesce($8, uploaded_by),
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
        JSON.stringify(params.policyScheduleRefs),
        params.documentReviewNotes,
        params.uploadedBy,
      ],
    );

    return toDocument(result.rows[0]);
  }

  async supersedeActiveProfiles(
    tx: PoolClient,
    organisationId: string,
  ): Promise<void> {
    await tx.query(
      `
      update insurance_profiles
      set
        activation_status = 'superseded',
        superseded_at = now(),
        updated_at = now()
      where organisation_id = $1
        and activation_status = 'active'
      `,
      [organisationId],
    );

    await tx.query(
      `
      update insurance_documents
      set
        status = 'superseded',
        updated_at = now()
      where organisation_id = $1
        and status = 'active'
      `,
      [organisationId],
    );
  }

  async activateProfile(
    tx: PoolClient,
    profileId: string,
    activatedBy: string,
  ): Promise<InsuranceProfile> {
    const result = await tx.query<InsuranceProfileRow>(
      `
      update insurance_profiles
      set
        review_status = 'reviewed',
        activation_status = 'active',
        activated_by = $2,
        activated_at = now(),
        updated_at = now()
      where id = $1
      returning *
      `,
      [profileId, activatedBy],
    );

    return toProfile(result.rows[0]);
  }

  async activateDocumentForProfile(
    tx: PoolClient,
    profileId: string,
  ): Promise<void> {
    await tx.query(
      `
      update insurance_documents
      set
        status = 'active',
        updated_at = now()
      where id = (
        select insurance_document_id
        from insurance_profiles
        where id = $1
      )
      `,
      [profileId],
    );
  }

  async getLatestActiveProfileForOrganisation(
    tx: PoolClient,
    organisationId: string,
  ): Promise<InsuranceProfile | null> {
    const result = await tx.query<InsuranceProfileRow>(
      `
      select *
      from insurance_profiles
      where organisation_id = $1
        and activation_status = 'active'
      order by activated_at desc nulls last, created_at desc, id desc
      limit 1
      `,
      [organisationId],
    );

    return result.rows[0] ? toProfile(result.rows[0]) : null;
  }

  async listDocumentsByOrganisation(
    tx: PoolClient,
    organisationId: string,
  ): Promise<InsuranceDocument[]> {
    const result = await tx.query<InsuranceDocumentRow>(
      `
      select *
      from insurance_documents
      where organisation_id = $1
      order by updated_at desc, created_at desc, id desc
      `,
      [organisationId],
    );

    return result.rows.map((row) => toDocument(row));
  }

  async getConditionsForProfile(
    tx: PoolClient,
    profileId: string,
  ): Promise<InsuranceCondition[]> {
    const result = await tx.query<InsuranceConditionRow>(
      `
      select *
      from insurance_conditions
      where insurance_profile_id = $1
      order by created_at asc, id asc
      `,
      [profileId],
    );

    return result.rows.map((row) => toCondition(row));
  }

  async getMissionGovernanceContext(
    tx: PoolClient,
    missionId: string,
  ): Promise<{
    missionId: string;
    organisationId: string | null;
    operationType: string | null;
    requiresBvlos: boolean;
  } | null> {
    const result = await tx.query<MissionGovernanceRow>(
      `
      select
        id,
        organisation_id,
        operation_type,
        requires_bvlos
      from missions
      where id = $1
      `,
      [missionId],
    );

    if (!result.rows[0]) {
      return null;
    }

    return {
      missionId: result.rows[0].id,
      organisationId: result.rows[0].organisation_id,
      operationType: result.rows[0].operation_type,
      requiresBvlos: result.rows[0].requires_bvlos,
    };
  }
}
