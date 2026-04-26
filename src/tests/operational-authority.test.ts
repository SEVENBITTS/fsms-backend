import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from user_sessions");
  await pool.query("delete from organisation_memberships");
  await pool.query("delete from users");
  await pool.query("delete from stored_files");
  await pool.query("delete from organisation_documents");
  await pool.query("delete from operational_authority_pilot_authorisation_reviews");
  await pool.query("delete from operational_authority_pilot_authorisations");
  await pool.query("delete from operational_authority_sop_change_recommendations");
  await pool.query("delete from operational_authority_sop_documents");
  await pool.query("delete from operational_authority_conditions");
  await pool.query("delete from operational_authority_profiles");
  await pool.query("delete from operational_authority_documents");
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
};

const insertMission = async (params?: {
  missionId?: string;
  organisationId?: string | null;
  operationType?: string;
  requiresBvlos?: boolean;
}) => {
  const missionId = params?.missionId ?? randomUUID();
  await pool.query(
    `
    insert into missions (
      id,
      status,
      mission_plan_id,
      organisation_id,
      operation_type,
      requires_bvlos,
      last_event_sequence_no
    )
    values ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      missionId,
      "submitted",
      "plan-oa",
      params?.organisationId ?? null,
      params?.operationType ?? "inspection",
      params?.requiresBvlos ?? false,
      0,
    ],
  );

  return missionId;
};

const buildDateWindow = (effectiveOffsetDays: number, expiryOffsetDays: number) => {
  const now = Date.now();

  return {
    issueDate: new Date(now + (effectiveOffsetDays - 7) * 24 * 60 * 60 * 1000)
      .toISOString(),
    effectiveFrom: new Date(now + effectiveOffsetDays * 24 * 60 * 60 * 1000)
      .toISOString(),
    expiresAt: new Date(now + expiryOffsetDays * 24 * 60 * 60 * 1000)
      .toISOString(),
  };
};

const createUserAndSession = async (email: string) => {
  const createUserResponse = await request(app).post("/users").send({
    email,
    displayName: "OA Test User",
    password: "Password123!",
  });

  const loginResponse = await request(app).post("/auth/login").send({
    email,
    password: "Password123!",
  });

  return {
    user: createUserResponse.body.user,
    sessionToken: loginResponse.body.sessionToken as string,
  };
};

const createMembership = async (organisationId: string, userId: string, role: string) => {
  await request(app).post(`/organisations/${organisationId}/memberships`).send({
    userId,
    role,
  });
};

const createPilot = async () => {
  const response = await request(app).post("/pilots").send({
    displayName: "OA Pilot",
    status: "active",
  });

  expect(response.status).toBe(201);
  return response.body.pilot as { id: string };
};

describe("operational authority integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("fails when a mission has no recorded active OA", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId });
    const auth = await createUserAndSession("oa-assessment@example.com");
    await createMembership(organisationId, auth.user.id, "viewer");

    const response = await request(app)
      .get(`/missions/${missionId}/oa-assessment`)
      .set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      organisationId,
      result: "fail",
      reasons: [
        expect.objectContaining({
          code: "OA_ACTIVE_PROFILE_MISSING",
          severity: "fail",
        }),
      ],
      profile: null,
      document: null,
    });
  });

  it("passes when the active OA covers the mission operation type", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("oa-pass@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Permitted operations",
            clauseReference: "OA 1.1",
            conditionPayload: {
              allowedOperationTypes: ["inspection", "survey"],
            },
          },
        ],
      });

    expect(createResponse.status).toBe(201);

    const activateResponse = await request(app)
      .post(`/operational-authority-profiles/${createResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "accountable-manager" });

    expect(activateResponse.status).toBe(200);

    const response = await request(app)
      .get(`/missions/${missionId}/oa-assessment`)
      .set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      organisationId,
      result: "pass",
      reasons: [
        expect.objectContaining({
          code: "OA_WITHIN_PROFILE",
          severity: "pass",
        }),
      ],
      profile: expect.objectContaining({
        id: createResponse.body.profile.id,
        activationStatus: "active",
      }),
      document: expect.objectContaining({
        id: createResponse.body.document.id,
        status: "active",
        uploadedFileId: null,
      }),
    });
  });

  it("stores uploaded OA source metadata against the authority document", async () => {
    const organisationId = randomUUID();
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("oa-upload@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-UP-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [],
      });

    expect(createResponse.status).toBe(201);

    const uploadResponse = await request(app)
      .post(`/operational-authority-documents/${createResponse.body.document.id}/upload`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        uploadedFileId: "file-oa-001",
        sourceDocumentType: "operational_authorisation_pdf",
        uploadedFileName: "company-oa.pdf",
        uploadedFileChecksum: "sha256:def456",
        sourceClauseRefs: ["Section 2.1", "Annex B"],
        documentReviewNotes:
          "OA uploaded for structured extraction and accountable review.",
        uploadedBy: "compliance-lead",
      });

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.document).toMatchObject({
      id: createResponse.body.document.id,
      uploadedFileId: "file-oa-001",
      sourceDocumentType: "operational_authorisation_pdf",
      uploadedFileName: "company-oa.pdf",
      uploadedFileChecksum: "sha256:def456",
      sourceClauseRefs: ["Section 2.1", "Annex B"],
      documentReviewNotes:
        "OA uploaded for structured extraction and accountable review.",
      uploadedBy: "compliance-lead",
    });
  });

  it("fails when the active OA does not cover the mission operation type", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("oa-fail-type@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-002",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Permitted operations",
            clauseReference: "OA 2.1",
            conditionPayload: {
              allowedOperationTypes: ["survey"],
            },
          },
        ],
      });

    await request(app)
      .post(`/operational-authority-profiles/${createResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "accountable-manager" });

    const response = await request(app)
      .get(`/missions/${missionId}/oa-assessment`)
      .set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("fail");
    expect(response.body.reasons).toContainEqual(
      expect.objectContaining({
        code: "OA_OPERATION_TYPE_NOT_AUTHORISED",
        severity: "fail",
      }),
    );
  });

  it("fails when a BVLOS mission has no recorded BVLOS authorisation", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({
      organisationId,
      operationType: "bvlos_commercial",
      requiresBvlos: true,
    });
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("oa-bvlos@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-003",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Permitted operations",
            clauseReference: "OA 3.1",
            conditionPayload: {
              allowedOperationTypes: ["bvlos_commercial"],
            },
          },
        ],
      });

    await request(app)
      .post(`/operational-authority-profiles/${createResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "accountable-manager" });

    const response = await request(app)
      .get(`/missions/${missionId}/oa-assessment`)
      .set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("fail");
    expect(response.body.reasons).toContainEqual(
      expect.objectContaining({
        code: "OA_BVLOS_NOT_AUTHORISED",
        severity: "fail",
      }),
    );
  });

  it("fails when the recorded OA has expired", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const validity = buildDateWindow(-365, -1);
    const auth = await createUserAndSession("oa-expired@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-004",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Permitted operations",
            clauseReference: "OA 4.1",
            conditionPayload: {
              allowedOperationTypes: ["inspection"],
            },
          },
        ],
      });

    await request(app)
      .post(`/operational-authority-profiles/${createResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "accountable-manager" });

    const response = await request(app)
      .get(`/missions/${missionId}/oa-assessment`)
      .set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("fail");
    expect(response.body.reasons).toContainEqual(
      expect.objectContaining({
        code: "OA_DOCUMENT_EXPIRED",
        severity: "fail",
      }),
    );
  });

  it("warns when the recorded OA is approaching renewal", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const validity = buildDateWindow(-30, 10);
    const auth = await createUserAndSession("oa-renewal@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-005",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Permitted operations",
            clauseReference: "OA 5.1",
            conditionPayload: {
              allowedOperationTypes: ["inspection"],
            },
          },
        ],
      });

    await request(app)
      .post(`/operational-authority-profiles/${createResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "accountable-manager" });

    const response = await request(app)
      .get(`/missions/${missionId}/oa-assessment`)
      .set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("warning");
    expect(response.body.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OA_DOCUMENT_RENEWAL_SOON",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "OA_WITHIN_PROFILE",
          severity: "pass",
        }),
      ]),
    );
  });

  it("rejects OA document upload when the authenticated user is not a member of the organisation", async () => {
    const organisationId = randomUUID();
    const outsider = await createUserAndSession("oa-outsider@example.com");
    const validity = buildDateWindow(-30, 365);
    const owner = await createUserAndSession("oa-owner@example.com");
    await createMembership(organisationId, owner.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", owner.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-ACCESS-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [],
      });

    const response = await request(app)
      .post(`/operational-authority-documents/${createResponse.body.document.id}/upload`)
      .set("X-Session-Token", outsider.sessionToken)
      .send({
        uploadedFileId: "file-oa-denied-001",
        sourceDocumentType: "operational_authorisation_pdf",
        uploadedFileName: "company-oa.pdf",
        uploadedFileChecksum: "sha256:def456",
        sourceClauseRefs: ["Section 2.1"],
        documentReviewNotes: "Denied test.",
        uploadedBy: "outsider",
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: "organisation_membership_forbidden",
    });
  });

  it("creates, lists, and updates OA pilot authorisations for a profile", async () => {
    const organisationId = randomUUID();
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("oa-pilot-admin@example.com");
    await createMembership(organisationId, auth.user.id, "admin");
    const pilot = await createPilot();

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-PILOT-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [],
      });

    expect(createResponse.status).toBe(201);

    const createPilotAuthResponse = await request(app)
      .post(
        `/operational-authority-profiles/${createResponse.body.profile.id}/pilot-authorisations`,
      )
      .set("X-Session-Token", auth.sessionToken)
      .send({
        pilotId: pilot.id,
        authorisationState: "pending_amendment",
        allowedOperationTypes: ["inspection"],
        bvlosAuthorised: false,
        requiresAccountableReview: true,
        pendingAmendmentReference: "CAA-AMEND-001",
        pendingSubmittedAt: new Date().toISOString(),
        notes: "Awaiting CAA amendment",
      });

    expect(createPilotAuthResponse.status).toBe(201);
    expect(createPilotAuthResponse.body.authorisation).toMatchObject({
      pilotId: pilot.id,
      authorisationState: "pending_amendment",
      requiresAccountableReview: true,
    });

    const listResponse = await request(app)
      .get(
        `/operational-authority-profiles/${createResponse.body.profile.id}/pilot-authorisations`,
      )
      .set("X-Session-Token", auth.sessionToken);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.authorisations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pilotId: pilot.id,
          authorisationState: "pending_amendment",
        }),
      ]),
    );

    const authorisationId = createPilotAuthResponse.body.authorisation.id;
    const updateResponse = await request(app)
      .patch(`/operational-authority-pilot-authorisations/${authorisationId}`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorisationState: "authorised",
        allowedOperationTypes: ["inspection", "survey"],
        bvlosAuthorised: true,
        requiresAccountableReview: false,
        pendingAmendmentReference: null,
        pendingSubmittedAt: null,
        approvedAt: new Date().toISOString(),
        notes: "CAA amendment approved",
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.authorisation).toMatchObject({
      id: authorisationId,
      authorisationState: "authorised",
      bvlosAuthorised: true,
      requiresAccountableReview: false,
    });
  });

  it("models SOPs as distinct linked documents under an OA profile", async () => {
    const organisationId = randomUUID();
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("oa-sop-admin@example.com");
    await createMembership(organisationId, auth.user.id, "compliance_manager");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-SOP-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Permitted operations",
            clauseReference: "OA 7.1",
            conditionPayload: { allowedOperationTypes: ["inspection"] },
          },
        ],
      });

    expect(createResponse.status).toBe(201);
    const conditionId = createResponse.body.conditions[0].id;

    const createSopResponse = await request(app)
      .post(
        `/operational-authority-profiles/${createResponse.body.profile.id}/sop-documents`,
      )
      .set("X-Session-Token", auth.sessionToken)
      .send({
        sopCode: "SOP-FLT-003",
        title: "Infrastructure Inspection Flight Procedure",
        version: "2.1",
        status: "active",
        owner: "Head of Flight Operations",
        sourceDocumentId: "stored-file-sop-003",
        sourceDocumentType: "standard_operating_procedure",
        sourceClauseRefs: ["SOP 3.2", "SOP 5.4"],
        linkedOaConditionIds: [conditionId],
        changeRecommendationScope: [
          "weather_review",
          "pilot_briefing",
          "post_operation_learning",
        ],
        reviewNotes:
          "Linked below the OA so change recommendations can point at the relevant SOP.",
      });

    expect(createSopResponse.status).toBe(201);
    expect(createSopResponse.body.sopDocument).toMatchObject({
      operationalAuthorityProfileId: createResponse.body.profile.id,
      organisationId,
      sopCode: "SOP-FLT-003",
      title: "Infrastructure Inspection Flight Procedure",
      version: "2.1",
      status: "active",
      sourceClauseRefs: ["SOP 3.2", "SOP 5.4"],
      linkedOaConditionIds: [conditionId],
      changeRecommendationScope: [
        "weather_review",
        "pilot_briefing",
        "post_operation_learning",
      ],
    });

    const listResponse = await request(app)
      .get(
        `/operational-authority-profiles/${createResponse.body.profile.id}/sop-documents`,
      )
      .set("X-Session-Token", auth.sessionToken);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.sopDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createSopResponse.body.sopDocument.id,
          sopCode: "SOP-FLT-003",
          linkedOaConditionIds: [conditionId],
        }),
      ]),
    );
  });

  it("prevents non-governance roles from creating OA-linked SOP documents", async () => {
    const organisationId = randomUUID();
    const validity = buildDateWindow(-30, 365);
    const admin = await createUserAndSession("oa-sop-owner@example.com");
    const operator = await createUserAndSession("oa-sop-operator@example.com");
    await createMembership(organisationId, admin.user.id, "admin");
    await createMembership(organisationId, operator.user.id, "operator");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", admin.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-SOP-DENIED-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "admin",
        conditions: [],
      });

    const response = await request(app)
      .post(
        `/operational-authority-profiles/${createResponse.body.profile.id}/sop-documents`,
      )
      .set("X-Session-Token", operator.sessionToken)
      .send({
        sopCode: "SOP-DENIED",
        title: "Operator-created SOP",
        version: "1.0",
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: "organisation_membership_forbidden",
    });
  });

  it("creates and lists schema-backed SOP change recommendations against mission evidence", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId });
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("oa-sop-change@example.com");
    await createMembership(organisationId, auth.user.id, "operations_manager");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-SOP-REC-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Permitted inspections",
            clauseReference: "OA 8.1",
            conditionPayload: { allowedOperationTypes: ["inspection"] },
          },
        ],
      });

    const conditionId = createResponse.body.conditions[0].id;
    const sopResponse = await request(app)
      .post(
        `/operational-authority-profiles/${createResponse.body.profile.id}/sop-documents`,
      )
      .set("X-Session-Token", auth.sessionToken)
      .send({
        sopCode: "SOP-FLT-009",
        title: "Post-operation review procedure",
        version: "1.0",
        status: "active",
        sourceClauseRefs: ["SOP 9.4"],
        linkedOaConditionIds: [conditionId],
        changeRecommendationScope: ["post_operation_learning"],
      });

    expect(sopResponse.status).toBe(201);

    const createRecommendationResponse = await request(app)
      .post(`/missions/${missionId}/sop-change-recommendations`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        profileId: createResponse.body.profile.id,
        sopDocumentId: sopResponse.body.sopDocument.id,
        parentOaConditionId: conditionId,
        sopClauseRef: "SOP 9.4",
        recommendationType: "sop_amendment_recommended",
        evidenceSourceType: "post_operation_evidence_snapshot",
        evidenceSourceId: "snapshot-001",
        findingSummary:
          "Post-operation review found repeated late weather evidence capture.",
        recommendation:
          "Review SOP 9.4 to clarify weather evidence timing before future inspections.",
        createdBy: "ops-manager",
      });

    expect(createRecommendationResponse.status).toBe(201);
    expect(createRecommendationResponse.body.recommendation).toMatchObject({
      missionId,
      organisationId,
      operationalAuthorityProfileId: createResponse.body.profile.id,
      operationalAuthoritySopDocumentId: sopResponse.body.sopDocument.id,
      parentOaConditionId: conditionId,
      sopCode: "SOP-FLT-009",
      sopClauseRef: "SOP 9.4",
      recommendationType: "sop_amendment_recommended",
      status: "draft",
      evidenceSourceType: "post_operation_evidence_snapshot",
      evidenceSourceId: "snapshot-001",
    });

    const listResponse = await request(app)
      .get(`/missions/${missionId}/sop-change-recommendations`)
      .set("X-Session-Token", auth.sessionToken);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createRecommendationResponse.body.recommendation.id,
          sopCode: "SOP-FLT-009",
          status: "draft",
        }),
      ]),
    );
  });

  it("prevents operators from creating SOP change recommendations", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId });
    const validity = buildDateWindow(-30, 365);
    const admin = await createUserAndSession("oa-sop-change-admin@example.com");
    const operator = await createUserAndSession("oa-sop-change-operator@example.com");
    await createMembership(organisationId, admin.user.id, "admin");
    await createMembership(organisationId, operator.user.id, "operator");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", admin.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-SOP-REC-DENIED-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "admin",
        conditions: [],
      });

    const sopResponse = await request(app)
      .post(
        `/operational-authority-profiles/${createResponse.body.profile.id}/sop-documents`,
      )
      .set("X-Session-Token", admin.sessionToken)
      .send({
        sopCode: "SOP-DENIED-REC",
        title: "Operator denied recommendation",
        version: "1.0",
      });

    const response = await request(app)
      .post(`/missions/${missionId}/sop-change-recommendations`)
      .set("X-Session-Token", operator.sessionToken)
      .send({
        profileId: createResponse.body.profile.id,
        sopDocumentId: sopResponse.body.sopDocument.id,
        recommendationType: "sop_review_recommended",
        evidenceSourceType: "timeline",
        evidenceSourceId: "timeline-1",
        findingSummary: "Operator should not be able to create this.",
        recommendation: "Should be blocked.",
        createdBy: "operator",
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: "organisation_membership_forbidden",
    });
  });

  it("records accountable manager review for pending OA pilot amendment", async () => {
    const organisationId = randomUUID();
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("oa-pilot-review@example.com");
    await createMembership(organisationId, auth.user.id, "accountable_manager");
    const pilot = await createPilot();

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-PILOT-REVIEW-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "accountable-manager",
        conditions: [],
      });

    expect(createResponse.status).toBe(201);

    const createPilotAuthResponse = await request(app)
      .post(
        `/operational-authority-profiles/${createResponse.body.profile.id}/pilot-authorisations`,
      )
      .set("X-Session-Token", auth.sessionToken)
      .send({
        pilotId: pilot.id,
        authorisationState: "pending_amendment",
        allowedOperationTypes: ["inspection"],
        bvlosAuthorised: false,
        requiresAccountableReview: true,
        pendingAmendmentReference: "CAA-AMEND-099",
        pendingSubmittedAt: new Date().toISOString(),
        notes: "Awaiting formal OA amendment.",
      });

    expect(createPilotAuthResponse.status).toBe(201);
    const authorisationId = createPilotAuthResponse.body.authorisation.id;

    const reviewResponse = await request(app)
      .post(`/operational-authority-pilot-authorisations/${authorisationId}/reviews`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        decision: "accepted_for_tracking",
        reviewedBy: "Accountable Manager",
        reviewRationale:
          "Pilot accepted into amendment tracking; no formal OA authorisation assumed.",
        evidenceRef: "ASM-2026-04-26",
      });

    expect(reviewResponse.status).toBe(201);
    expect(reviewResponse.body.review).toMatchObject({
      operationalAuthorityPilotAuthorisationId: authorisationId,
      organisationId,
      decision: "accepted_for_tracking",
      reviewedBy: "Accountable Manager",
      evidenceRef: "ASM-2026-04-26",
    });

    const listResponse = await request(app)
      .get(`/operational-authority-pilot-authorisations/${authorisationId}/reviews`)
      .set("X-Session-Token", auth.sessionToken);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.reviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: reviewResponse.body.review.id,
          decision: "accepted_for_tracking",
        }),
      ]),
    );
  });

  it("prevents non-accountable roles from recording OA pilot amendment reviews", async () => {
    const organisationId = randomUUID();
    const validity = buildDateWindow(-30, 365);
    const admin = await createUserAndSession("oa-pilot-review-admin@example.com");
    const operator = await createUserAndSession("oa-pilot-review-operator@example.com");
    await createMembership(organisationId, admin.user.id, "admin");
    await createMembership(organisationId, operator.user.id, "operator");
    const pilot = await createPilot();

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", admin.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-PILOT-REVIEW-DENIED-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "admin",
        conditions: [],
      });

    const createPilotAuthResponse = await request(app)
      .post(
        `/operational-authority-profiles/${createResponse.body.profile.id}/pilot-authorisations`,
      )
      .set("X-Session-Token", admin.sessionToken)
      .send({
        pilotId: pilot.id,
        authorisationState: "pending_amendment",
        allowedOperationTypes: ["inspection"],
        bvlosAuthorised: false,
        requiresAccountableReview: true,
        pendingAmendmentReference: "CAA-AMEND-100",
      });

    const response = await request(app)
      .post(
        `/operational-authority-pilot-authorisations/${createPilotAuthResponse.body.authorisation.id}/reviews`,
      )
      .set("X-Session-Token", operator.sessionToken)
      .send({
        decision: "accepted_for_tracking",
        reviewedBy: "Operator",
        reviewRationale: "Should not be accepted from this role.",
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: "organisation_membership_forbidden",
    });
  });
});
