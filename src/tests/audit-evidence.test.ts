import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const parseBinaryResponse = (res: NodeJS.ReadableStream, callback: (error: Error | null, body?: Buffer) => void) => {
  const chunks: Buffer[] = [];

  res.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
  res.on("error", (error: Error) => callback(error));
};

const clearTables = async () => {
  await pool.query("delete from post_operation_audit_signoffs");
  await pool.query("delete from post_operation_evidence_snapshots");
  await pool.query("delete from mission_planning_approval_handoffs");
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

const createDecisionEvidenceLink = async (
  missionId: string,
  decisionType: "approval" | "dispatch",
) => {
  const snapshotResponse = await request(app)
    .post(`/missions/${missionId}/readiness/audit-snapshots`)
    .send({ createdBy: "evidence-reviewer" });

  expect(snapshotResponse.status).toBe(201);

  const linkResponse = await request(app)
    .post(`/missions/${missionId}/decision-evidence-links`)
    .send({
      snapshotId: snapshotResponse.body.snapshot.id,
      decisionType,
      createdBy: "evidence-reviewer",
    });

  expect(linkResponse.status).toBe(201);

  return linkResponse.body.link as {
    id: string;
    auditEvidenceSnapshotId: string;
    decisionType: "approval" | "dispatch";
  };
};

const createPlanningApprovalHandoffTrace = async (
  missionId: string,
  link: { id: string; auditEvidenceSnapshotId: string },
) => {
  await pool.query(
    `
    insert into mission_planning_approval_handoffs (
      id,
      mission_id,
      audit_evidence_snapshot_id,
      mission_decision_evidence_link_id,
      planning_review,
      created_by
    )
    values ($1, $2, $3, $4, $5::jsonb, $6)
    `,
    [
      randomUUID(),
      missionId,
      link.auditEvidenceSnapshotId,
      link.id,
      JSON.stringify({
        missionId,
        readyForApproval: true,
        blockingReasons: [],
        checklist: [
          {
            code: "MISSION_READY_FOR_APPROVAL",
            passed: true,
          },
        ],
      }),
      "planning-lead",
    ],
  );
};

const createCompletedMission = async () => {
  const { missionId } = await createReadyMission();
  const approvalLink = await createDecisionEvidenceLink(missionId, "approval");
  await createPlanningApprovalHandoffTrace(missionId, approvalLink);

  const approveResponse = await request(app)
    .post(`/missions/${missionId}/approve`)
    .send({
      reviewerId: "approver-1",
      decisionEvidenceLinkId: approvalLink.id,
      notes: "post-operation evidence test approval",
    });
  expect(approveResponse.status).toBe(204);

  const dispatchLink = await createDecisionEvidenceLink(missionId, "dispatch");
  const launchResponse = await request(app)
    .post(`/missions/${missionId}/launch`)
    .send({
      operatorId: "operator-1",
      vehicleId: "uav-1",
      lat: 51.5074,
      lng: -0.1278,
      decisionEvidenceLinkId: dispatchLink.id,
    });
  expect(launchResponse.status).toBe(204);

  const completeResponse = await request(app)
    .post(`/missions/${missionId}/complete`)
    .send({
      operatorId: "operator-1",
    });
  expect(completeResponse.status).toBe(204);

  return {
    missionId,
    approvalLink,
    dispatchLink,
  };
};

const countRows = async (missionId: string) => {
  const result = await pool.query(
    `
    select
      (select status from missions where id = $1) as mission_status,
      (select count(*)::int from audit_evidence_snapshots where mission_id = $1) as snapshot_count,
      (select count(*)::int from post_operation_evidence_snapshots where mission_id = $1) as post_operation_snapshot_count,
      (select count(*)::int from post_operation_audit_signoffs where mission_id = $1) as post_operation_signoff_count,
      (select count(*)::int from mission_decision_evidence_links where mission_id = $1) as decision_link_count,
      (select count(*)::int from mission_events where mission_id = $1) as mission_event_count,
      (select count(*)::int from mission_risk_inputs where mission_id = $1) as risk_input_count,
      (select count(*)::int from airspace_compliance_inputs where mission_id = $1) as airspace_input_count,
      (select last_event_sequence_no from missions where id = $1) as mission_sequence
    `,
    [missionId],
  );

  return result.rows[0] as {
    mission_status: string;
    snapshot_count: number;
    post_operation_snapshot_count: number;
    post_operation_signoff_count: number;
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

  it("captures post-operation completion evidence without mutating the mission", async () => {
    const { missionId, approvalLink, dispatchLink } =
      await createCompletedMission();
    const before = await countRows(missionId);

    const response = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({
        createdBy: " accountable-manager ",
      });

    expect(response.status).toBe(201);
    expect(response.body.snapshot).toMatchObject({
      missionId,
      evidenceType: "post_operation_completion",
      lifecycleState: "completed",
      createdBy: "accountable-manager",
      completionSnapshot: {
        missionId,
        status: "completed",
        approvalEvent: {
          type: "mission.approved",
          details: {
            decision_evidence_link_id: approvalLink.id,
          },
        },
        launchEvent: {
          type: "mission.launched",
          details: {
            decision_evidence_link_id: dispatchLink.id,
            vehicle_id: "uav-1",
          },
        },
        completionEvent: {
          type: "mission.completed",
          toState: "completed",
        },
        approvalEvidenceLink: {
          id: approvalLink.id,
          decisionType: "approval",
        },
        dispatchEvidenceLink: {
          id: dispatchLink.id,
          decisionType: "dispatch",
        },
        planningApprovalHandoff: {
          missionDecisionEvidenceLinkId: approvalLink.id,
          planningReview: {
            readyForApproval: true,
          },
        },
      },
    });
    expect(response.body.snapshot.id).toEqual(expect.any(String));
    expect(response.body.snapshot.createdAt).toEqual(expect.any(String));
    expect(response.body.snapshot.completionSnapshot.capturedAt).toEqual(
      expect.any(String),
    );

    expect(await countRows(missionId)).toEqual({
      ...before,
      post_operation_snapshot_count:
        before.post_operation_snapshot_count + 1,
    });
  });

  it("keeps post-operation snapshots immutable when source events are later queried again", async () => {
    const { missionId, approvalLink, dispatchLink } =
      await createCompletedMission();

    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);

    const listResponse = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.snapshots).toHaveLength(1);
    expect(listResponse.body.snapshots[0]).toEqual(snapshotResponse.body.snapshot);
    expect(listResponse.body.snapshots[0].completionSnapshot).toMatchObject({
      approvalEvidenceLink: {
        id: approvalLink.id,
      },
      dispatchEvidenceLink: {
        id: dispatchLink.id,
      },
      completionEvent: {
        type: "mission.completed",
      },
    });
  });

  it("lists post-operation snapshots only for the requested mission", async () => {
    const first = await createCompletedMission();
    const second = await createCompletedMission();

    const firstSnapshot = await request(app)
      .post(`/missions/${first.missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "reviewer-a" });
    const secondSnapshot = await request(app)
      .post(`/missions/${second.missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "reviewer-b" });

    expect(firstSnapshot.status).toBe(201);
    expect(secondSnapshot.status).toBe(201);

    const response = await request(app).get(
      `/missions/${first.missionId}/post-operation/evidence-snapshots`,
    );

    expect(response.status).toBe(200);
    expect(response.body.snapshots).toHaveLength(1);
    expect(response.body.snapshots[0]).toMatchObject({
      missionId: first.missionId,
      createdBy: "reviewer-a",
    });
  });

  it("rejects post-operation evidence before mission completion", async () => {
    const { missionId } = await createReadyMission();
    const before = await countRows(missionId);

    const response = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: {
        type: "mission_not_completed",
      },
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("rejects invalid post-operation snapshot metadata", async () => {
    const { missionId } = await createCompletedMission();

    const response = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
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

  it("exports a post-operation evidence package without mutating audit state", async () => {
    const { missionId, approvalLink, dispatchLink } =
      await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export).toMatchObject({
      exportType: "post_operation_completion_evidence",
      formatVersion: 1,
      missionId,
      snapshotId: snapshotResponse.body.snapshot.id,
      evidenceType: "post_operation_completion",
      lifecycleState: "completed",
      createdBy: "accountable-manager",
      createdAt: snapshotResponse.body.snapshot.createdAt,
      completionSnapshot: {
        missionId,
        status: "completed",
        approvalEvent: {
          details: {
            decision_evidence_link_id: approvalLink.id,
          },
        },
        launchEvent: {
          details: {
            decision_evidence_link_id: dispatchLink.id,
          },
        },
        completionEvent: {
          type: "mission.completed",
        },
        approvalEvidenceLink: {
          id: approvalLink.id,
        },
        dispatchEvidenceLink: {
          id: dispatchLink.id,
        },
        planningApprovalHandoff: {
          missionDecisionEvidenceLinkId: approvalLink.id,
        },
      },
    });
    expect(response.body.export.generatedAt).toEqual(expect.any(String));
    expect(response.body.export.completionSnapshot).toEqual(
      snapshotResponse.body.snapshot.completionSnapshot,
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("does not export post-operation snapshots from another mission", async () => {
    const first = await createCompletedMission();
    const second = await createCompletedMission();
    const secondSnapshot = await request(app)
      .post(`/missions/${second.missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(secondSnapshot.status).toBe(201);
    const firstBefore = await countRows(first.missionId);
    const secondBefore = await countRows(second.missionId);

    const response = await request(app).get(
      `/missions/${first.missionId}/post-operation/evidence-snapshots/${secondSnapshot.body.snapshot.id}/export`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "post_operation_evidence_snapshot_not_found",
      },
    });
    expect(await countRows(first.missionId)).toEqual(firstBefore);
    expect(await countRows(second.missionId)).toEqual(secondBefore);
  });

  it("returns 404 for unknown post-operation export missions and snapshots", async () => {
    const { missionId } = await createCompletedMission();
    const before = await countRows(missionId);

    const missingSnapshotResponse = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${randomUUID()}/export`,
    );
    const missingMissionResponse = await request(app).get(
      `/missions/${randomUUID()}/post-operation/evidence-snapshots/${randomUUID()}/export`,
    );

    expect(missingSnapshotResponse.status).toBe(404);
    expect(missingSnapshotResponse.body).toMatchObject({
      error: {
        type: "post_operation_evidence_snapshot_not_found",
      },
    });
    expect(missingMissionResponse.status).toBe(404);
    expect(missingMissionResponse.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("renders a regulator-ready post-operation report without mutating audit state", async () => {
    const { missionId, approvalLink, dispatchLink } =
      await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report).toMatchObject({
      renderType: "post_operation_completion_evidence_report",
      formatVersion: 1,
      sourceExport: {
        exportType: "post_operation_completion_evidence",
        missionId,
        snapshotId: snapshotResponse.body.snapshot.id,
        completionSnapshot: snapshotResponse.body.snapshot.completionSnapshot,
      },
      report: {
        title: `Post-operation completion evidence for mission ${missionId}`,
        sections: [
          {
            heading: "Evidence package",
            fields: expect.arrayContaining([
              { label: "Mission ID", value: missionId },
              {
                label: "Snapshot ID",
                value: snapshotResponse.body.snapshot.id,
              },
              { label: "Lifecycle state", value: "completed" },
            ]),
          },
          {
            heading: "Mission completion",
            fields: expect.arrayContaining([
              { label: "Completion status", value: "completed" },
              { label: "Completion event summary", value: "Mission completed" },
            ]),
          },
          {
            heading: "Approval evidence",
            fields: expect.arrayContaining([
              { label: "Approval evidence link ID", value: approvalLink.id },
              { label: "Planning handoff ready", value: true },
            ]),
          },
          {
            heading: "Dispatch and launch evidence",
            fields: expect.arrayContaining([
              { label: "Dispatch evidence link ID", value: dispatchLink.id },
              { label: "Vehicle ID", value: "uav-1" },
              { label: "Launch site", value: "51.5074, -0.1278" },
            ]),
          },
          {
            heading: "Accountable manager sign-off",
            fields: [
              {
                label: "Accountable manager name",
                value: "Pending sign-off",
              },
              { label: "Role/title", value: "Pending sign-off" },
              { label: "Signature", value: "Pending sign-off" },
              { label: "Signed date/time", value: "Pending sign-off" },
              {
                label: "Review decision/status",
                value: "Pending sign-off",
              },
            ],
          },
        ],
      },
    });
    expect(response.body.report.generatedAt).toEqual(expect.any(String));
    expect(response.body.report.report.plainText).toContain(
      `Mission ID: ${missionId}`,
    );
    expect(response.body.report.report.plainText).toContain(
      `Dispatch evidence link ID: ${dispatchLink.id}`,
    );
    expect(response.body.report.report.plainText).toContain(
      "Accountable manager sign-off",
    );
    expect(response.body.report.report.plainText).toContain(
      "Review decision/status: Pending sign-off",
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("does not render post-operation reports for snapshots from another mission", async () => {
    const first = await createCompletedMission();
    const second = await createCompletedMission();
    const secondSnapshot = await request(app)
      .post(`/missions/${second.missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(secondSnapshot.status).toBe(201);
    const firstBefore = await countRows(first.missionId);
    const secondBefore = await countRows(second.missionId);

    const response = await request(app).get(
      `/missions/${first.missionId}/post-operation/evidence-snapshots/${secondSnapshot.body.snapshot.id}/export/render`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "post_operation_evidence_snapshot_not_found",
      },
    });
    expect(await countRows(first.missionId)).toEqual(firstBefore);
    expect(await countRows(second.missionId)).toEqual(secondBefore);
  });

  it("returns 404 for unknown post-operation report missions and snapshots", async () => {
    const { missionId } = await createCompletedMission();
    const before = await countRows(missionId);

    const missingSnapshotResponse = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${randomUUID()}/export/render`,
    );
    const missingMissionResponse = await request(app).get(
      `/missions/${randomUUID()}/post-operation/evidence-snapshots/${randomUUID()}/export/render`,
    );

    expect(missingSnapshotResponse.status).toBe(404);
    expect(missingSnapshotResponse.body).toMatchObject({
      error: {
        type: "post_operation_evidence_snapshot_not_found",
      },
    });
    expect(missingMissionResponse.status).toBe(404);
    expect(missingMissionResponse.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("generates a post-operation audit PDF download without mutating audit state", async () => {
    const { missionId, dispatchLink } = await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app)
      .get(
        `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render/pdf`,
      )
      .buffer(true)
      .parse(parseBinaryResponse);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-disposition"]).toContain(
      `mission-${missionId}-post-operation-evidence-${snapshotResponse.body.snapshot.id}.pdf`,
    );
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.toString("latin1", 0, 8)).toBe("%PDF-1.4");
    expect(response.body.toString("latin1")).toContain(
      `Post-operation completion evidence for mission ${missionId}`,
    );
    expect(response.body.toString("latin1")).toContain(
      `Dispatch evidence link ID: ${dispatchLink.id}`,
    );
    expect(response.body.toString("latin1")).toContain(
      "Accountable manager sign-off",
    );
    expect(response.body.toString("latin1")).toContain(
      "Accountable manager name: Pending sign-off",
    );
    expect(response.body.toString("latin1")).toContain(
      "Signature: Pending sign-off",
    );
    expect(response.body.toString("latin1")).toContain(
      "Signed date/time: Pending sign-off",
    );
    expect(response.body.toString("latin1")).toContain(
      "Review decision/status: Pending sign-off",
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("does not generate PDFs for post-operation snapshots from another mission", async () => {
    const first = await createCompletedMission();
    const second = await createCompletedMission();
    const secondSnapshot = await request(app)
      .post(`/missions/${second.missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(secondSnapshot.status).toBe(201);
    const firstBefore = await countRows(first.missionId);
    const secondBefore = await countRows(second.missionId);

    const response = await request(app).get(
      `/missions/${first.missionId}/post-operation/evidence-snapshots/${secondSnapshot.body.snapshot.id}/export/render/pdf`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "post_operation_evidence_snapshot_not_found",
      },
    });
    expect(await countRows(first.missionId)).toEqual(firstBefore);
    expect(await countRows(second.missionId)).toEqual(secondBefore);
  });

  it("returns 404 for unknown post-operation PDF missions and snapshots", async () => {
    const { missionId } = await createCompletedMission();
    const before = await countRows(missionId);

    const missingSnapshotResponse = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${randomUUID()}/export/render/pdf`,
    );
    const missingMissionResponse = await request(app).get(
      `/missions/${randomUUID()}/post-operation/evidence-snapshots/${randomUUID()}/export/render/pdf`,
    );

    expect(missingSnapshotResponse.status).toBe(404);
    expect(missingSnapshotResponse.body).toMatchObject({
      error: {
        type: "post_operation_evidence_snapshot_not_found",
      },
    });
    expect(missingMissionResponse.status).toBe(404);
    expect(missingMissionResponse.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("creates accountable-manager sign-offs through the post-operation snapshot endpoint", async () => {
    const { missionId } = await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app)
      .post(
        `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/signoffs`,
      )
      .send({
        accountableManagerName: " Alex Accountable ",
        accountableManagerRole: " Accountable Manager ",
        reviewDecision: "approved",
        signedAt: "2026-04-18T18:00:00.000Z",
        signatureReference: " signature://accountable-manager/alex ",
        createdBy: " audit-admin ",
      });

    expect(response.status).toBe(201);
    expect(response.body.signoff).toMatchObject({
      missionId,
      postOperationEvidenceSnapshotId: snapshotResponse.body.snapshot.id,
      accountableManagerName: "Alex Accountable",
      accountableManagerRole: "Accountable Manager",
      reviewDecision: "approved",
      signedAt: "2026-04-18T18:00:00.000Z",
      signatureReference: "signature://accountable-manager/alex",
      createdBy: "audit-admin",
    });
    expect(response.body.signoff.id).toEqual(expect.any(String));
    expect(response.body.signoff.createdAt).toEqual(expect.any(String));
    expect(await countRows(missionId)).toEqual({
      ...before,
      post_operation_signoff_count: before.post_operation_signoff_count + 1,
    });
  });

  it("rejects duplicate accountable-manager sign-offs for the same snapshot", async () => {
    const { missionId } = await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);
    const endpoint = `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/signoffs`;
    const firstResponse = await request(app).post(endpoint).send({
      accountableManagerName: "Alex Accountable",
      accountableManagerRole: "Accountable Manager",
      reviewDecision: "approved",
      signedAt: "2026-04-18T18:00:00.000Z",
    });
    const beforeDuplicate = await countRows(missionId);
    const duplicateResponse = await request(app).post(endpoint).send({
      accountableManagerName: "Alex Accountable",
      accountableManagerRole: "Accountable Manager",
      reviewDecision: "approved",
      signedAt: "2026-04-18T18:00:00.000Z",
    });

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body).toMatchObject({
      error: {
        type: "post_operation_audit_signoff_already_exists",
      },
    });
    expect(await countRows(missionId)).toEqual(beforeDuplicate);
  });

  it("does not create accountable-manager sign-offs for another mission's snapshot", async () => {
    const first = await createCompletedMission();
    const second = await createCompletedMission();
    const secondSnapshot = await request(app)
      .post(`/missions/${second.missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(secondSnapshot.status).toBe(201);
    const firstBefore = await countRows(first.missionId);
    const secondBefore = await countRows(second.missionId);

    const response = await request(app)
      .post(
        `/missions/${first.missionId}/post-operation/evidence-snapshots/${secondSnapshot.body.snapshot.id}/signoffs`,
      )
      .send({
        accountableManagerName: "Alex Accountable",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-18T18:00:00.000Z",
      });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "post_operation_evidence_snapshot_not_found",
      },
    });
    expect(await countRows(first.missionId)).toEqual(firstBefore);
    expect(await countRows(second.missionId)).toEqual(secondBefore);
  });

  it("rejects invalid accountable-manager sign-off requests", async () => {
    const { missionId } = await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);
    const endpoint = `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/signoffs`;
    const before = await countRows(missionId);

    const missingNameResponse = await request(app).post(endpoint).send({
      accountableManagerRole: "Accountable Manager",
      reviewDecision: "approved",
      signedAt: "2026-04-18T18:00:00.000Z",
    });
    const invalidDecisionResponse = await request(app).post(endpoint).send({
      accountableManagerName: "Alex Accountable",
      accountableManagerRole: "Accountable Manager",
      reviewDecision: "maybe",
      signedAt: "2026-04-18T18:00:00.000Z",
    });
    const invalidDateResponse = await request(app).post(endpoint).send({
      accountableManagerName: "Alex Accountable",
      accountableManagerRole: "Accountable Manager",
      reviewDecision: "approved",
      signedAt: "not-a-date",
    });

    expect(missingNameResponse.status).toBe(400);
    expect(invalidDecisionResponse.status).toBe(400);
    expect(invalidDateResponse.status).toBe(400);
    expect(await countRows(missionId)).toEqual(before);
  });

  it("returns 404 for unknown sign-off missions and snapshots", async () => {
    const { missionId } = await createCompletedMission();
    const before = await countRows(missionId);

    const missingSnapshotResponse = await request(app)
      .post(
        `/missions/${missionId}/post-operation/evidence-snapshots/${randomUUID()}/signoffs`,
      )
      .send({
        accountableManagerName: "Alex Accountable",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-18T18:00:00.000Z",
      });
    const missingMissionResponse = await request(app)
      .post(
        `/missions/${randomUUID()}/post-operation/evidence-snapshots/${randomUUID()}/signoffs`,
      )
      .send({
        accountableManagerName: "Alex Accountable",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-18T18:00:00.000Z",
      });

    expect(missingSnapshotResponse.status).toBe(404);
    expect(missingSnapshotResponse.body).toMatchObject({
      error: {
        type: "post_operation_evidence_snapshot_not_found",
      },
    });
    expect(missingMissionResponse.status).toBe(404);
    expect(missingMissionResponse.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("stores accountable-manager sign-off records against post-operation evidence snapshots", async () => {
    const { missionId } = await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);
    const signoffId = randomUUID();

    await pool.query(
      `
      insert into post_operation_audit_signoffs (
        id,
        mission_id,
        post_operation_evidence_snapshot_id,
        accountable_manager_name,
        accountable_manager_role,
        review_decision,
        signed_at,
        signature_reference,
        created_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        signoffId,
        missionId,
        snapshotResponse.body.snapshot.id,
        "Alex Accountable",
        "Accountable Manager",
        "approved",
        "2026-04-18T18:00:00.000Z",
        "signature://accountable-manager/alex",
        "audit-admin",
      ],
    );

    const result = await pool.query(
      `
      select
        id,
        mission_id,
        post_operation_evidence_snapshot_id,
        accountable_manager_name,
        accountable_manager_role,
        review_decision,
        signed_at,
        signature_reference,
        created_by,
        created_at
      from post_operation_audit_signoffs
      where id = $1
      `,
      [signoffId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: signoffId,
      mission_id: missionId,
      post_operation_evidence_snapshot_id: snapshotResponse.body.snapshot.id,
      accountable_manager_name: "Alex Accountable",
      accountable_manager_role: "Accountable Manager",
      review_decision: "approved",
      signature_reference: "signature://accountable-manager/alex",
      created_by: "audit-admin",
    });
    expect(result.rows[0].signed_at.toISOString()).toBe(
      "2026-04-18T18:00:00.000Z",
    );
    expect(result.rows[0].created_at).toBeInstanceOf(Date);
    expect(await countRows(missionId)).toEqual({
      ...before,
      post_operation_signoff_count: before.post_operation_signoff_count + 1,
    });
  });

  it("rejects accountable-manager sign-off records that reference another mission's snapshot", async () => {
    const first = await createCompletedMission();
    const second = await createCompletedMission();
    const secondSnapshot = await request(app)
      .post(`/missions/${second.missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(secondSnapshot.status).toBe(201);
    const firstBefore = await countRows(first.missionId);
    const secondBefore = await countRows(second.missionId);

    await expect(
      pool.query(
        `
        insert into post_operation_audit_signoffs (
          id,
          mission_id,
          post_operation_evidence_snapshot_id,
          accountable_manager_name,
          accountable_manager_role,
          review_decision,
          signed_at
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          randomUUID(),
          first.missionId,
          secondSnapshot.body.snapshot.id,
          "Alex Accountable",
          "Accountable Manager",
          "approved",
          "2026-04-18T18:00:00.000Z",
        ],
      ),
    ).rejects.toMatchObject({
      code: "23503",
    });

    expect(await countRows(first.missionId)).toEqual(firstBefore);
    expect(await countRows(second.missionId)).toEqual(secondBefore);
  });

  it("rejects unsupported accountable-manager sign-off review decisions", async () => {
    const { missionId } = await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    await expect(
      pool.query(
        `
        insert into post_operation_audit_signoffs (
          id,
          mission_id,
          post_operation_evidence_snapshot_id,
          accountable_manager_name,
          accountable_manager_role,
          review_decision,
          signed_at
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          randomUUID(),
          missionId,
          snapshotResponse.body.snapshot.id,
          "Alex Accountable",
          "Accountable Manager",
          "maybe",
          "2026-04-18T18:00:00.000Z",
        ],
      ),
    ).rejects.toMatchObject({
      code: "23514",
    });

    expect(await countRows(missionId)).toEqual(before);
  });
});
