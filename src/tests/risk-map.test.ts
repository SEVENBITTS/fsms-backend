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
  await pool.query("delete from audit_evidence_snapshots");
  await pool.query("delete from operational_authority_conditions");
  await pool.query("delete from operational_authority_profiles");
  await pool.query("delete from operational_authority_documents");
  await pool.query("delete from insurance_conditions");
  await pool.query("delete from insurance_profiles");
  await pool.query("delete from insurance_documents");
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
  await pool.query("delete from pilot_readiness_evidence");
  await pool.query("delete from pilots");
  await pool.query("delete from maintenance_records");
  await pool.query("delete from maintenance_schedules");
  await pool.query("delete from platforms");
};

const createUserAndSession = async (email: string) => {
  const createUserResponse = await request(app).post("/users").send({
    email,
    displayName: "Risk Map User",
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

const createPlatform = async (overrides?: {
  status?: string;
  totalFlightHours?: number;
}) => {
  const response = await request(app).post("/platforms").send({
    name: "Risk Map UAV",
    status: overrides?.status ?? "active",
    totalFlightHours: overrides?.totalFlightHours ?? 10,
  });

  expect(response.status).toBe(201);
  return response.body.platform as { id: string };
};

const createPilot = async (overrides?: { status?: string }) => {
  const response = await request(app).post("/pilots").send({
    displayName: "Risk Map Pilot",
    status: overrides?.status ?? "active",
  });

  expect(response.status).toBe(201);
  return response.body.pilot as { id: string };
};

const createPilotEvidence = async (
  pilotId: string,
  expiresAt: string,
) => {
  const response = await request(app)
    .post(`/pilots/${pilotId}/readiness-evidence`)
    .send({
      evidenceType: "operator_authorisation",
      title: "Pilot authorisation",
      expiresAt,
    });

  expect(response.status).toBe(201);
};

const createMaintenanceSchedule = async (
  platformId: string,
  params: { nextDueAt: string; nextDueFlightHours: number },
) => {
  const response = await request(app)
    .post(`/platforms/${platformId}/maintenance-schedules`)
    .send({
      taskName: "Scheduled inspection",
      intervalDays: 30,
      intervalFlightHours: 25,
      nextDueAt: params.nextDueAt,
      nextDueFlightHours: params.nextDueFlightHours,
    });

  expect(response.status).toBe(201);
};

const insertMission = async (params: {
  organisationId: string;
  platformId: string;
  pilotId: string;
}) => {
  const missionId = randomUUID();
  await pool.query(
    `
    insert into missions (
      id,
      status,
      mission_plan_id,
      organisation_id,
      platform_id,
      pilot_id,
      operation_type,
      requires_bvlos,
      last_event_sequence_no
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      missionId,
      "submitted",
      "risk-map-plan",
      params.organisationId,
      params.platformId,
      params.pilotId,
      "inspection",
      false,
      0,
    ],
  );

  return missionId;
};

const createOperationalAuthority = async (
  organisationId: string,
  validity: ReturnType<typeof buildDateWindow>,
  sessionToken: string,
) => {
  const createResponse = await request(app)
    .post(`/organisations/${organisationId}/operational-authority-documents`)
    .set("X-Session-Token", sessionToken)
    .send({
      authorityName: "CAA",
      referenceNumber: `OA-${randomUUID()}`,
      issueDate: validity.issueDate,
      effectiveFrom: validity.effectiveFrom,
      expiresAt: validity.expiresAt,
      uploadedBy: "compliance-lead",
      conditions: [
        {
          conditionCode: "ALLOWED_OPERATION_TYPE",
          conditionTitle: "Permitted operations",
          clauseReference: "OA RM 1.1",
          conditionPayload: {
            allowedOperationTypes: ["inspection"],
          },
        },
      ],
    });

  expect(createResponse.status).toBe(201);

  const activateResponse = await request(app)
    .post(`/operational-authority-profiles/${createResponse.body.profile.id}/activate`)
    .set("X-Session-Token", sessionToken)
    .send({ activatedBy: "accountable-manager" });

  expect(activateResponse.status).toBe(200);
  return createResponse.body.profile.id as string;
};

const createInsurance = async (
  organisationId: string,
  validity: ReturnType<typeof buildDateWindow>,
  sessionToken: string,
) => {
  const createResponse = await request(app)
    .post(`/organisations/${organisationId}/insurance-documents`)
    .set("X-Session-Token", sessionToken)
    .send({
      providerName: "Aviation Mutual",
      policyNumber: `POL-${randomUUID()}`,
      issueDate: validity.issueDate,
      effectiveFrom: validity.effectiveFrom,
      expiresAt: validity.expiresAt,
      uploadedBy: "ops-manager",
      conditions: [
        {
          conditionCode: "ALLOWED_OPERATION_TYPE",
          conditionTitle: "Covered operations",
          clauseReference: "INS RM 1.1",
          conditionPayload: {
            allowedOperationTypes: ["inspection"],
          },
        },
      ],
    });

  expect(createResponse.status).toBe(201);

  const activateResponse = await request(app)
    .post(`/insurance-profiles/${createResponse.body.profile.id}/activate`)
    .set("X-Session-Token", sessionToken)
    .send({ activatedBy: "ops-manager" });

  expect(activateResponse.status).toBe(200);
};

const insertOperationalAuthorityPilotAuthorisation = async (params: {
  profileId: string;
  organisationId: string;
  pilotId: string;
  state: "authorised" | "pending_amendment";
  allowedOperationTypes?: string[];
  bvlosAuthorised?: boolean;
  requiresAccountableReview?: boolean;
}) => {
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
    values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
    `,
    [
      randomUUID(),
      params.profileId,
      params.organisationId,
      params.pilotId,
      params.state,
      JSON.stringify(params.allowedOperationTypes ?? ["inspection"]),
      params.bvlosAuthorised ?? false,
      params.requiresAccountableReview ?? false,
      params.state === "pending_amendment" ? "CAA-AMEND-001" : null,
      params.state === "pending_amendment" ? new Date().toISOString() : null,
      params.state === "authorised" ? new Date().toISOString() : null,
      "Risk map test authorisation",
    ],
  );
};

const insertOverrideEvent = async (missionId: string, sequenceNo: number) => {
  await pool.query(
    `
    insert into mission_events (
      mission_id,
      mission_plan_id,
      event_type,
      event_ts,
      sequence_no,
      actor_type,
      actor_id,
      summary,
      details,
      source_component,
      source,
      severity,
      safety_relevant,
      compliance_relevant
    )
    values ($1, $2, $3, now(), $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)
    `,
    [
      missionId,
      "risk-map-plan",
      "override.applied",
      sequenceNo,
      "user",
      "ops-manager",
      "Override applied after review",
      JSON.stringify({ rationale: "mission pressure" }),
      "risk-map-test",
      "risk-map-test",
      "critical",
      true,
      true,
    ],
  );
};

const insertReviewRequiredSnapshot = async (missionId: string) => {
  await pool.query(
    `
    insert into audit_evidence_snapshots (
      id,
      mission_id,
      evidence_type,
      readiness_result,
      gate_result,
      blocks_approval,
      blocks_dispatch,
      requires_review,
      readiness_snapshot,
      created_by
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
    `,
    [
      randomUUID(),
      missionId,
      "mission_readiness_gate",
      "warning",
      "warning",
      false,
      false,
      true,
      JSON.stringify({
        missionId,
        result: "warning",
        gate: {
          result: "warning",
          blocksApproval: false,
          blocksDispatch: false,
          requiresReview: true,
        },
      }),
      "ops-manager",
    ],
  );
};

describe("risk map integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns a stable risk map when governance, competency, and maintenance are healthy", async () => {
    const organisationId = randomUUID();
    const auth = await createUserAndSession("risk-pass@example.com");
    await createMembership(organisationId, auth.user.id, "admin");
    const platform = await createPlatform();
    const pilot = await createPilot();
    await createPilotEvidence(
      pilot.id,
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    );
    const missionId = await insertMission({
      organisationId,
      platformId: platform.id,
      pilotId: pilot.id,
    });
    const oaProfileId = await createOperationalAuthority(
      organisationId,
      buildDateWindow(-30, 365),
      auth.sessionToken,
    );
    await insertOperationalAuthorityPilotAuthorisation({
      profileId: oaProfileId,
      organisationId,
      pilotId: pilot.id,
      state: "authorised",
    });
    await createInsurance(organisationId, buildDateWindow(-30, 365), auth.sessionToken);

    const response = await request(app)
      .get(`/missions/${missionId}/risk-map`)
      .set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.overall).toMatchObject({
      result: "pass",
      threatLevel: "stable",
      score: 0,
    });
    expect(response.body.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "oa_renewal",
          result: "pass",
        }),
        expect.objectContaining({
          code: "insurance_renewal",
          result: "pass",
        }),
        expect.objectContaining({
          code: "pilot_competency",
          result: "pass",
        }),
        expect.objectContaining({
          code: "platform_maintenance",
          result: "pass",
        }),
        expect.objectContaining({
          code: "override_pressure",
          result: "pass",
        }),
      ]),
    );
  });

  it("surfaces early-warning and immediate threats across the combined risk map", async () => {
    const organisationId = randomUUID();
    const auth = await createUserAndSession("risk-fail@example.com");
    await createMembership(organisationId, auth.user.id, "admin");
    const platform = await createPlatform({ totalFlightHours: 50 });
    const pilot = await createPilot();
    await createPilotEvidence(
      pilot.id,
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    );
    await createMaintenanceSchedule(platform.id, {
      nextDueAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      nextDueFlightHours: 40,
    });
    const missionId = await insertMission({
      organisationId,
      platformId: platform.id,
      pilotId: pilot.id,
    });
    const oaProfileId = await createOperationalAuthority(
      organisationId,
      buildDateWindow(-30, 10),
      auth.sessionToken,
    );
    await insertOperationalAuthorityPilotAuthorisation({
      profileId: oaProfileId,
      organisationId,
      pilotId: pilot.id,
      state: "pending_amendment",
      requiresAccountableReview: true,
    });
    await createInsurance(organisationId, buildDateWindow(-365, -1), auth.sessionToken);
    await insertReviewRequiredSnapshot(missionId);
    await insertOverrideEvent(missionId, 1);
    await insertOverrideEvent(missionId, 2);

    const response = await request(app)
      .get(`/missions/${missionId}/risk-map`)
      .set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.overall.result).toBe("fail");
    expect(response.body.overall.threatLevel).toBe("immediate");
    expect(response.body.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "oa_renewal",
          result: "warning",
          threatLevel: "emerging",
        }),
        expect.objectContaining({
          code: "insurance_renewal",
          result: "fail",
          threatLevel: "immediate",
        }),
        expect.objectContaining({
          code: "pilot_competency",
          result: "fail",
          threatLevel: "immediate",
        }),
        expect.objectContaining({
          code: "platform_maintenance",
          result: "warning",
          threatLevel: "emerging",
        }),
        expect.objectContaining({
          code: "override_pressure",
          result: "fail",
          threatLevel: "immediate",
        }),
      ]),
    );
    expect(response.body.overridePressure).toMatchObject({
      overrideEventCount: 2,
      reviewRequiredSnapshotCount: 1,
      latestSnapshotRequiresReview: true,
    });
  });

  it("rejects risk-map access when the caller is outside the mission organisation", async () => {
    const organisationId = randomUUID();
    const member = await createUserAndSession("risk-member@example.com");
    const outsider = await createUserAndSession("risk-outsider@example.com");
    await createMembership(organisationId, member.user.id, "viewer");
    const platform = await createPlatform();
    const pilot = await createPilot();
    const missionId = await insertMission({
      organisationId,
      platformId: platform.id,
      pilotId: pilot.id,
    });

    const response = await request(app)
      .get(`/missions/${missionId}/risk-map`)
      .set("X-Session-Token", outsider.sessionToken);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: "organisation_membership_forbidden",
    });
  });
});
