import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from mission_decision_evidence_links");
  await pool.query("delete from audit_evidence_snapshots");
  await pool.query("delete from airspace_compliance_inputs");
  await pool.query("delete from mission_risk_inputs");
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
  await pool.query("delete from pilot_readiness_evidence");
  await pool.query("delete from pilots");
  await pool.query("delete from maintenance_records");
  await pool.query("delete from maintenance_schedules");
  await pool.query("delete from platforms");
};

const createPlatform = async () => {
  const response = await request(app).post("/platforms").send({
    name: "Audit UAV",
    status: "active",
  });

  expect(response.status).toBe(201);
  return response.body.platform as { id: string };
};

const createReadyPilot = async () => {
  const pilotResponse = await request(app).post("/pilots").send({
    displayName: "Audit Pilot",
    status: "active",
  });

  expect(pilotResponse.status).toBe(201);
  const pilot = pilotResponse.body.pilot as { id: string };

  const evidenceResponse = await request(app)
    .post(`/pilots/${pilot.id}/readiness-evidence`)
    .send({
      evidenceType: "operator_authorisation",
      title: "Current operator authorisation",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

  expect(evidenceResponse.status).toBe(201);
  return pilot;
};

const insertMission = async (params: {
  id?: string;
  platformId?: string | null;
  pilotId?: string | null;
}) => {
  const missionId = params.id ?? randomUUID();

  await pool.query(
    `
    insert into missions (
      id,
      status,
      mission_plan_id,
      platform_id,
      pilot_id,
      last_event_sequence_no
    )
    values ($1, $2, $3, $4, $5, $6)
    `,
    [
      missionId,
      "submitted",
      "plan-audit",
      params.platformId ?? null,
      params.pilotId ?? null,
      0,
    ],
  );

  return missionId;
};

const createLowRiskInput = async (missionId: string) => {
  const response = await request(app)
    .post(`/missions/${missionId}/risk-inputs`)
    .send({
      operatingCategory: "open",
      missionComplexity: "low",
      populationExposure: "low",
      airspaceComplexity: "low",
      weatherRisk: "low",
      payloadRisk: "low",
    });

  expect(response.status).toBe(201);
};

const createHighRiskInput = async (missionId: string) => {
  const response = await request(app)
    .post(`/missions/${missionId}/risk-inputs`)
    .send({
      operatingCategory: "certified",
      missionComplexity: "high",
      populationExposure: "high",
      airspaceComplexity: "high",
      weatherRisk: "high",
      payloadRisk: "high",
    });

  expect(response.status).toBe(201);
};

const createClearAirspaceInput = async (missionId: string) => {
  const response = await request(app)
    .post(`/missions/${missionId}/airspace-inputs`)
    .send({
      airspaceClass: "g",
      maxAltitudeFt: 300,
      restrictionStatus: "clear",
      permissionStatus: "not_required",
    });

  expect(response.status).toBe(201);
};

const createFailingAirspaceInput = async (missionId: string) => {
  const response = await request(app)
    .post(`/missions/${missionId}/airspace-inputs`)
    .send({
      airspaceClass: "d",
      maxAltitudeFt: 300,
      restrictionStatus: "prohibited",
      permissionStatus: "denied",
    });

  expect(response.status).toBe(201);
};

const createReadyMission = async () => {
  const platform = await createPlatform();
  const pilot = await createReadyPilot();
  const missionId = await insertMission({
    platformId: platform.id,
    pilotId: pilot.id,
  });

  await createLowRiskInput(missionId);
  await createClearAirspaceInput(missionId);

  return {
    missionId,
    platformId: platform.id,
    pilotId: pilot.id,
  };
};

const countRows = async (missionId: string) => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from audit_evidence_snapshots where mission_id = $1) as snapshot_count,
      (select count(*)::int from mission_decision_evidence_links where mission_id = $1) as decision_link_count,
      (select count(*)::int from mission_events where mission_id = $1) as mission_event_count,
      (select count(*)::int from mission_risk_inputs where mission_id = $1) as risk_input_count,
      (select count(*)::int from airspace_compliance_inputs where mission_id = $1) as airspace_input_count,
      (select last_event_sequence_no from missions where id = $1) as mission_sequence
    `,
    [missionId],
  );

  return result.rows[0] as {
    snapshot_count: number;
    decision_link_count: number;
    mission_event_count: number;
    risk_input_count: number;
    airspace_input_count: number;
    mission_sequence: number;
  };
};

describe("audit evidence snapshots", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("captures the current mission readiness gate as reviewable evidence", async () => {
    const { missionId, platformId, pilotId } = await createReadyMission();
    const before = await countRows(missionId);

    const response = await request(app)
      .post(`/missions/${missionId}/readiness/audit-snapshots`)
      .send({
        createdBy: " safety-manager ",
      });

    expect(response.status).toBe(201);
    expect(response.body.snapshot).toMatchObject({
      missionId,
      evidenceType: "mission_readiness_gate",
      readinessResult: "pass",
      gateResult: "pass",
      blocksApproval: false,
      blocksDispatch: false,
      requiresReview: false,
      createdBy: "safety-manager",
      readinessSnapshot: {
        missionId,
        platformId,
        pilotId,
        result: "pass",
        gate: {
          result: "pass",
          blocksApproval: false,
          blocksDispatch: false,
          requiresReview: false,
        },
        reasons: [
          { code: "MISSION_PLATFORM_READY", source: "platform" },
          { code: "MISSION_PILOT_READY", source: "pilot" },
          { code: "MISSION_RISK_READY", source: "risk" },
        ],
        missionRisk: {
          result: "pass",
          riskBand: "low",
        },
        airspaceCompliance: {
          result: "pass",
        },
      },
    });
    expect(response.body.snapshot.id).toEqual(expect.any(String));
    expect(response.body.snapshot.createdAt).toEqual(expect.any(String));

    expect(await countRows(missionId)).toEqual({
      ...before,
      snapshot_count: before.snapshot_count + 1,
    });
  });

  it("keeps snapshots immutable when later source inputs change", async () => {
    const { missionId } = await createReadyMission();

    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/readiness/audit-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);
    const snapshotId = snapshotResponse.body.snapshot.id;

    await createHighRiskInput(missionId);
    await createFailingAirspaceInput(missionId);

    const liveReadinessResponse = await request(app).get(
      `/missions/${missionId}/readiness`,
    );
    expect(liveReadinessResponse.status).toBe(200);
    expect(liveReadinessResponse.body.result).toBe("fail");
    expect(liveReadinessResponse.body.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSION_RISK_FAILED" }),
        expect.objectContaining({ code: "MISSION_AIRSPACE_FAILED" }),
      ]),
    );

    const listResponse = await request(app).get(
      `/missions/${missionId}/readiness/audit-snapshots`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.snapshots).toHaveLength(1);
    expect(listResponse.body.snapshots[0]).toMatchObject({
      id: snapshotId,
      readinessResult: "pass",
      gateResult: "pass",
      readinessSnapshot: {
        result: "pass",
        missionRisk: {
          result: "pass",
          riskBand: "low",
        },
        airspaceCompliance: {
          result: "pass",
        },
      },
    });
  });

  it("lists snapshots only for the requested mission", async () => {
    const first = await createReadyMission();
    const second = await createReadyMission();

    const firstSnapshot = await request(app)
      .post(`/missions/${first.missionId}/readiness/audit-snapshots`)
      .send({ createdBy: "reviewer-a" });
    const secondSnapshot = await request(app)
      .post(`/missions/${second.missionId}/readiness/audit-snapshots`)
      .send({ createdBy: "reviewer-b" });

    expect(firstSnapshot.status).toBe(201);
    expect(secondSnapshot.status).toBe(201);

    const response = await request(app).get(
      `/missions/${first.missionId}/readiness/audit-snapshots`,
    );

    expect(response.status).toBe(200);
    expect(response.body.snapshots).toHaveLength(1);
    expect(response.body.snapshots[0]).toMatchObject({
      missionId: first.missionId,
      createdBy: "reviewer-a",
    });
  });

  it("does not mutate source inputs, mission state, or events when snapshotting", async () => {
    const { missionId } = await createReadyMission();
    const before = await countRows(missionId);

    const response = await request(app)
      .post(`/missions/${missionId}/readiness/audit-snapshots`)
      .send({});

    expect(response.status).toBe(201);
    expect(await countRows(missionId)).toEqual({
      ...before,
      snapshot_count: before.snapshot_count + 1,
    });
  });

  it("rejects invalid snapshot metadata", async () => {
    const { missionId } = await createReadyMission();

    const response = await request(app)
      .post(`/missions/${missionId}/readiness/audit-snapshots`)
      .send({
        createdBy: 42,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        type: "audit_evidence_validation_failed",
      },
    });
  });

  it("returns 404 for unknown missions", async () => {
    const missingMissionId = randomUUID();

    const createResponse = await request(app)
      .post(`/missions/${missingMissionId}/readiness/audit-snapshots`)
      .send({});
    const listResponse = await request(app).get(
      `/missions/${missingMissionId}/readiness/audit-snapshots`,
    );

    expect(createResponse.status).toBe(404);
    expect(listResponse.status).toBe(404);
  });

  it("links approval and dispatch decisions to readiness snapshots", async () => {
    const { missionId } = await createReadyMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/readiness/audit-snapshots`)
      .send({ createdBy: "reviewer-a" });

    expect(snapshotResponse.status).toBe(201);
    const snapshotId = snapshotResponse.body.snapshot.id;
    const before = await countRows(missionId);

    const approvalResponse = await request(app)
      .post(`/missions/${missionId}/decision-evidence-links`)
      .send({
        snapshotId,
        decisionType: "approval",
        createdBy: " approver ",
      });
    const dispatchResponse = await request(app)
      .post(`/missions/${missionId}/decision-evidence-links`)
      .send({
        snapshotId,
        decisionType: "dispatch",
      });

    expect(approvalResponse.status).toBe(201);
    expect(approvalResponse.body.link).toMatchObject({
      missionId,
      auditEvidenceSnapshotId: snapshotId,
      decisionType: "approval",
      createdBy: "approver",
    });
    expect(dispatchResponse.status).toBe(201);
    expect(dispatchResponse.body.link).toMatchObject({
      missionId,
      auditEvidenceSnapshotId: snapshotId,
      decisionType: "dispatch",
      createdBy: null,
    });
    expect(await countRows(missionId)).toEqual({
      ...before,
      decision_link_count: before.decision_link_count + 2,
    });
  });

  it("lists decision evidence links only for the requested mission", async () => {
    const first = await createReadyMission();
    const second = await createReadyMission();
    const firstSnapshot = await request(app)
      .post(`/missions/${first.missionId}/readiness/audit-snapshots`)
      .send({});
    const secondSnapshot = await request(app)
      .post(`/missions/${second.missionId}/readiness/audit-snapshots`)
      .send({});

    expect(firstSnapshot.status).toBe(201);
    expect(secondSnapshot.status).toBe(201);

    const firstLink = await request(app)
      .post(`/missions/${first.missionId}/decision-evidence-links`)
      .send({
        snapshotId: firstSnapshot.body.snapshot.id,
        decisionType: "approval",
        createdBy: "reviewer-a",
      });
    const secondLink = await request(app)
      .post(`/missions/${second.missionId}/decision-evidence-links`)
      .send({
        snapshotId: secondSnapshot.body.snapshot.id,
        decisionType: "dispatch",
        createdBy: "reviewer-b",
      });

    expect(firstLink.status).toBe(201);
    expect(secondLink.status).toBe(201);

    const response = await request(app).get(
      `/missions/${first.missionId}/decision-evidence-links`,
    );

    expect(response.status).toBe(200);
    expect(response.body.links).toHaveLength(1);
    expect(response.body.links[0]).toMatchObject({
      missionId: first.missionId,
      auditEvidenceSnapshotId: firstSnapshot.body.snapshot.id,
      decisionType: "approval",
      createdBy: "reviewer-a",
    });
  });

  it("rejects snapshots from another mission", async () => {
    const first = await createReadyMission();
    const second = await createReadyMission();
    const secondSnapshot = await request(app)
      .post(`/missions/${second.missionId}/readiness/audit-snapshots`)
      .send({});

    expect(secondSnapshot.status).toBe(201);

    const response = await request(app)
      .post(`/missions/${first.missionId}/decision-evidence-links`)
      .send({
        snapshotId: secondSnapshot.body.snapshot.id,
        decisionType: "approval",
      });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "audit_evidence_snapshot_not_found",
      },
    });
  });

  it("rejects invalid decision evidence link requests", async () => {
    const { missionId } = await createReadyMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/readiness/audit-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);

    const missingSnapshotResponse = await request(app)
      .post(`/missions/${missionId}/decision-evidence-links`)
      .send({
        decisionType: "approval",
      });
    const invalidDecisionResponse = await request(app)
      .post(`/missions/${missionId}/decision-evidence-links`)
      .send({
        snapshotId: snapshotResponse.body.snapshot.id,
        decisionType: "release",
      });

    expect(missingSnapshotResponse.status).toBe(400);
    expect(invalidDecisionResponse.status).toBe(400);
  });

  it("does not mutate referenced snapshots when decision links are created", async () => {
    const { missionId } = await createReadyMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/readiness/audit-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);
    const beforeSnapshot = snapshotResponse.body.snapshot;

    const linkResponse = await request(app)
      .post(`/missions/${missionId}/decision-evidence-links`)
      .send({
        snapshotId: beforeSnapshot.id,
        decisionType: "approval",
      });

    expect(linkResponse.status).toBe(201);

    const listResponse = await request(app).get(
      `/missions/${missionId}/readiness/audit-snapshots`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.snapshots[0]).toEqual(beforeSnapshot);
  });
});
