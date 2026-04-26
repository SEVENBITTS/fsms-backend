import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from user_sessions");
  await pool.query("delete from organisation_memberships");
  await pool.query("delete from users");
  await pool.query("delete from operational_authority_pilot_authorisations");
  await pool.query("delete from operational_authority_conditions");
  await pool.query("delete from operational_authority_profiles");
  await pool.query("delete from operational_authority_documents");
  await pool.query("delete from insurance_conditions");
  await pool.query("delete from insurance_profiles");
  await pool.query("delete from insurance_documents");
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
};

const createUserAndSession = async (email: string) => {
  const createUserResponse = await request(app).post("/users").send({
    email,
    displayName: "Governance Test User",
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
      "plan-governance",
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

describe("mission governance integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns a joined governance view across OA and insurance", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const oaValidity = buildDateWindow(-30, 10);
    const insuranceValidity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("gov-view@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const oaResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-GOV-001",
        issueDate: oaValidity.issueDate,
        effectiveFrom: oaValidity.effectiveFrom,
        expiresAt: oaValidity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Permitted operations",
            clauseReference: "OA GOV 1.1",
            conditionPayload: {
              allowedOperationTypes: ["inspection"],
            },
          },
        ],
      });

    await request(app)
      .post(`/operational-authority-profiles/${oaResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "accountable-manager" });

    const insuranceResponse = await request(app)
      .post(`/organisations/${organisationId}/insurance-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        providerName: "Aviation Mutual",
        policyNumber: "POL-GOV-001",
        issueDate: insuranceValidity.issueDate,
        effectiveFrom: insuranceValidity.effectiveFrom,
        expiresAt: insuranceValidity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Covered operations",
            clauseReference: "INS GOV 1.1",
            conditionPayload: {
              allowedOperationTypes: ["inspection"],
            },
          },
        ],
      });

    await request(app)
      .post(`/insurance-profiles/${insuranceResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "ops-manager" });

    const response = await request(app).get(
      `/missions/${missionId}/governance-assessment`,
    ).set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      organisationId,
      result: "warning",
      summary: {
        failCount: 0,
        warningCount: 1,
        passCount: 2,
      },
      operationalAuthority: {
        result: "warning",
      },
      insurance: {
        result: "pass",
      },
    });
    expect(response.body.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "operational_authority",
          code: "OA_DOCUMENT_RENEWAL_SOON",
          severity: "warning",
        }),
        expect.objectContaining({
          domain: "insurance",
          code: "INSURANCE_WITHIN_PROFILE",
          severity: "pass",
        }),
      ]),
    );
  });

  it("returns fail overall when either governance domain fails", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const expiredOaValidity = buildDateWindow(-365, -1);
    const insuranceValidity = buildDateWindow(-30, 365);
    const auth = await createUserAndSession("gov-fail@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const oaResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-GOV-002",
        issueDate: expiredOaValidity.issueDate,
        effectiveFrom: expiredOaValidity.effectiveFrom,
        expiresAt: expiredOaValidity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Permitted operations",
            clauseReference: "OA GOV 2.1",
            conditionPayload: {
              allowedOperationTypes: ["inspection"],
            },
          },
        ],
      });

    await request(app)
      .post(`/operational-authority-profiles/${oaResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "accountable-manager" });

    const insuranceResponse = await request(app)
      .post(`/organisations/${organisationId}/insurance-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        providerName: "Aviation Mutual",
        policyNumber: "POL-GOV-002",
        issueDate: insuranceValidity.issueDate,
        effectiveFrom: insuranceValidity.effectiveFrom,
        expiresAt: insuranceValidity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [
          {
            conditionCode: "ALLOWED_OPERATION_TYPE",
            conditionTitle: "Covered operations",
            clauseReference: "INS GOV 2.1",
            conditionPayload: {
              allowedOperationTypes: ["inspection"],
            },
          },
        ],
      });

    await request(app)
      .post(`/insurance-profiles/${insuranceResponse.body.profile.id}/activate`)
      .set("X-Session-Token", auth.sessionToken)
      .send({ activatedBy: "ops-manager" });

    const response = await request(app).get(
      `/missions/${missionId}/governance-assessment`,
    ).set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("fail");
    expect(response.body.summary.failCount).toBe(1);
    expect(response.body.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "operational_authority",
          code: "OA_DOCUMENT_EXPIRED",
          severity: "fail",
        }),
      ]),
    );
  });

  it("rejects governance assessment when the caller is outside the mission organisation", async () => {
    const organisationId = randomUUID();
    const missionId = await insertMission({ organisationId, operationType: "inspection" });
    const member = await createUserAndSession("gov-member@example.com");
    const outsider = await createUserAndSession("gov-outsider@example.com");
    await createMembership(organisationId, member.user.id, "viewer");

    const response = await request(app)
      .get(`/missions/${missionId}/governance-assessment`)
      .set("X-Session-Token", outsider.sessionToken);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: "organisation_membership_forbidden",
    });
  });
});
