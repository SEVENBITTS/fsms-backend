import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearPilotTables = async () => {
  await pool.query("delete from operational_authority_pilot_authorisation_reviews");
  await pool.query("delete from operational_authority_pilot_authorisations");
  await pool.query("delete from operational_authority_conditions");
  await pool.query("delete from operational_authority_profiles");
  await pool.query("delete from operational_authority_documents");
  await pool.query("delete from missions");
  await pool.query("delete from pilot_readiness_evidence");
  await pool.query("delete from pilots");
};

const createPilot = async (params: {
  displayName: string;
  status?: string;
}) => {
  const response = await request(app).post("/pilots").send(params);
  expect(response.status).toBe(201);
  return response.body.pilot as { id: string };
};

const createPilotEvidence = async (pilotId: string) => {
  const response = await request(app)
    .post(`/pilots/${pilotId}/readiness-evidence`)
    .send({
      evidenceType: "operator_authorisation",
      title: "Current operator authorisation",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

  expect(response.status).toBe(201);
  return response.body.evidence as { id: string };
};

const createActiveOaPilotAuthorisation = async (
  pilotId: string,
  params?: {
    authorisationState?: string;
    requiresAccountableReview?: boolean;
    pendingAmendmentReference?: string | null;
  },
) => {
  const organisationId = randomUUID();
  const documentId = randomUUID();
  const profileId = randomUUID();
  const authorisationId = randomUUID();

  await pool.query(
    `
    insert into operational_authority_documents (
      id,
      organisation_id,
      authority_name,
      reference_number,
      issue_date,
      effective_from,
      expires_at,
      status,
      uploaded_by
    )
    values (
      $1,
      $2,
      'CAA',
      'OA-PILOT-001',
      now() - interval '30 days',
      now() - interval '30 days',
      now() + interval '365 days',
      'active',
      'compliance-lead'
    )
    `,
    [documentId, organisationId],
  );

  await pool.query(
    `
    insert into operational_authority_profiles (
      id,
      organisation_id,
      operational_authority_document_id,
      version_number,
      review_status,
      activation_status,
      activated_by,
      activated_at
    )
    values ($1, $2, $3, 1, 'reviewed', 'active', 'compliance-lead', now())
    `,
    [profileId, organisationId, documentId],
  );

  await pool.query(
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
    values ($1, $2, $3, $4, $5, $6::jsonb, false, $7, $8, now(), now(), $9)
    `,
    [
      authorisationId,
      profileId,
      organisationId,
      pilotId,
      params?.authorisationState ?? "authorised",
      JSON.stringify(["inspection", "survey"]),
      params?.requiresAccountableReview ?? false,
      params?.pendingAmendmentReference ?? null,
      "OA personnel state captured for pilot readiness.",
    ],
  );

  return { organisationId, documentId, profileId, authorisationId };
};

const createOaPilotAuthorisationReview = async (
  authorisationId: string,
  organisationId: string,
) => {
  await pool.query(
    `
    insert into operational_authority_pilot_authorisation_reviews (
      id,
      operational_authority_pilot_authorisation_id,
      organisation_id,
      decision,
      reviewed_by,
      review_rationale,
      evidence_ref
    )
    values (
      $1,
      $2,
      $3,
      'accepted_for_tracking',
      'Accountable Manager',
      'Accepted into OA amendment tracking; formal CAA approval remains outstanding.',
      'ASM-2026-04-26'
    )
    `,
    [randomUUID(), authorisationId, organisationId],
  );
};

const countPilotRows = async (pilotId: string) => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from pilots where id = $1) as pilot_count,
      (select count(*)::int from pilot_readiness_evidence where pilot_id = $1) as evidence_count
    `,
    [pilotId],
  );

  return result.rows[0] as {
    pilot_count: number;
    evidence_count: number;
  };
};

describe("pilot readiness integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearPilotTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("passes readiness for an active pilot with current evidence", async () => {
    const pilot = await createPilot({
      displayName: "Ready Pilot",
      status: "active",
    });

    const evidence = await createPilotEvidence(pilot.id);
    const before = await countPilotRows(pilot.id);

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "pass",
      reasons: [
        {
          code: "PILOT_ACTIVE",
          severity: "pass",
          relatedEvidenceIds: [evidence.id],
        },
      ],
    });
    expect(response.body.readinessStatus.currentEvidence).toHaveLength(1);
    expect(response.body.readinessStatus.operationalAuthority).toMatchObject({
      result: "not_recorded",
      authorisations: [],
    });
    expect(await countPilotRows(pilot.id)).toEqual(before);
  });

  it("shows current OA authorisation directly on pilot readiness", async () => {
    const pilot = await createPilot({
      displayName: "OA Authorised Pilot",
      status: "active",
    });
    await createPilotEvidence(pilot.id);
    const oa = await createActiveOaPilotAuthorisation(pilot.id);

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "pass",
      readinessStatus: {
        operationalAuthority: {
          result: "pass",
          summary: "Pilot is recorded as authorised on a current OA profile.",
          authorisations: [
            expect.objectContaining({
              id: oa.authorisationId,
              operationalAuthorityProfileId: oa.profileId,
              organisationId: oa.organisationId,
              pilotId: pilot.id,
              authorisationState: "authorised",
            }),
          ],
        },
      },
    });
    expect(response.body.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PILOT_OA_AUTHORISED",
          severity: "pass",
        }),
      ]),
    );
  });

  it("surfaces pending CAA OA amendment on pilot readiness", async () => {
    const pilot = await createPilot({
      displayName: "Pending Amendment Pilot",
      status: "active",
    });
    await createPilotEvidence(pilot.id);
    await createActiveOaPilotAuthorisation(pilot.id, {
      authorisationState: "pending_amendment",
      requiresAccountableReview: true,
      pendingAmendmentReference: "CAA-AMEND-017",
    });

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "warning",
      readinessStatus: {
        operationalAuthority: {
          result: "warning",
          summary:
            "One or more current OA pilot authorisations require amendment tracking or accountable review.",
          authorisations: [
            expect.objectContaining({
              authorisationState: "pending_amendment",
              pendingAmendmentReference: "CAA-AMEND-017",
              requiresAccountableReview: true,
            }),
          ],
        },
      },
    });
    expect(response.body.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PILOT_OA_PENDING_AMENDMENT",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "PILOT_OA_ACCOUNTABLE_REVIEW_REQUIRED",
          severity: "warning",
        }),
      ]),
    );
  });

  it("shows completed accountable review for pending OA amendment on pilot readiness", async () => {
    const pilot = await createPilot({
      displayName: "Reviewed Pending Pilot",
      status: "active",
    });
    await createPilotEvidence(pilot.id);
    const oa = await createActiveOaPilotAuthorisation(pilot.id, {
      authorisationState: "pending_amendment",
      requiresAccountableReview: true,
      pendingAmendmentReference: "CAA-AMEND-018",
    });
    await createOaPilotAuthorisationReview(
      oa.authorisationId,
      oa.organisationId,
    );

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "warning",
      readinessStatus: {
        operationalAuthority: {
          result: "warning",
          authorisations: [
            expect.objectContaining({
              authorisationState: "pending_amendment",
              reviewStatus: "completed",
              latestReview: expect.objectContaining({
                decision: "accepted_for_tracking",
                reviewedBy: "Accountable Manager",
                evidenceRef: "ASM-2026-04-26",
              }),
            }),
          ],
        },
      },
    });
    expect(response.body.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PILOT_OA_PENDING_AMENDMENT",
          severity: "warning",
          message:
            "Pilot is recorded against the OA as pending CAA amendment with accountable review completed for tracking",
        }),
      ]),
    );
    expect(response.body.reasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PILOT_OA_ACCOUNTABLE_REVIEW_REQUIRED",
        }),
      ]),
    );
  });

  it("fails readiness for an active pilot with no current evidence", async () => {
    const pilot = await createPilot({
      displayName: "No Evidence Pilot",
      status: "active",
    });
    const before = await countPilotRows(pilot.id);

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "fail",
      reasons: [
        {
          code: "PILOT_EVIDENCE_MISSING",
          severity: "fail",
        },
      ],
    });
    expect(await countPilotRows(pilot.id)).toEqual(before);
  });

  it("fails readiness for expired pilot evidence", async () => {
    const pilot = await createPilot({
      displayName: "Expired Pilot",
      status: "active",
    });

    const evidenceResponse = await request(app)
      .post(`/pilots/${pilot.id}/readiness-evidence`)
      .send({
        evidenceType: "operator_authorisation",
        title: "Expired operator authorisation",
        expiresAt: "2020-01-01T00:00:00.000Z",
      });

    expect(evidenceResponse.status).toBe(201);
    const evidenceId = evidenceResponse.body.evidence.id;

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("fail");
    expect(response.body.reasons).toContainEqual({
      code: "PILOT_EVIDENCE_MISSING",
      severity: "fail",
      message: "Pilot has no current readiness evidence",
    });
    expect(response.body.reasons).toContainEqual({
      code: "PILOT_EVIDENCE_EXPIRED",
      severity: "fail",
      message: "Pilot has expired readiness evidence",
      relatedEvidenceIds: [evidenceId],
    });
  });

  it("warns readiness for an inactive pilot with current evidence", async () => {
    const pilot = await createPilot({
      displayName: "Inactive Pilot",
      status: "inactive",
    });

    await createPilotEvidence(pilot.id);

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "warning",
      reasons: [
        {
          code: "PILOT_INACTIVE",
          severity: "warning",
        },
      ],
    });
  });

  it.each([
    {
      status: "suspended",
      code: "PILOT_SUSPENDED",
    },
    {
      status: "retired",
      code: "PILOT_RETIRED",
    },
  ])("fails readiness for a $status pilot", async ({ status, code }) => {
    const pilot = await createPilot({
      displayName: `${status} Pilot`,
      status,
    });

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "fail",
      reasons: [
        {
          code,
          severity: "fail",
        },
      ],
    });
  });

  it("returns not found for unknown pilots", async () => {
    const response = await request(app).get(
      "/pilots/7a2ed2c4-e238-4743-aa60-5bcd5a50d7b7/readiness",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "pilot_not_found",
      },
    });
  });
});
