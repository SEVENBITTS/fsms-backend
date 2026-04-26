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
  await pool.query("delete from insurance_conditions");
  await pool.query("delete from insurance_profiles");
  await pool.query("delete from insurance_documents");
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
      "plan-insurance",
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
    displayName: "Insurance Test User",
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

describe("insurance integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("fails when a mission has no recorded active insurance", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId });
    const auth = await createUserAndSession("insurance-assessment@example.com");
    await createMembership(organisationId, auth.user.id, "viewer");

    const response = await request(app).get(
      `/missions/${missionId}/insurance-assessment`,
    ).set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      organisationId,
      result: "fail",
      reasons: [
        expect.objectContaining({
          code: "INSURANCE_ACTIVE_PROFILE_MISSING",
          severity: "fail",
        }),
      ],
      profile: null,
      document: null,
    });
  });

  it("passes when the active insurance profile covers the mission operation type", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("insurance-pass@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/insurance-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        providerName: "Aviation Mutual",
        policyNumber: "POL-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Covered operations",
            clauseReference: "INS 1.1",
            conditionPayload: {
              allowedOperationTypes: ["inspection", "survey"],
            },
          },
        ],
      });

    expect(createResponse.status).toBe(201);

    const activateResponse = await request(app)
      .post(`/insurance-profiles/${createResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "ops-manager" });

    expect(activateResponse.status).toBe(200);

    const response = await request(app).get(
      `/missions/${missionId}/insurance-assessment`,
    ).set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      organisationId,
      result: "pass",
      reasons: [
        expect.objectContaining({
          code: "INSURANCE_WITHIN_PROFILE",
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

  it("stores uploaded source-policy metadata against an insurance document", async () => {
    const organisationId = randomUUID();
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("insurance-upload@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/insurance-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        providerName: "Aviation Mutual",
        policyNumber: "POL-UP-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [],
      });

    expect(createResponse.status).toBe(201);

    const uploadResponse = await request(app)
      .post(`/insurance-documents/${createResponse.body.document.id}/upload`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        uploadedFileId: "file-insurance-policy-001",
        sourceDocumentType: "policy_schedule",
        uploadedFileName: "aviation-policy-2026.pdf",
        uploadedFileChecksum: "sha256:abc123",
        policyScheduleRefs: ["Schedule 1", "Endorsement B"],
        documentReviewNotes:
          "Policy uploaded for structured extraction and accountable review.",
        uploadedBy: "ops-manager",
      });

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.document).toMatchObject({
      id: createResponse.body.document.id,
      uploadedFileId: "file-insurance-policy-001",
      sourceDocumentType: "policy_schedule",
      uploadedFileName: "aviation-policy-2026.pdf",
      uploadedFileChecksum: "sha256:abc123",
      policyScheduleRefs: ["Schedule 1", "Endorsement B"],
      documentReviewNotes:
        "Policy uploaded for structured extraction and accountable review.",
      uploadedBy: "ops-manager",
    });
  });

  it("fails when the active insurance profile does not cover the mission operation type", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("insurance-fail-type@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/insurance-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        providerName: "Aviation Mutual",
        policyNumber: "POL-002",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Covered operations",
            clauseReference: "INS 2.1",
            conditionPayload: {
              allowedOperationTypes: ["survey"],
            },
          },
        ],
      });

    await request(app)
      .post(`/insurance-profiles/${createResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "ops-manager" });

    const response = await request(app).get(
      `/missions/${missionId}/insurance-assessment`,
    ).set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("fail");
    expect(response.body.reasons).toContainEqual(
      expect.objectContaining({
        code: "INSURANCE_OPERATION_TYPE_NOT_COVERED",
        severity: "fail",
      }),
    );
    expect(response.body.reasons).toContainEqual(
      expect.objectContaining({
        code: "INSURANCE_OPERATION_TYPE_NOT_COVERED",
        message: expect.stringContaining("may fall outside"),
      }),
    );
  });

  it("fails when a BVLOS mission has no recorded BVLOS cover", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({
      organisationId,
      operationType: "bvlos_commercial",
      requiresBvlos: true,
    });
    const validity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("insurance-bvlos@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/insurance-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        providerName: "Aviation Mutual",
        policyNumber: "POL-003",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Covered operations",
            clauseReference: "INS 3.1",
            conditionPayload: {
              allowedOperationTypes: ["bvlos_commercial"],
            },
          },
        ],
      });

    await request(app)
      .post(`/insurance-profiles/${createResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "ops-manager" });

    const response = await request(app).get(
      `/missions/${missionId}/insurance-assessment`,
    ).set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("fail");
    expect(response.body.reasons).toContainEqual(
      expect.objectContaining({
        code: "INSURANCE_BVLOS_NOT_COVERED",
        severity: "fail",
      }),
    );
  });

  it("fails when the recorded insurance has expired", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const validity = buildDateWindow(-365, -1);
    const auth = await createUserAndSession("insurance-expired@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/insurance-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        providerName: "Aviation Mutual",
        policyNumber: "POL-004",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Covered operations",
            clauseReference: "INS 4.1",
            conditionPayload: {
              allowedOperationTypes: ["inspection"],
            },
          },
        ],
      });

    await request(app)
      .post(`/insurance-profiles/${createResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "ops-manager" });

    const response = await request(app).get(
      `/missions/${missionId}/insurance-assessment`,
    ).set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("fail");
    expect(response.body.reasons).toContainEqual(
      expect.objectContaining({
        code: "INSURANCE_DOCUMENT_EXPIRED",
        severity: "fail",
      }),
    );
  });

  it("warns when the recorded insurance is approaching renewal", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const validity = buildDateWindow(-30, 10);
    const auth = await createUserAndSession("insurance-renewal@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/insurance-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        providerName: "Aviation Mutual",
        policyNumber: "POL-005",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Covered operations",
            clauseReference: "INS 5.1",
            conditionPayload: {
              allowedOperationTypes: ["inspection"],
            },
          },
        ],
      });

    await request(app)
      .post(`/insurance-profiles/${createResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "ops-manager" });

    const response = await request(app).get(
      `/missions/${missionId}/insurance-assessment`,
    ).set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("warning");
    expect(response.body.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INSURANCE_DOCUMENT_RENEWAL_SOON",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "INSURANCE_WITHIN_PROFILE",
          severity: "pass",
        }),
      ]),
    );
  });

  it("rejects insurance document upload when the authenticated user is outside the organisation", async () => {
    const organisationId = randomUUID();
    const owner = await createUserAndSession("insurance-owner@example.com");
    const outsider = await createUserAndSession("insurance-outsider@example.com");
    await createMembership(organisationId, owner.user.id, "admin");
    const validity = buildDateWindow(-30, 365);

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/insurance-documents`)
      .set("X-Session-Token", owner.sessionToken)
      .send({
        providerName: "Aviation Mutual",
        policyNumber: "POL-ACCESS-001",
        issueDate: validity.issueDate,
        effectiveFrom: validity.effectiveFrom,
        expiresAt: validity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [],
      });

    const response = await request(app)
      .post(`/insurance-documents/${createResponse.body.document.id}/upload`)
      .set("X-Session-Token", outsider.sessionToken)
      .send({
        uploadedFileId: "file-insurance-policy-001",
        sourceDocumentType: "policy_schedule",
        uploadedFileName: "aviation-policy-2026.pdf",
        uploadedFileChecksum: "sha256:abc123",
        policyScheduleRefs: ["Schedule 1"],
        documentReviewNotes: "Denied test.",
        uploadedBy: "outsider",
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: "organisation_membership_forbidden",
    });
  });
});
