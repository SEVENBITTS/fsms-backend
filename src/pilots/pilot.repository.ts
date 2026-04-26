import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  Pilot,
  PilotEvidence,
  PilotOperationalAuthorityAuthorisation,
  PilotOperationalAuthorityAuthorisationReview,
} from "./pilot.types";

interface PilotRow extends QueryResultRow {
  id: string;
  display_name: string;
  caa_reference: string | null;
  status: Pilot["status"];
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PilotEvidenceRow extends QueryResultRow {
  id: string;
  pilot_id: string;
  evidence_type: string;
  title: string;
  issued_at: Date | null;
  expires_at: Date | null;
  status: PilotEvidence["status"];
  evidence_ref: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PilotOperationalAuthorityAuthorisationRow extends QueryResultRow {
  id: string;
  operational_authority_profile_id: string;
  organisation_id: string;
  pilot_id: string;
  authorisation_state: PilotOperationalAuthorityAuthorisation["authorisationState"];
  allowed_operation_types: string[] | null;
  bvlos_authorised: boolean;
  requires_accountable_review: boolean;
  pending_amendment_reference: string | null;
  pending_submitted_at: Date | null;
  approved_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  latest_review_id: string | null;
  latest_review_decision:
    | PilotOperationalAuthorityAuthorisationReview["decision"]
    | null;
  latest_reviewed_by: string | null;
  latest_review_rationale: string | null;
  latest_review_evidence_ref: string | null;
  latest_reviewed_at: Date | null;
  latest_review_created_at: Date | null;
}

type CreatePilotRow = Omit<Pilot, "id" | "createdAt" | "updatedAt">;

type CreatePilotEvidenceRow = {
  pilotId: string;
  evidenceType: string;
  title: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  status: PilotEvidence["status"];
  evidenceRef: string | null;
  notes: string | null;
};

const toPilot = (row: PilotRow): Pilot => ({
  id: row.id,
  displayName: row.display_name,
  caaReference: row.caa_reference,
  status: row.status,
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toEvidence = (row: PilotEvidenceRow): PilotEvidence => ({
  id: row.id,
  pilotId: row.pilot_id,
  evidenceType: row.evidence_type,
  title: row.title,
  issuedAt: row.issued_at?.toISOString() ?? null,
  expiresAt: row.expires_at?.toISOString() ?? null,
  status: row.status,
  evidenceRef: row.evidence_ref,
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toOperationalAuthorityAuthorisation = (
  row: PilotOperationalAuthorityAuthorisationRow,
): PilotOperationalAuthorityAuthorisation => ({
  id: row.id,
  operationalAuthorityProfileId: row.operational_authority_profile_id,
  organisationId: row.organisation_id,
  pilotId: row.pilot_id,
  authorisationState: row.authorisation_state,
  allowedOperationTypes: row.allowed_operation_types ?? [],
  bvlosAuthorised: row.bvlos_authorised,
  requiresAccountableReview: row.requires_accountable_review,
  pendingAmendmentReference: row.pending_amendment_reference,
  pendingSubmittedAt: row.pending_submitted_at?.toISOString() ?? null,
  approvedAt: row.approved_at?.toISOString() ?? null,
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  latestReview: row.latest_review_id
    ? {
        id: row.latest_review_id,
        operationalAuthorityPilotAuthorisationId: row.id,
        organisationId: row.organisation_id,
        decision: row.latest_review_decision!,
        reviewedBy: row.latest_reviewed_by!,
        reviewRationale: row.latest_review_rationale!,
        evidenceRef: row.latest_review_evidence_ref,
        reviewedAt: row.latest_reviewed_at!.toISOString(),
        createdAt: row.latest_review_created_at!.toISOString(),
      }
    : null,
  reviewStatus:
    row.authorisation_state === "pending_amendment" ||
    row.requires_accountable_review
      ? row.latest_review_id
        ? "completed"
        : "required"
      : "not_required",
});

export class PilotRepository {
  async listPilots(tx: PoolClient): Promise<Pilot[]> {
    const result = await tx.query<PilotRow>(
      `
      select *
      from pilots
      order by created_at asc, id asc
      `,
    );

    return result.rows.map(toPilot);
  }

  async insertPilot(tx: PoolClient, input: CreatePilotRow): Promise<Pilot> {
    const result = await tx.query<PilotRow>(
      `
      insert into pilots (
        id,
        display_name,
        caa_reference,
        status,
        notes
      )
      values ($1, $2, $3, $4, $5)
      returning *
      `,
      [
        randomUUID(),
        input.displayName,
        input.caaReference,
        input.status,
        input.notes,
      ],
    );

    return toPilot(result.rows[0]);
  }

  async getPilotById(tx: PoolClient, pilotId: string): Promise<Pilot | null> {
    const result = await tx.query<PilotRow>(
      `
      select *
      from pilots
      where id = $1
      `,
      [pilotId],
    );

    return result.rows[0] ? toPilot(result.rows[0]) : null;
  }

  async insertEvidence(
    tx: PoolClient,
    input: CreatePilotEvidenceRow,
  ): Promise<PilotEvidence> {
    const result = await tx.query<PilotEvidenceRow>(
      `
      insert into pilot_readiness_evidence (
        id,
        pilot_id,
        evidence_type,
        title,
        issued_at,
        expires_at,
        status,
        evidence_ref,
        notes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        randomUUID(),
        input.pilotId,
        input.evidenceType,
        input.title,
        input.issuedAt,
        input.expiresAt,
        input.status,
        input.evidenceRef,
        input.notes,
      ],
    );

    return toEvidence(result.rows[0]);
  }

  async listEvidence(tx: PoolClient, pilotId: string): Promise<PilotEvidence[]> {
    const result = await tx.query<PilotEvidenceRow>(
      `
      select *
      from pilot_readiness_evidence
      where pilot_id = $1
      order by created_at asc, id asc
      `,
      [pilotId],
    );

    return result.rows.map(toEvidence);
  }

  async listCurrentOperationalAuthorityAuthorisations(
    tx: PoolClient,
    pilotId: string,
  ): Promise<PilotOperationalAuthorityAuthorisation[]> {
    const result = await tx.query<PilotOperationalAuthorityAuthorisationRow>(
      `
      select
        pilot_authorisations.*,
        latest_review.id as latest_review_id,
        latest_review.decision as latest_review_decision,
        latest_review.reviewed_by as latest_reviewed_by,
        latest_review.review_rationale as latest_review_rationale,
        latest_review.evidence_ref as latest_review_evidence_ref,
        latest_review.reviewed_at as latest_reviewed_at,
        latest_review.created_at as latest_review_created_at
      from operational_authority_pilot_authorisations pilot_authorisations
      join operational_authority_profiles profiles
        on profiles.id = pilot_authorisations.operational_authority_profile_id
      left join lateral (
        select *
        from operational_authority_pilot_authorisation_reviews reviews
        where reviews.operational_authority_pilot_authorisation_id =
          pilot_authorisations.id
        order by reviews.reviewed_at desc, reviews.created_at desc, reviews.id desc
        limit 1
      ) latest_review on true
      where pilot_authorisations.pilot_id = $1
        and profiles.activation_status = 'active'
      order by pilot_authorisations.updated_at desc, pilot_authorisations.id desc
      `,
      [pilotId],
    );

    return result.rows.map(toOperationalAuthorityAuthorisation);
  }
}
