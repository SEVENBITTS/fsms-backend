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
    displayName: "Dashboard User",
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
    name: "Dashboard UAV",
    status: overrides?.status ?? "active",
    totalFlightHours: overrides?.totalFlightHours ?? 10,
  });

  expect(response.status).toBe(201);
  return response.body.platform as { id: string };
};

const createPilot = async (overrides?: { status?: string }) => {
  const response = await request(app).post("/pilots").send({
    displayName: "Dashboard Pilot",
    status: overrides?.status ?? "active",
  });

  expect(response.status).toBe(201);
  return response.body.pilot as { id: string };
};

const createPilotEvidence = async (pilotId: string, expiresAt: string) => {
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
  operationType?: string;
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
      `dashboard-plan-${missionId.slice(0, 8)}`,
      params.organisationId,
      params.platformId,
      params.pilotId,
      params.operationType ?? "inspection",
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
          clauseReference: "OA AM 1.1",
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
          clauseReference: "INS AM 1.1",
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
  state: "authorised" | "pending_amendment" | "restricted";
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
      JSON.stringify(["inspection"]),
      false,
      params.requiresAccountableReview ?? false,
      params.state === "pending_amendment" ? "CAA-AMEND-001" : null,
      params.state === "pending_amendment" ? new Date().toISOString() : null,
      params.state === "authorised" ? new Date().toISOString() : null,
      "Dashboard test authorisation",
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
      "dashboard-plan",
      "override.applied",
      sequenceNo,
      "user",
      "ops-manager",
      "Override applied after review",
      JSON.stringify({ rationale: "dashboard pressure" }),
      "dashboard-test",
      "dashboard-test",
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

describe("accountable manager dashboard integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns an accountable-manager summary with risk heat, alerts, and mission hotspots", async () => {
    const organisationId = randomUUID();
    const auth = await createUserAndSession("accountable-dashboard@example.com");
    await createMembership(organisationId, auth.user.id, "accountable_manager");

    const healthyPlatform = await createPlatform();
    const healthyPilot = await createPilot();
    await createPilotEvidence(
      healthyPilot.id,
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    );
    const healthyMissionId = await insertMission({
      organisationId,
      platformId: healthyPlatform.id,
      pilotId: healthyPilot.id,
    });

    const pressuredPlatform = await createPlatform({ totalFlightHours: 50 });
    const pressuredPilot = await createPilot();
    await createPilotEvidence(
      pressuredPilot.id,
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    );
    await createMaintenanceSchedule(pressuredPlatform.id, {
      nextDueAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      nextDueFlightHours: 40,
    });
    const pressuredMissionId = await insertMission({
      organisationId,
      platformId: pressuredPlatform.id,
      pilotId: pressuredPilot.id,
    });

    const oaProfileId = await createOperationalAuthority(
      organisationId,
      buildDateWindow(-30, 10),
      auth.sessionToken,
    );
    await insertOperationalAuthorityPilotAuthorisation({
      profileId: oaProfileId,
      organisationId,
      pilotId: healthyPilot.id,
      state: "authorised",
    });
    await insertOperationalAuthorityPilotAuthorisation({
      profileId: oaProfileId,
      organisationId,
      pilotId: pressuredPilot.id,
      state: "pending_amendment",
      requiresAccountableReview: true,
    });

    await createInsurance(organisationId, buildDateWindow(-365, -1), auth.sessionToken);
    await insertReviewRequiredSnapshot(pressuredMissionId);
    await insertOverrideEvent(pressuredMissionId, 1);

    const response = await request(app)
      .get(`/organisations/${organisationId}/accountable-manager-dashboard`)
      .set("X-Session-Token", auth.sessionToken);

    expect(response.status).toBe(200);
    expect(response.body.organisationId).toBe(organisationId);
    expect(response.body.viewerRole).toBe("accountable_manager");
    expect(response.body.overall).toMatchObject({
      result: "fail",
      threatLevel: "immediate",
    });
    expect(response.body.summary).toMatchObject({
      totalMissions: 2,
      immediateAttentionMissions: 2,
      healthyMissions: 0,
      oaRenewalPressureCount: 2,
      insuranceRenewalPressureCount: 2,
      pilotPendingAmendmentCount: 1,
      maintenancePressureCount: 1,
      overridePressureCount: 1,
    });
    expect(response.body.stageMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "insurance",
          result: "fail",
        }),
        expect.objectContaining({
          stage: "personnel",
          result: "warning",
        }),
        expect.objectContaining({
          stage: "operational_authority",
          result: "warning",
        }),
      ]),
    );
    expect(response.body.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INSURANCE_EXPIRED",
          result: "fail",
        }),
        expect.objectContaining({
          code: "OA_RENEWAL_SOON",
          result: "warning",
        }),
        expect.objectContaining({
          code: "OA_PERSONNEL_PENDING_AMENDMENT",
          result: "warning",
        }),
      ]),
    );
    expect(response.body.missionHotspots[0]).toMatchObject({
      missionId: pressuredMissionId,
      result: "fail",
      targetPath: `/operator/missions/${pressuredMissionId}`,
    });
    expect(
      response.body.missions.some((mission: { missionId: string }) => mission.missionId === healthyMissionId),
    ).toBe(true);
  });

  it("rejects dashboard access for a user outside the organisation", async () => {
    const organisationId = randomUUID();
    const member = await createUserAndSession("dashboard-member@example.com");
    const outsider = await createUserAndSession("dashboard-outsider@example.com");
    await createMembership(organisationId, member.user.id, "accountable_manager");

    const response = await request(app)
      .get(`/organisations/${organisationId}/accountable-manager-dashboard`)
      .set("X-Session-Token", outsider.sessionToken);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: "organisation_membership_forbidden",
    });
  });
});
