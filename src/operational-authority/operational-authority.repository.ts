import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  OperationalAuthorityCondition,
  OperationalAuthorityDocument,
  OperationalAuthorityPilotAuthorisation,
  OperationalAuthorityPilotAuthorisationReview,
  OperationalAuthorityProfile,
} from "./operational-authority.types";

interface MissionGovernanceRow extends QueryResultRow {
  id: string;
  organisation_id: string | null;
  pilot_id: string | null;
  operation_type: string | null;
  requires_bvlos: boolean;
}

interface OperationalAuthorityDocumentRow extends QueryResultRow {
  id: string;
  organisation_id: string;
  authority_name: string;
  reference_number: string;
  issue_date: Date;
  effective_from: Date;
  expires_at: Date;
  status: OperationalAuthorityDocument["status"];
  uploaded_file_id: string | null;
  source_document_type: string | null;
  uploaded_file_name: string | null;
  uploaded_file_checksum: string | null;
  source_clause_refs: string[] | null;
  document_review_notes: string | null;
  uploaded_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface OperationalAuthorityProfileRow extends QueryResultRow {
  id: string;
  organisation_id: string;
  operational_authority_document_id: string;
  version_number: number;
  review_status: OperationalAuthorityProfile["reviewStatus"];
  activation_status: OperationalAuthorityProfile["activationStatus"];
  activated_by: string | null;
  activated_at: Date | null;
  superseded_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface OperationalAuthorityConditionRow extends QueryResultRow {
  id: string;
  operational_authority_profile_id: string;
  condition_code: OperationalAuthorityCondition["conditionCode"];
  condition_title: string;
  clause_reference: string | null;
  condition_payload: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface OperationalAuthorityPilotAuthorisationRow extends QueryResultRow {
  id: string;
  operational_authority_profile_id: string;
  organisation_id: string;
  pilot_id: string;
  authorisation_state: OperationalAuthorityPilotAuthorisation["authorisationState"];
  allowed_operation_types: string[] | null;
  bvlos_authorised: boolean;
  requires_accountable_review: boolean;
  pending_amendment_reference: string | null;
  pending_submitted_at: Date | null;
  approved_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface OperationalAuthorityPilotAuthorisationReviewRow extends QueryResultRow {
  id: string;
  operational_authority_pilot_authorisation_id: string;
  organisation_id: string;
  decision: OperationalAuthorityPilotAuthorisationReview["decision"];
  reviewed_by: string;
  review_rationale: string;
  evidence_ref: string | null;
  reviewed_at: Date;
  created_at: Date;
}

const toDocument = (
  row: OperationalAuthorityDocumentRow,
): OperationalAuthorityDocument => ({
  id: row.id,
  organisationId: row.organisation_id,
  authorityName: row.authority_name,
  referenceNumber: row.reference_number,
  issueDate: row.issue_date.toISOString(),
  effectiveFrom: row.effective_from.toISOString(),
  expiresAt: row.expires_at.toISOString(),
  status: row.status,
  uploadedFileId: row.uploaded_file_id,
  sourceDocumentType: row.source_document_type,
  uploadedFileName: row.uploaded_file_name,
  uploadedFileChecksum: row.uploaded_file_checksum,
  sourceClauseRefs: row.source_clause_refs ?? [],
  documentReviewNotes: row.document_review_notes,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toProfile = (
  row: OperationalAuthorityProfileRow,
): OperationalAuthorityProfile => ({
  id: row.id,
  organisationId: row.organisation_id,
  operationalAuthorityDocumentId: row.operational_authority_document_id,
  versionNumber: Number(row.version_number),
  reviewStatus: row.review_status,
  activationStatus: row.activation_status,
  activatedBy: row.activated_by,
  activatedAt: row.activated_at ? row.activated_at.toISOString() : null,
  supersededAt: row.superseded_at ? row.superseded_at.toISOString() : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toCondition = (
  row: OperationalAuthorityConditionRow,
): OperationalAuthorityCondition => ({
  id: row.id,
  operationalAuthorityProfileId: row.operational_authority_profile_id,
  conditionCode: row.condition_code,
  conditionTitle: row.condition_title,
  clauseReference: row.clause_reference,
  conditionPayload: row.condition_payload,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toPilotAuthorisation = (
  row: OperationalAuthorityPilotAuthorisationRow,
): OperationalAuthorityPilotAuthorisation => ({
  id: row.id,
  operationalAuthorityProfileId: row.operational_authority_profile_id,
  organisationId: row.organisation_id,
  pilotId: row.pilot_id,
  authorisationState: row.authorisation_state,
  allowedOperationTypes:
    (row.allowed_operation_types ?? []) as OperationalAuthorityPilotAuthorisation["allowedOperationTypes"],
  bvlosAuthorised: row.bvlos_authorised,
  requiresAccountableReview: row.requires_accountable_review,
  pendingAmendmentReference: row.pending_amendment_reference,
  pendingSubmittedAt: row.pending_submitted_at
    ? row.pending_submitted_at.toISOString()
    : null,
  approvedAt: row.approved_at ? row.approved_at.toISOString() : null,
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toPilotAuthorisationReview = (
  row: OperationalAuthorityPilotAuthorisationReviewRow,
): OperationalAuthorityPilotAuthorisationReview => ({
  id: row.id,
  operationalAuthorityPilotAuthorisationId:
    row.operational_authority_pilot_authorisation_id,
  organisationId: row.organisation_id,
  decision: row.decision,
  reviewedBy: row.reviewed_by,
  reviewRationale: row.review_rationale,
  evidenceRef: row.evidence_ref,
  reviewedAt: row.reviewed_at.toISOString(),
  createdAt: row.created_at.toISOString(),
});

export class OperationalAuthorityRepository {
  async insertDocument(
    tx: PoolClient,
    params: {
      organisationId: string;
      authorityName: string;
      referenceNumber: string;
      issueDate: string;
      effectiveFrom: string;
      expiresAt: string;
      uploadedBy: string | null;
    },
  ): Promise<OperationalAuthorityDocument> {
    const result = await tx.query<OperationalAuthorityDocumentRow>(
      `
      insert into operational_authority_documents (
        id,
        organisation_id,
        authority_name,
        reference_number,
        issue_date,
        effective_from,
        expires_at,
        uploaded_file_id,
        source_document_type,
        uploaded_file_name,
        uploaded_file_checksum,
        source_clause_refs,
        document_review_notes,
        uploaded_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, null, null, null, null, '[]'::jsonb, null, $8)
      returning *
      `,
      [
        randomUUID(),
        params.organisationId,
        params.authorityName,
        params.referenceNumber,
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
  ): Promise<OperationalAuthorityProfile> {
    const result = await tx.query<OperationalAuthorityProfileRow>(
      `
      insert into operational_authority_profiles (
        id,
        organisation_id,
        operational_authority_document_id,
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
      conditionCode: OperationalAuthorityCondition["conditionCode"];
      conditionTitle: string;
      clauseReference: string | null;
      conditionPayload: Record<string, unknown>;
    },
  ): Promise<OperationalAuthorityCondition> {
    const result = await tx.query<OperationalAuthorityConditionRow>(
      `
      insert into operational_authority_conditions (
        id,
        operational_authority_profile_id,
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
  ): Promise<OperationalAuthorityProfile | null> {
    const result = await tx.query<OperationalAuthorityProfileRow>(
      `
      select *
      from operational_authority_profiles
      where id = $1
      `,
      [profileId],
    );

    return result.rows[0] ? toProfile(result.rows[0]) : null;
  }

  async getDocumentById(
    tx: PoolClient,
    documentId: string,
  ): Promise<OperationalAuthorityDocument | null> {
    const result = await tx.query<OperationalAuthorityDocumentRow>(
      `
      select *
      from operational_authority_documents
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
      sourceClauseRefs: string[];
      documentReviewNotes: string | null;
      uploadedBy: string | null;
    },
  ): Promise<OperationalAuthorityDocument> {
    const result = await tx.query<OperationalAuthorityDocumentRow>(
      `
      update operational_authority_documents
      set
        uploaded_file_id = $2,
        source_document_type = $3,
        uploaded_file_name = $4,
        uploaded_file_checksum = $5,
        source_clause_refs = $6::jsonb,
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
        JSON.stringify(params.sourceClauseRefs),
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
      update operational_authority_profiles
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
      update operational_authority_documents
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
  ): Promise<OperationalAuthorityProfile> {
    const result = await tx.query<OperationalAuthorityProfileRow>(
      `
      update operational_authority_profiles
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
      update operational_authority_documents
      set
        status = 'active',
        updated_at = now()
      where id = (
        select operational_authority_document_id
        from operational_authority_profiles
        where id = $1
      )
      `,
      [profileId],
    );
  }

  async getLatestActiveProfileForOrganisation(
    tx: PoolClient,
    organisationId: string,
  ): Promise<OperationalAuthorityProfile | null> {
    const result = await tx.query<OperationalAuthorityProfileRow>(
      `
      select *
      from operational_authority_profiles
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
  ): Promise<OperationalAuthorityDocument[]> {
    const result = await tx.query<OperationalAuthorityDocumentRow>(
      `
      select *
      from operational_authority_documents
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
  ): Promise<OperationalAuthorityCondition[]> {
    const result = await tx.query<OperationalAuthorityConditionRow>(
      `
      select *
      from operational_authority_conditions
      where operational_authority_profile_id = $1
      order by created_at asc, id asc
      `,
      [profileId],
    );

    return result.rows.map((row) => toCondition(row));
  }

  async getPilotAuthorisationForProfile(
    tx: PoolClient,
    profileId: string,
    pilotId: string,
  ): Promise<OperationalAuthorityPilotAuthorisation | null> {
    const result = await tx.query<OperationalAuthorityPilotAuthorisationRow>(
      `
      select *
      from operational_authority_pilot_authorisations
      where operational_authority_profile_id = $1
        and pilot_id = $2
      `,
      [profileId, pilotId],
    );

    return result.rows[0] ? toPilotAuthorisation(result.rows[0]) : null;
  }

  async insertPilotAuthorisation(
    tx: PoolClient,
    params: {
      profileId: string;
      organisationId: string;
      pilotId: string;
      authorisationState: OperationalAuthorityPilotAuthorisation["authorisationState"];
      allowedOperationTypes: string[];
      bvlosAuthorised: boolean;
      requiresAccountableReview: boolean;
      pendingAmendmentReference: string | null;
      pendingSubmittedAt: string | null;
      approvedAt: string | null;
      notes: string | null;
    },
  ): Promise<OperationalAuthorityPilotAuthorisation> {
    const result = await tx.query<OperationalAuthorityPilotAuthorisationRow>(
      `
      insert into operational_authority_pilot_authorisations (
        id,
        operational_authority_profile_id,
        organisation_id,
        pilot_id,
        authorisation_state,
        allowed_operation_types,
        bvlos_authorised,
        requires_accountable_review,
        pending_amendment_reference,
        pending_submitted_at,
        approved_at,
        notes
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
      on conflict (operational_authority_profile_id, pilot_id)
      do update set
        authorisation_state = excluded.authorisation_state,
        allowed_operation_types = excluded.allowed_operation_types,
        bvlos_authorised = excluded.bvlos_authorised,
        requires_accountable_review = excluded.requires_accountable_review,
        pending_amendment_reference = excluded.pending_amendment_reference,
        pending_submitted_at = excluded.pending_submitted_at,
        approved_at = excluded.approved_at,
        notes = excluded.notes,
        updated_at = now()
      returning *
      `,
      [
        randomUUID(),
        params.profileId,
        params.organisationId,
        params.pilotId,
        params.authorisationState,
        JSON.stringify(params.allowedOperationTypes),
        params.bvlosAuthorised,
        params.requiresAccountableReview,
        params.pendingAmendmentReference,
        params.pendingSubmittedAt,
        params.approvedAt,
        params.notes,
      ],
    );

    return toPilotAuthorisation(result.rows[0]);
  }

  async listPilotAuthorisationsForProfile(
    tx: PoolClient,
    profileId: string,
  ): Promise<OperationalAuthorityPilotAuthorisation[]> {
    const result = await tx.query<OperationalAuthorityPilotAuthorisationRow>(
      `
      select *
      from operational_authority_pilot_authorisations
      where operational_authority_profile_id = $1
      order by created_at asc, id asc
      `,
      [profileId],
    );

    return result.rows.map((row) => toPilotAuthorisation(row));
  }

  async getPilotAuthorisationById(
    tx: PoolClient,
    authorisationId: string,
  ): Promise<OperationalAuthorityPilotAuthorisation | null> {
    const result = await tx.query<OperationalAuthorityPilotAuthorisationRow>(
      `
      select *
      from operational_authority_pilot_authorisations
      where id = $1
      `,
      [authorisationId],
    );

    return result.rows[0] ? toPilotAuthorisation(result.rows[0]) : null;
  }

  async updatePilotAuthorisation(
    tx: PoolClient,
    authorisationId: string,
    params: {
      authorisationState: OperationalAuthorityPilotAuthorisation["authorisationState"];
      allowedOperationTypes: string[];
      bvlosAuthorised: boolean;
      requiresAccountableReview: boolean;
      pendingAmendmentReference: string | null;
      pendingSubmittedAt: string | null;
      approvedAt: string | null;
      notes: string | null;
    },
  ): Promise<OperationalAuthorityPilotAuthorisation> {
    const result = await tx.query<OperationalAuthorityPilotAuthorisationRow>(
      `
      update operational_authority_pilot_authorisations
      set
        authorisation_state = $2,
        allowed_operation_types = $3::jsonb,
        bvlos_authorised = $4,
        requires_accountable_review = $5,
        pending_amendment_reference = $6,
        pending_submitted_at = $7,
        approved_at = $8,
        notes = $9,
        updated_at = now()
      where id = $1
      returning *
      `,
      [
        authorisationId,
        params.authorisationState,
        JSON.stringify(params.allowedOperationTypes),
        params.bvlosAuthorised,
        params.requiresAccountableReview,
        params.pendingAmendmentReference,
        params.pendingSubmittedAt,
        params.approvedAt,
        params.notes,
      ],
    );

    return toPilotAuthorisation(result.rows[0]);
  }

  async insertPilotAuthorisationReview(
    tx: PoolClient,
    params: {
      authorisationId: string;
      organisationId: string;
      decision: OperationalAuthorityPilotAuthorisationReview["decision"];
      reviewedBy: string;
      reviewRationale: string;
      evidenceRef: string | null;
      reviewedAt: string | null;
    },
  ): Promise<OperationalAuthorityPilotAuthorisationReview> {
    const result = await tx.query<OperationalAuthorityPilotAuthorisationReviewRow>(
      `
      insert into operational_authority_pilot_authorisation_reviews (
        id,
        operational_authority_pilot_authorisation_id,
        organisation_id,
        decision,
        reviewed_by,
        review_rationale,
        evidence_ref,
        reviewed_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, coalesce($8::timestamptz, now()))
      returning *
      `,
      [
        randomUUID(),
        params.authorisationId,
        params.organisationId,
        params.decision,
        params.reviewedBy,
        params.reviewRationale,
        params.evidenceRef,
        params.reviewedAt,
      ],
    );

    return toPilotAuthorisationReview(result.rows[0]);
  }

  async listPilotAuthorisationReviews(
    tx: PoolClient,
    authorisationId: string,
  ): Promise<OperationalAuthorityPilotAuthorisationReview[]> {
    const result = await tx.query<OperationalAuthorityPilotAuthorisationReviewRow>(
      `
      select *
      from operational_authority_pilot_authorisation_reviews
      where operational_authority_pilot_authorisation_id = $1
      order by reviewed_at desc, created_at desc, id desc
      `,
      [authorisationId],
    );

    return result.rows.map(toPilotAuthorisationReview);
  }

  async listProfilesByOrganisation(
    tx: PoolClient,
    organisationId: string,
  ): Promise<OperationalAuthorityProfile[]> {
    const result = await tx.query<OperationalAuthorityProfileRow>(
      `
      select *
      from operational_authority_profiles
      where organisation_id = $1
      order by created_at desc, id desc
      `,
      [organisationId],
    );

    return result.rows.map((row) => toProfile(row));
  }

  async getMissionGovernanceContext(
    tx: PoolClient,
    missionId: string,
  ): Promise<{
    missionId: string;
    organisationId: string | null;
    pilotId: string | null;
    operationType: string | null;
    requiresBvlos: boolean;
  } | null> {
    const result = await tx.query<MissionGovernanceRow>(
      `
      select
        id,
        organisation_id,
        pilot_id,
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
      pilotId: result.rows[0].pilot_id,
      operationType: result.rows[0].operation_type,
      requiresBvlos: result.rows[0].requires_bvlos,
    };
  }
}
