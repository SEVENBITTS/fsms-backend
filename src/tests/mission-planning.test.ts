import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from mission_planning_approval_handoffs");
  await pool.query("delete from mission_decision_evidence_links");
  await pool.query("delete from mission_external_overlays");
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
    name: "Planning UAV",
    status: "active",
  });

  expect(response.status).toBe(201);
  return response.body.platform as { id: string };
};

const createPilot = async () => {
  const response = await request(app).post("/pilots").send({
    displayName: "Planning Pilot",
    status: "active",
  });

  expect(response.status).toBe(201);
  return response.body.pilot as { id: string };
};

const createPilotReadinessEvidence = async (pilotId: string) => {
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

const createDispatchEvidenceLink = async (missionId: string) => {
  const snapshotResponse = await request(app)
    .post(`/missions/${missionId}/readiness/audit-snapshots`)
    .send({
      createdBy: "dispatcher-1",
    });

  expect(snapshotResponse.status).toBe(201);

  const linkResponse = await request(app)
    .post(`/missions/${missionId}/decision-evidence-links`)
    .send({
      snapshotId: snapshotResponse.body.snapshot.id,
      decisionType: "dispatch",
      createdBy: "dispatcher-1",
    });

  expect(linkResponse.status).toBe(201);
  return linkResponse.body.link as { id: string };
};

const recordTelemetry = async (missionId: string) => {
  const response = await request(app)
    .post(`/missions/${missionId}/telemetry`)
    .send({
      records: [
        {
          timestamp: "2026-04-20T10:00:00.000Z",
          lat: 51.5074,
          lng: -0.1278,
          altitudeM: 55,
          speedMps: 12,
          headingDeg: 180,
          progressPct: 25,
          payload: { segment: "departure" },
        },
        {
          timestamp: "2026-04-20T10:05:00.000Z",
          lat: 51.508,
          lng: -0.1281,
          altitudeM: 62,
          speedMps: 14,
          headingDeg: 182,
          progressPct: 90,
          payload: { segment: "return" },
        },
      ],
    });

  expect(response.status).toBe(202);
};

const createPostOperationEvidenceSnapshot = async (missionId: string) => {
  const response = await request(app)
    .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
    .send({
      createdBy: "ops-reviewer-1",
    });

  expect(response.status).toBe(201);
  return response.body.snapshot as { id: string };
};

const lowRiskInput = {
  operatingCategory: "open",
  missionComplexity: "low",
  populationExposure: "low",
  airspaceComplexity: "low",
  weatherRisk: "low",
  payloadRisk: "low",
};

const clearAirspaceInput = {
  airspaceClass: "g",
  maxAltitudeFt: 300,
  restrictionStatus: "clear",
  permissionStatus: "not_required",
};

const elevatedRiskInput = {
  operatingCategory: "specific",
  missionComplexity: "medium",
  populationExposure: "medium",
  airspaceComplexity: "medium",
  weatherRisk: "medium",
  payloadRisk: "medium",
  mitigationSummary: "Supervisor review required before approval",
};

const controlledAirspaceInput = {
  airspaceClass: "d",
  maxAltitudeFt: 350,
  restrictionStatus: "permission_required",
  permissionStatus: "pending",
  controlledAirspace: true,
  nearbyAerodrome: true,
  evidenceRef: "airspace-case-27",
};

const countRows = async (missionId?: string) => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from missions where ($1::uuid is null or id = $1)) as mission_count,
      (select count(*)::int from mission_events where ($1::uuid is null or mission_id = $1)) as mission_event_count,
      (select count(*)::int from mission_risk_inputs where ($1::uuid is null or mission_id = $1)) as risk_input_count,
      (select count(*)::int from airspace_compliance_inputs where ($1::uuid is null or mission_id = $1)) as airspace_input_count,
      (select count(*)::int from audit_evidence_snapshots where ($1::uuid is null or mission_id = $1)) as snapshot_count,
      (select count(*)::int from mission_planning_approval_handoffs where ($1::uuid is null or mission_id = $1)) as planning_handoff_count,
      (select count(*)::int from mission_decision_evidence_links where ($1::uuid is null or mission_id = $1)) as decision_link_count
    `,
    [missionId ?? null],
  );

  return result.rows[0] as {
    mission_count: number;
    mission_event_count: number;
    risk_input_count: number;
    airspace_input_count: number;
    snapshot_count: number;
    planning_handoff_count: number;
    decision_link_count: number;
  };
};

const countOperationsTimelineRows = async (missionId: string) => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from mission_risk_inputs where mission_id = $1) as risk_input_count,
      (select count(*)::int from airspace_compliance_inputs where mission_id = $1) as airspace_input_count,
      (select count(*)::int from mission_planning_approval_handoffs where mission_id = $1) as planning_handoff_count,
      (select count(*)::int from mission_events where mission_id = $1) as mission_event_count,
      (select count(*)::int from mission_decision_evidence_links where mission_id = $1) as decision_link_count,
      (select count(*)::int from mission_telemetry where mission_id = $1) as telemetry_count,
      (select count(*)::int from post_operation_evidence_snapshots where mission_id = $1) as post_operation_snapshot_count
    `,
    [missionId],
  );

  return result.rows[0] as {
    risk_input_count: number;
    airspace_input_count: number;
    planning_handoff_count: number;
    mission_event_count: number;
    decision_link_count: number;
    telemetry_count: number;
    post_operation_snapshot_count: number;
  };
};

const countSmsMappingRows = async () => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from sms_controls) as control_count,
      (select count(*)::int from sms_control_element_mappings) as mapping_count
    `,
  );

  return result.rows[0] as {
    control_count: number;
    mapping_count: number;
  };
};

const getMissionStatus = async (missionId: string) => {
  const result = await pool.query<{ status: string }>(
    "select status from missions where id = $1",
    [missionId],
  );

  return result.rows[0]?.status;
};

describe("mission planning drafts", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a draft mission with missing planning placeholders", async () => {
    const before = await countRows();

    const response = await request(app).post("/mission-plans/drafts").send({});

    expect(response.status).toBe(201);
    expect(response.body.draft).toMatchObject({
      missionPlanId: null,
      status: "draft",
      platformId: null,
      pilotId: null,
      placeholders: {
        platformAssigned: false,
        pilotAssigned: false,
        riskInputPresent: false,
        airspaceInputPresent: false,
      },
      readinessCheckAvailable: false,
      checklist: [
        { key: "platform", status: "missing" },
        { key: "pilot", status: "missing" },
        { key: "risk", status: "missing" },
        { key: "airspace", status: "missing" },
      ],
    });
    expect(response.body.draft.missionId).toEqual(expect.any(String));

    const after = await countRows(response.body.draft.missionId);
    expect(after).toEqual({
      mission_count: 1,
      mission_event_count: 0,
      risk_input_count: 0,
      airspace_input_count: 0,
      snapshot_count: 0,
      planning_handoff_count: 0,
      decision_link_count: 0,
    });
    expect((await countRows()).mission_count).toBe(before.mission_count + 1);
  });

  it("creates a draft mission with platform and pilot assignments", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();

    const response = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-alpha",
      platformId: platform.id,
      pilotId: pilot.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.draft).toMatchObject({
      missionPlanId: "plan-alpha",
      status: "draft",
      platformId: platform.id,
      pilotId: pilot.id,
      placeholders: {
        platformAssigned: true,
        pilotAssigned: true,
        riskInputPresent: false,
        airspaceInputPresent: false,
      },
      readinessCheckAvailable: false,
      checklist: [
        { key: "platform", status: "present" },
        { key: "pilot", status: "present" },
        { key: "risk", status: "missing" },
        { key: "airspace", status: "missing" },
      ],
    });
  });

  it("creates a draft mission with risk and airspace placeholders", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();

    const response = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-complete",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(response.status).toBe(201);
    expect(response.body.draft).toMatchObject({
      missionPlanId: "plan-complete",
      platformId: platform.id,
      pilotId: pilot.id,
      placeholders: {
        platformAssigned: true,
        pilotAssigned: true,
        riskInputPresent: true,
        airspaceInputPresent: true,
      },
      readinessCheckAvailable: true,
      checklist: [
        { key: "platform", status: "present" },
        { key: "pilot", status: "present" },
        { key: "risk", status: "present" },
        { key: "airspace", status: "present" },
      ],
    });

    expect(await countRows(response.body.draft.missionId)).toEqual({
      mission_count: 1,
      mission_event_count: 0,
      risk_input_count: 1,
      airspace_input_count: 1,
      snapshot_count: 0,
      planning_handoff_count: 0,
      decision_link_count: 0,
    });
  });

  it("returns an existing planning draft by mission id", async () => {
    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-lookup",
      riskInput: lowRiskInput,
    });

    expect(createResponse.status).toBe(201);

    const getResponse = await request(app).get(
      `/mission-plans/drafts/${createResponse.body.draft.missionId}`,
    );

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.draft).toEqual(createResponse.body.draft);
  });

  it("reviews a complete draft as gate-ready without side effects", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-review-ready",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(createResponse.status).toBe(201);

    const beforeReview = await countRows(createResponse.body.draft.missionId);
    const reviewResponse = await request(app).get(
      `/mission-plans/drafts/${createResponse.body.draft.missionId}/review`,
    );
    const afterReview = await countRows(createResponse.body.draft.missionId);

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.review).toMatchObject({
      missionId: createResponse.body.draft.missionId,
      missionPlanId: "plan-review-ready",
      status: "draft",
      platformId: platform.id,
      pilotId: pilot.id,
      readyForApproval: true,
      blockingReasons: [],
      checklist: [
        { key: "platform", status: "present" },
        { key: "pilot", status: "present" },
        { key: "risk", status: "present" },
        { key: "airspace", status: "present" },
      ],
    });
    expect(afterReview).toEqual(beforeReview);
  });

  it("reviews an incomplete draft with blocking reasons", async () => {
    const platform = await createPlatform();
    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-review-blocked",
      platformId: platform.id,
    });

    expect(createResponse.status).toBe(201);

    const reviewResponse = await request(app).get(
      `/mission-plans/drafts/${createResponse.body.draft.missionId}/review`,
    );

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.review).toMatchObject({
      missionId: createResponse.body.draft.missionId,
      missionPlanId: "plan-review-blocked",
      status: "draft",
      platformId: platform.id,
      pilotId: null,
      readyForApproval: false,
      blockingReasons: [
        "Assign a pilot before readiness can pass",
        "Add mission risk inputs before readiness can pass",
        "Add airspace compliance inputs before readiness can pass",
      ],
      checklist: [
        { key: "platform", status: "present" },
        { key: "pilot", status: "missing" },
        { key: "risk", status: "missing" },
        { key: "airspace", status: "missing" },
      ],
    });
  });

  it("hands off a gate-ready planning review to approval evidence", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-handoff-ready",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(createResponse.status).toBe(201);

    const beforeReview = await request(app).get(
      `/mission-plans/drafts/${createResponse.body.draft.missionId}/review`,
    );
    const beforeCounts = await countRows(createResponse.body.draft.missionId);
    const beforeSmsMappings = await countSmsMappingRows();
    const handoffResponse = await request(app)
      .post(
        `/mission-plans/drafts/${createResponse.body.draft.missionId}/approval-handoff`,
      )
      .send({
        createdBy: " planning lead ",
      });
    const afterReview = await request(app).get(
      `/mission-plans/drafts/${createResponse.body.draft.missionId}/review`,
    );
    const afterCounts = await countRows(createResponse.body.draft.missionId);

    expect(beforeReview.status).toBe(200);
    expect(handoffResponse.status).toBe(201);
    expect(handoffResponse.body.handoff.review).toEqual(beforeReview.body.review);
    expect(handoffResponse.body.handoff.snapshot).toMatchObject({
      missionId: createResponse.body.draft.missionId,
      evidenceType: "mission_readiness_gate",
      createdBy: "planning lead",
    });
    expect(handoffResponse.body.handoff.approvalEvidenceLink).toMatchObject({
      missionId: createResponse.body.draft.missionId,
      auditEvidenceSnapshotId: handoffResponse.body.handoff.snapshot.id,
      decisionType: "approval",
      createdBy: "planning lead",
    });
    expect(handoffResponse.body.handoff.smsControlMappings).toEqual(
      handoffResponse.body.handoff.snapshot.readinessSnapshot.smsControlMappings,
    );
    expect(handoffResponse.body.handoff.smsControlMappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PLATFORM_READINESS_MAINTENANCE",
          title: "Platform readiness and maintenance controls",
          smsElements: expect.arrayContaining([
            "3.1 Monitoring and Measurement of Safety Performance",
          ]),
        }),
        expect.objectContaining({
          code: "MISSION_READINESS_GATE",
          title: "Mission readiness gate controls",
          smsElements: expect.arrayContaining(["1.5 SMS documentation"]),
        }),
      ]),
    );
    expect(handoffResponse.body.handoff.smsControlMappings).toHaveLength(9);
    expect(afterReview.body.review).toEqual(beforeReview.body.review);
    expect(afterCounts).toEqual({
      ...beforeCounts,
      snapshot_count: beforeCounts.snapshot_count + 1,
      planning_handoff_count: beforeCounts.planning_handoff_count + 1,
      decision_link_count: beforeCounts.decision_link_count + 1,
    });
    expect(await countSmsMappingRows()).toEqual(beforeSmsMappings);
    expect(afterCounts.mission_event_count).toBe(0);
    expect(await getMissionStatus(createResponse.body.draft.missionId)).toBe(
      "draft",
    );
  });

  it("allows approval with linked gate-ready planning handoff evidence", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-handoff-approval",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(createResponse.status).toBe(201);

    const handoffResponse = await request(app)
      .post(
        `/mission-plans/drafts/${createResponse.body.draft.missionId}/approval-handoff`,
      )
      .send({
        createdBy: "planning lead",
      });
    const submitResponse = await request(app)
      .post(`/missions/${createResponse.body.draft.missionId}/submit`)
      .send({
        userId: "operator-1",
      });
    const approveResponse = await request(app)
      .post(`/missions/${createResponse.body.draft.missionId}/approve`)
      .send({
        reviewerId: "approver-1",
        decisionEvidenceLinkId:
          handoffResponse.body.handoff.approvalEvidenceLink.id,
        notes: "planning evidence verified",
      });
    const eventsResponse = await request(app).get(
      `/missions/${createResponse.body.draft.missionId}/events`,
    );

    expect(handoffResponse.status).toBe(201);
    expect(submitResponse.status).toBe(204);
    expect(approveResponse.status).toBe(204);
    expect(await getMissionStatus(createResponse.body.draft.missionId)).toBe(
      "approved",
    );
    expect(eventsResponse.status).toBe(200);
    expect(eventsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "mission.approved",
          details: expect.objectContaining({
            decision_evidence_link_id:
              handoffResponse.body.handoff.approvalEvidenceLink.id,
          }),
        }),
      ]),
    );
  });

  it("rejects approval handoff when the planning review is not ready", async () => {
    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-handoff-blocked",
      riskInput: lowRiskInput,
    });

    expect(createResponse.status).toBe(201);

    const beforeCounts = await countRows(createResponse.body.draft.missionId);
    const handoffResponse = await request(app)
      .post(
        `/mission-plans/drafts/${createResponse.body.draft.missionId}/approval-handoff`,
      )
      .send({
        createdBy: "approver",
      });
    const afterCounts = await countRows(createResponse.body.draft.missionId);

    expect(handoffResponse.status).toBe(409);
    expect(handoffResponse.body).toMatchObject({
      error: {
        type: "mission_planning_review_not_ready",
        blockingReasons: [
          "Assign a platform before readiness can pass",
          "Assign a pilot before readiness can pass",
          "Add airspace compliance inputs before readiness can pass",
        ],
      },
    });
    expect(afterCounts).toEqual(beforeCounts);
  });

  it("updates draft placeholders without replacing omitted values", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-progressive",
      platformId: platform.id,
    });

    expect(createResponse.status).toBe(201);

    const updateResponse = await request(app)
      .patch(`/mission-plans/drafts/${createResponse.body.draft.missionId}`)
      .send({
        pilotId: pilot.id,
        riskInput: lowRiskInput,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.draft).toMatchObject({
      missionPlanId: "plan-progressive",
      platformId: platform.id,
      pilotId: pilot.id,
      placeholders: {
        platformAssigned: true,
        pilotAssigned: true,
        riskInputPresent: true,
        airspaceInputPresent: false,
      },
      readinessCheckAvailable: false,
      checklist: [
        { key: "platform", status: "present" },
        { key: "pilot", status: "present" },
        { key: "risk", status: "present" },
        { key: "airspace", status: "missing" },
      ],
    });
    expect(await countRows(createResponse.body.draft.missionId)).toEqual({
      mission_count: 1,
      mission_event_count: 0,
      risk_input_count: 1,
      airspace_input_count: 0,
      snapshot_count: 0,
      planning_handoff_count: 0,
      decision_link_count: 0,
    });
  });

  it("replaces draft risk and airspace placeholders with latest input rows", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-replace",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(createResponse.status).toBe(201);

    const updateResponse = await request(app)
      .patch(`/mission-plans/drafts/${createResponse.body.draft.missionId}`)
      .send({
        riskInput: elevatedRiskInput,
        airspaceInput: controlledAirspaceInput,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.draft).toMatchObject({
      platformId: platform.id,
      pilotId: pilot.id,
      placeholders: {
        platformAssigned: true,
        pilotAssigned: true,
        riskInputPresent: true,
        airspaceInputPresent: true,
      },
      readinessCheckAvailable: true,
    });
    expect(await countRows(createResponse.body.draft.missionId)).toEqual({
      mission_count: 1,
      mission_event_count: 0,
      risk_input_count: 2,
      airspace_input_count: 2,
      snapshot_count: 0,
      planning_handoff_count: 0,
      decision_link_count: 0,
    });

    const latestRisk = await pool.query(
      `
      select operating_category, mission_complexity
      from mission_risk_inputs
      where mission_id = $1
      order by created_at desc, id desc
      limit 1
      `,
      [createResponse.body.draft.missionId],
    );
    const latestAirspace = await pool.query(
      `
      select airspace_class, permission_status
      from airspace_compliance_inputs
      where mission_id = $1
      order by created_at desc, id desc
      limit 1
      `,
      [createResponse.body.draft.missionId],
    );

    expect(latestRisk.rows[0]).toMatchObject({
      operating_category: "specific",
      mission_complexity: "medium",
    });
    expect(latestAirspace.rows[0]).toMatchObject({
      airspace_class: "d",
      permission_status: "pending",
    });
  });

  it("clears explicitly nulled platform and pilot placeholders", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const createResponse = await request(app).post("/mission-plans/drafts").send({
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(createResponse.status).toBe(201);

    const updateResponse = await request(app)
      .patch(`/mission-plans/drafts/${createResponse.body.draft.missionId}`)
      .send({
        platformId: null,
        pilotId: null,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.draft).toMatchObject({
      platformId: null,
      pilotId: null,
      placeholders: {
        platformAssigned: false,
        pilotAssigned: false,
        riskInputPresent: true,
        airspaceInputPresent: true,
      },
      readinessCheckAvailable: false,
      checklist: [
        { key: "platform", status: "missing" },
        { key: "pilot", status: "missing" },
        { key: "risk", status: "present" },
        { key: "airspace", status: "present" },
      ],
    });
  });

  it("rejects update requests for unknown references or invalid placeholder bodies", async () => {
    const createResponse = await request(app).post("/mission-plans/drafts").send({});

    expect(createResponse.status).toBe(201);

    const unknownPlatformResponse = await request(app)
      .patch(`/mission-plans/drafts/${createResponse.body.draft.missionId}`)
      .send({
        platformId: randomUUID(),
      });
    const unknownPilotResponse = await request(app)
      .patch(`/mission-plans/drafts/${createResponse.body.draft.missionId}`)
      .send({
        pilotId: randomUUID(),
      });
    const invalidRiskResponse = await request(app)
      .patch(`/mission-plans/drafts/${createResponse.body.draft.missionId}`)
      .send({
        riskInput: null,
      });

    expect(unknownPlatformResponse.status).toBe(404);
    expect(unknownPlatformResponse.body).toMatchObject({
      error: { type: "mission_planning_reference_not_found" },
    });
    expect(unknownPilotResponse.status).toBe(404);
    expect(unknownPilotResponse.body).toMatchObject({
      error: { type: "mission_planning_reference_not_found" },
    });
    expect(invalidRiskResponse.status).toBe(400);
    expect(invalidRiskResponse.body).toMatchObject({
      error: { type: "mission_planning_validation_failed" },
    });
    expect(await countRows(createResponse.body.draft.missionId)).toEqual({
      mission_count: 1,
      mission_event_count: 0,
      risk_input_count: 0,
      airspace_input_count: 0,
      snapshot_count: 0,
      planning_handoff_count: 0,
      decision_link_count: 0,
    });
  });

  it("rejects unknown platform and pilot placeholders", async () => {
    const platformResponse = await request(app).post("/mission-plans/drafts").send({
      platformId: randomUUID(),
    });
    const pilotResponse = await request(app).post("/mission-plans/drafts").send({
      pilotId: randomUUID(),
    });

    expect(platformResponse.status).toBe(404);
    expect(platformResponse.body).toMatchObject({
      error: {
        type: "mission_planning_reference_not_found",
      },
    });
    expect(pilotResponse.status).toBe(404);
    expect(pilotResponse.body).toMatchObject({
      error: {
        type: "mission_planning_reference_not_found",
      },
    });
    expect(await countRows()).toMatchObject({
      mission_count: 0,
      snapshot_count: 0,
      planning_handoff_count: 0,
      decision_link_count: 0,
    });
  });

  it("returns 404 for missing or non-draft missions", async () => {
    const missingResponse = await request(app).get(
      `/mission-plans/drafts/${randomUUID()}`,
    );
    const missionId = randomUUID();

    await pool.query(
      `
      insert into missions (
        id,
        status,
        mission_plan_id,
        last_event_sequence_no
      )
      values ($1, 'submitted', 'submitted-plan', 0)
      `,
      [missionId],
    );

    const submittedResponse = await request(app).get(
      `/mission-plans/drafts/${missionId}`,
    );

    expect(missingResponse.status).toBe(404);
    expect(submittedResponse.status).toBe(404);
  });

  it("returns 404 when reviewing missing or non-draft missions", async () => {
    const missingResponse = await request(app).get(
      `/mission-plans/drafts/${randomUUID()}/review`,
    );
    const missionId = randomUUID();

    await pool.query(
      `
      insert into missions (
        id,
        status,
        mission_plan_id,
        last_event_sequence_no
      )
      values ($1, 'submitted', 'submitted-plan', 0)
      `,
      [missionId],
    );

    const submittedResponse = await request(app).get(
      `/mission-plans/drafts/${missionId}/review`,
    );

    expect(missingResponse.status).toBe(404);
    expect(submittedResponse.status).toBe(404);
  });

  it("returns 404 when handing off missing or non-draft missions", async () => {
    const missingResponse = await request(app)
      .post(`/mission-plans/drafts/${randomUUID()}/approval-handoff`)
      .send({
        createdBy: "approver",
      });
    const missionId = randomUUID();

    await pool.query(
      `
      insert into missions (
        id,
        status,
        mission_plan_id,
        last_event_sequence_no
      )
      values ($1, 'submitted', 'submitted-plan', 0)
      `,
      [missionId],
    );

    const submittedResponse = await request(app)
      .post(`/mission-plans/drafts/${missionId}/approval-handoff`)
      .send({
        createdBy: "approver",
      });

    expect(missingResponse.status).toBe(404);
    expect(submittedResponse.status).toBe(404);
  });

  it("returns 404 when updating missing or non-draft missions", async () => {
    const missingResponse = await request(app)
      .patch(`/mission-plans/drafts/${randomUUID()}`)
      .send({
        missionPlanId: "missing-plan",
      });
    const missionId = randomUUID();

    await pool.query(
      `
      insert into missions (
        id,
        status,
        mission_plan_id,
        last_event_sequence_no
      )
      values ($1, 'approved', 'approved-plan', 0)
      `,
      [missionId],
    );

    const approvedResponse = await request(app)
      .patch(`/mission-plans/drafts/${missionId}`)
      .send({
        missionPlanId: "updated-approved-plan",
      });

    expect(missingResponse.status).toBe(404);
    expect(approvedResponse.status).toBe(404);
  });

  it("returns a minimal planning workspace with missing-state guidance", async () => {
    const createResponse = await request(app).post("/mission-plans/drafts").send({});

    expect(createResponse.status).toBe(201);
    const missionId = createResponse.body.draft.missionId as string;
    const before = await countRows(missionId);

    const workspaceResponse = await request(app).get(
      `/missions/${missionId}/planning-workspace`,
    );

    expect(workspaceResponse.status).toBe(200);
    expect(workspaceResponse.body.workspace).toMatchObject({
      mission: {
        id: missionId,
        missionPlanId: null,
        status: "draft",
        platformId: null,
        pilotId: null,
      },
      planning: {
        status: "draft",
        missionPlanId: null,
        platformId: null,
        pilotId: null,
        placeholders: {
          platformAssigned: false,
          pilotAssigned: false,
          riskInputPresent: false,
          airspaceInputPresent: false,
        },
        readyForApproval: false,
      },
      platform: {
        assignedPlatformId: null,
        state: "missing",
        summary: null,
      },
      pilot: {
        assignedPilotId: null,
        state: "missing",
        summary: null,
      },
      missionRisk: expect.objectContaining({
        missionId,
        result: "fail",
      }),
      airspaceCompliance: expect.objectContaining({
        missionId,
        result: "fail",
        input: null,
      }),
      evidence: {
        readinessSnapshotCount: 0,
        latestReadinessSnapshot: null,
        approvalEvidenceLinkCount: 0,
        latestApprovalEvidenceLink: null,
        dispatchEvidenceLinkCount: 0,
        latestDispatchEvidenceLink: null,
      },
      approval: {
        ready: false,
        handoffCreated: false,
        latestApprovalHandoff: null,
      },
      dispatch: {
        ready: false,
      },
    });
    expect(workspaceResponse.body.workspace.missingRequirements).toEqual([
      "Assign a platform before readiness can pass",
      "Assign a pilot before readiness can pass",
      "Add mission risk inputs before readiness can pass",
      "Add airspace compliance inputs before readiness can pass",
    ]);
    expect(workspaceResponse.body.workspace.blockingReasons).toEqual(
      expect.arrayContaining([
        "Assign a platform before readiness can pass",
        "Assign a pilot before readiness can pass",
      ]),
    );
    expect(workspaceResponse.body.workspace.nextAllowedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "submit",
          currentStatus: "draft",
          targetStatus: "submitted",
          allowed: true,
          error: null,
        }),
        expect.objectContaining({
          action: "approve",
          allowed: false,
          error: expect.objectContaining({
            type: "invalid_state_transition",
          }),
        }),
      ]),
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("returns a populated planning workspace with readiness and evidence status", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    await createPilotReadinessEvidence(pilot.id);

    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-workspace-ready",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(createResponse.status).toBe(201);
    const missionId = createResponse.body.draft.missionId as string;

    const handoffResponse = await request(app)
      .post(`/mission-plans/drafts/${missionId}/approval-handoff`)
      .send({
        createdBy: "planning lead",
      });

    expect(handoffResponse.status).toBe(201);

    const workspaceResponse = await request(app).get(
      `/missions/${missionId}/planning-workspace`,
    );

    expect(workspaceResponse.status).toBe(200);
    expect(workspaceResponse.body.workspace).toMatchObject({
      mission: {
        id: missionId,
        missionPlanId: "plan-workspace-ready",
        status: "draft",
        platformId: platform.id,
        pilotId: pilot.id,
      },
      planning: {
        readyForApproval: true,
        blockingReasons: [],
      },
      platform: {
        assignedPlatformId: platform.id,
        state: "assigned",
        summary: expect.objectContaining({
          id: platform.id,
          name: "Planning UAV",
          status: "active",
        }),
      },
      pilot: {
        assignedPilotId: pilot.id,
        state: "assigned",
        summary: expect.objectContaining({
          id: pilot.id,
          displayName: "Planning Pilot",
          status: "active",
        }),
      },
      missionRisk: expect.objectContaining({
        missionId,
        result: "pass",
      }),
      airspaceCompliance: expect.objectContaining({
        missionId,
        result: "pass",
      }),
      readiness: expect.objectContaining({
        missionId,
        result: "pass",
        gate: expect.objectContaining({
          blocksApproval: false,
          blocksDispatch: false,
          requiresReview: false,
        }),
      }),
      evidence: {
        readinessSnapshotCount: 1,
        latestReadinessSnapshot: expect.objectContaining({
          missionId,
        }),
        approvalEvidenceLinkCount: 1,
        latestApprovalEvidenceLink: expect.objectContaining({
          missionId,
          decisionType: "approval",
        }),
        dispatchEvidenceLinkCount: 0,
        latestDispatchEvidenceLink: null,
      },
      approval: {
        ready: true,
        handoffCreated: true,
        latestApprovalHandoff: expect.objectContaining({
          missionId,
          createdBy: "planning lead",
        }),
        blockingReasons: [],
      },
      dispatch: {
        ready: false,
        blockingReasons: expect.arrayContaining([
          "Mission cannot be launched from status draft",
        ]),
      },
    });
    expect(workspaceResponse.body.workspace.missingRequirements).toEqual([]);
    expect(workspaceResponse.body.workspace.nextAllowedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "submit",
          allowed: true,
        }),
        expect.objectContaining({
          action: "approve",
          allowed: false,
        }),
      ]),
    );
  });

  it("keeps planning workspace evidence isolated by mission", async () => {
    const firstMissionResponse = await request(app).post("/mission-plans/drafts").send({
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });
    const platform = await createPlatform();
    const pilot = await createPilot();
    await createPilotReadinessEvidence(pilot.id);
    const secondMissionResponse = await request(app).post("/mission-plans/drafts").send({
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(firstMissionResponse.status).toBe(201);
    expect(secondMissionResponse.status).toBe(201);

    const secondMissionId = secondMissionResponse.body.draft.missionId as string;
    const secondHandoffResponse = await request(app)
      .post(`/mission-plans/drafts/${secondMissionId}/approval-handoff`)
      .send({
        createdBy: "planner-2",
      });

    expect(secondHandoffResponse.status).toBe(201);

    const firstWorkspaceResponse = await request(app).get(
      `/missions/${firstMissionResponse.body.draft.missionId}/planning-workspace`,
    );

    expect(firstWorkspaceResponse.status).toBe(200);
    expect(firstWorkspaceResponse.body.workspace.evidence).toMatchObject({
      readinessSnapshotCount: 0,
      latestReadinessSnapshot: null,
      approvalEvidenceLinkCount: 0,
      latestApprovalEvidenceLink: null,
    });
    expect(firstWorkspaceResponse.body.workspace.approval).toMatchObject({
      handoffCreated: false,
      latestApprovalHandoff: null,
    });
  });

  it("returns 404 for missing planning workspace missions", async () => {
    const response = await request(app).get(
      `/missions/${randomUUID()}/planning-workspace`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
  });

  it("returns a dispatch workspace for submitted missions with live launch blockers", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    await createPilotReadinessEvidence(pilot.id);

    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-dispatch-submitted",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(createResponse.status).toBe(201);
    const missionId = createResponse.body.draft.missionId as string;

    const submitResponse = await request(app)
      .post(`/missions/${missionId}/submit`)
      .send({
        userId: "operator-1",
      });

    expect(submitResponse.status).toBe(204);

    const workspaceResponse = await request(app).get(
      `/missions/${missionId}/dispatch-workspace`,
    );

    expect(workspaceResponse.status).toBe(200);
    expect(workspaceResponse.body.workspace).toMatchObject({
      mission: {
        id: missionId,
        status: "submitted",
      },
      approval: {
        currentStatus: "submitted",
        approvedForDispatch: false,
        handoffCreated: false,
        latestApprovalHandoff: null,
        latestApprovalEvidenceLink: null,
      },
      dispatch: {
        ready: false,
        latestDispatchEvidenceLink: null,
        launchPreflight: {
          action: "launch",
          currentStatus: "submitted",
          targetStatus: "active",
          allowed: false,
          error: {
            type: "invalid_state_transition",
            message: "Mission cannot be launched from status submitted",
          },
        },
        missingRequirements: expect.arrayContaining([
          "Create planning approval handoff before dispatch",
          "Link approval evidence before dispatch",
          "Create linked dispatch evidence before launch",
        ]),
      },
    });
    expect(workspaceResponse.body.workspace.blockingReasons).toEqual(
      expect.arrayContaining([
        "Mission cannot be launched from status submitted",
        "Mission must be approved before launch can proceed",
      ]),
    );
    expect(workspaceResponse.body.workspace.nextAllowedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "launch",
          allowed: false,
        }),
        expect.objectContaining({
          action: "abort",
          allowed: true,
        }),
      ]),
    );
  });

  it("returns a dispatch workspace for approved missions without dispatch evidence", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    await createPilotReadinessEvidence(pilot.id);

    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-dispatch-approved",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(createResponse.status).toBe(201);
    const missionId = createResponse.body.draft.missionId as string;

    const handoffResponse = await request(app)
      .post(`/mission-plans/drafts/${missionId}/approval-handoff`)
      .send({
        createdBy: "planning lead",
      });

    expect(handoffResponse.status).toBe(201);

    const submitResponse = await request(app)
      .post(`/missions/${missionId}/submit`)
      .send({
        userId: "operator-1",
      });
    expect(submitResponse.status).toBe(204);

    const approveResponse = await request(app)
      .post(`/missions/${missionId}/approve`)
      .send({
        reviewerId: "approver-1",
        decisionEvidenceLinkId:
          handoffResponse.body.handoff.approvalEvidenceLink.id,
      });
    expect(approveResponse.status).toBe(204);

    const before = await countRows(missionId);
    const workspaceResponse = await request(app).get(
      `/missions/${missionId}/dispatch-workspace`,
    );

    expect(workspaceResponse.status).toBe(200);
    expect(workspaceResponse.body.workspace).toMatchObject({
      mission: {
        id: missionId,
        status: "approved",
      },
      approval: {
        currentStatus: "approved",
        approvedForDispatch: true,
        handoffCreated: true,
        latestApprovalHandoff: expect.objectContaining({
          missionId,
        }),
        latestApprovalEvidenceLink: expect.objectContaining({
          missionId,
          decisionType: "approval",
        }),
        blockingReasons: [],
      },
      dispatch: {
        ready: false,
        latestDispatchEvidenceLink: null,
        launchPreflight: {
          action: "launch",
          currentStatus: "approved",
          targetStatus: "active",
          allowed: true,
          error: null,
        },
        missingRequirements: ["Create linked dispatch evidence before launch"],
      },
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("returns a dispatch workspace for approved missions with dispatch evidence", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    await createPilotReadinessEvidence(pilot.id);

    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-dispatch-ready",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(createResponse.status).toBe(201);
    const missionId = createResponse.body.draft.missionId as string;

    const handoffResponse = await request(app)
      .post(`/mission-plans/drafts/${missionId}/approval-handoff`)
      .send({
        createdBy: "planning lead",
      });
    expect(handoffResponse.status).toBe(201);

    expect(
      (
        await request(app).post(`/missions/${missionId}/submit`).send({
          userId: "operator-1",
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app).post(`/missions/${missionId}/approve`).send({
          reviewerId: "approver-1",
          decisionEvidenceLinkId:
            handoffResponse.body.handoff.approvalEvidenceLink.id,
        })
      ).status,
    ).toBe(204);

    const dispatchLink = await createDispatchEvidenceLink(missionId);

    const workspaceResponse = await request(app).get(
      `/missions/${missionId}/dispatch-workspace`,
    );

    expect(workspaceResponse.status).toBe(200);
    expect(workspaceResponse.body.workspace).toMatchObject({
      mission: {
        id: missionId,
        status: "approved",
      },
      evidence: {
        dispatchEvidenceLinkCount: 1,
        latestDispatchEvidenceLink: expect.objectContaining({
          id: dispatchLink.id,
          missionId,
          decisionType: "dispatch",
        }),
      },
      dispatch: {
        ready: true,
        latestDispatchEvidenceLink: expect.objectContaining({
          id: dispatchLink.id,
        }),
        launchPreflight: {
          action: "launch",
          currentStatus: "approved",
          targetStatus: "active",
          allowed: true,
          error: null,
        },
        blockingReasons: [],
        missingRequirements: [],
      },
    });
  });

  it("keeps dispatch workspace evidence isolated by mission", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    await createPilotReadinessEvidence(pilot.id);

    const firstMissionResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "dispatch-isolated-1",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });
    const secondMissionResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "dispatch-isolated-2",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(firstMissionResponse.status).toBe(201);
    expect(secondMissionResponse.status).toBe(201);

    const secondMissionId = secondMissionResponse.body.draft.missionId as string;
    const secondHandoffResponse = await request(app)
      .post(`/mission-plans/drafts/${secondMissionId}/approval-handoff`)
      .send({
        createdBy: "planning lead",
      });

    expect(secondHandoffResponse.status).toBe(201);
    expect(
      (
        await request(app).post(`/missions/${secondMissionId}/submit`).send({
          userId: "operator-1",
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app).post(`/missions/${secondMissionId}/approve`).send({
          reviewerId: "approver-1",
          decisionEvidenceLinkId:
            secondHandoffResponse.body.handoff.approvalEvidenceLink.id,
        })
      ).status,
    ).toBe(204);
    await createDispatchEvidenceLink(secondMissionId);

    const firstWorkspaceResponse = await request(app).get(
      `/missions/${firstMissionResponse.body.draft.missionId}/dispatch-workspace`,
    );

    expect(firstWorkspaceResponse.status).toBe(200);
    expect(firstWorkspaceResponse.body.workspace.evidence).toMatchObject({
      dispatchEvidenceLinkCount: 0,
      latestDispatchEvidenceLink: null,
      approvalEvidenceLinkCount: 0,
      latestApprovalEvidenceLink: null,
    });
  });

  it("returns 404 for missing dispatch workspace missions", async () => {
    const response = await request(app).get(
      `/missions/${randomUUID()}/dispatch-workspace`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
  });

  it("returns a minimal operations timeline with explicit missing phases", async () => {
    const createResponse = await request(app).post("/mission-plans/drafts").send({});

    expect(createResponse.status).toBe(201);
    const missionId = createResponse.body.draft.missionId as string;

    const timelineResponse = await request(app).get(
      `/missions/${missionId}/operations-timeline`,
    );

    expect(timelineResponse.status).toBe(200);
    expect(timelineResponse.body.timeline).toMatchObject({
      mission: {
        id: missionId,
        status: "draft",
      },
      items: [],
      phases: [
        expect.objectContaining({
          phase: "planning",
          status: "missing",
        }),
        expect.objectContaining({
          phase: "approval",
          status: "missing",
        }),
        expect.objectContaining({
          phase: "dispatch",
          status: "missing",
        }),
        expect.objectContaining({
          phase: "flight",
          status: "missing",
        }),
        expect.objectContaining({
          phase: "post_operation",
          status: "missing",
        }),
      ],
    });
  });

  it("returns a populated operations timeline across planning, approval, dispatch, flight, and post-operation", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    await createPilotReadinessEvidence(pilot.id);

    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-ops-timeline",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(createResponse.status).toBe(201);
    const missionId = createResponse.body.draft.missionId as string;

    const handoffResponse = await request(app)
      .post(`/mission-plans/drafts/${missionId}/approval-handoff`)
      .send({
        createdBy: "planning lead",
      });
    expect(handoffResponse.status).toBe(201);

    expect(
      (
        await request(app).post(`/missions/${missionId}/submit`).send({
          userId: "operator-1",
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app).post(`/missions/${missionId}/approve`).send({
          reviewerId: "approver-1",
          decisionEvidenceLinkId:
            handoffResponse.body.handoff.approvalEvidenceLink.id,
        })
      ).status,
    ).toBe(204);

    const dispatchLink = await createDispatchEvidenceLink(missionId);

    expect(
      (
        await request(app).post(`/missions/${missionId}/launch`).send({
          operatorId: "operator-1",
          vehicleId: "vehicle-1",
          lat: 51.5074,
          lng: -0.1278,
          decisionEvidenceLinkId: dispatchLink.id,
        })
      ).status,
    ).toBe(204);

    await recordTelemetry(missionId);

    expect(
      (
        await request(app).post(`/missions/${missionId}/complete`).send({
          operatorId: "operator-1",
        })
      ).status,
    ).toBe(204);

    const postOperationSnapshot = await createPostOperationEvidenceSnapshot(
      missionId,
    );
    const before = await countOperationsTimelineRows(missionId);

    const timelineResponse = await request(app).get(
      `/missions/${missionId}/operations-timeline`,
    );

    expect(timelineResponse.status).toBe(200);
    expect(timelineResponse.body.timeline.mission).toMatchObject({
      id: missionId,
      missionPlanId: "plan-ops-timeline",
      status: "completed",
    });
    expect(timelineResponse.body.timeline.phases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: "planning", status: "present" }),
        expect.objectContaining({ phase: "approval", status: "present" }),
        expect.objectContaining({ phase: "dispatch", status: "present" }),
        expect.objectContaining({ phase: "flight", status: "present" }),
        expect.objectContaining({ phase: "post_operation", status: "present" }),
      ]),
    );
    expect(timelineResponse.body.timeline.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "planning",
          type: "planning_risk_input",
        }),
        expect.objectContaining({
          phase: "planning",
          type: "planning_airspace_input",
        }),
        expect.objectContaining({
          phase: "planning",
          type: "planning_approval_handoff",
        }),
        expect.objectContaining({
          phase: "approval",
          type: "decision_evidence_link",
          details: expect.objectContaining({
            decisionType: "approval",
          }),
        }),
        expect.objectContaining({
          phase: "approval",
          type: "mission_event",
          details: expect.objectContaining({
            eventType: "mission.approved",
          }),
        }),
        expect.objectContaining({
          phase: "dispatch",
          type: "decision_evidence_link",
          details: expect.objectContaining({
            decisionType: "dispatch",
          }),
        }),
        expect.objectContaining({
          phase: "dispatch",
          type: "mission_event",
          details: expect.objectContaining({
            eventType: "mission.launched",
          }),
        }),
        expect.objectContaining({
          phase: "flight",
          type: "telemetry_summary",
          details: expect.objectContaining({
            recordCount: 2,
          }),
        }),
        expect.objectContaining({
          phase: "post_operation",
          type: "mission_event",
          details: expect.objectContaining({
            eventType: "mission.completed",
          }),
        }),
        expect.objectContaining({
          phase: "post_operation",
          type: "post_operation_snapshot",
          details: expect.objectContaining({
            id: postOperationSnapshot.id,
          }),
        }),
      ]),
    );

    const occurredAtValues = timelineResponse.body.timeline.items.map(
      (item: { occurredAt: string }) => item.occurredAt,
    );
    expect([...occurredAtValues].sort()).toEqual(occurredAtValues);
    expect(await countOperationsTimelineRows(missionId)).toEqual(before);
  });

  it("keeps operations timeline records isolated by mission", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    await createPilotReadinessEvidence(pilot.id);

    const firstMissionResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "ops-iso-1",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });
    const secondMissionResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "ops-iso-2",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(firstMissionResponse.status).toBe(201);
    expect(secondMissionResponse.status).toBe(201);

    const secondMissionId = secondMissionResponse.body.draft.missionId as string;
    const handoffResponse = await request(app)
      .post(`/mission-plans/drafts/${secondMissionId}/approval-handoff`)
      .send({
        createdBy: "planning lead",
      });

    expect(handoffResponse.status).toBe(201);

    const firstTimelineResponse = await request(app).get(
      `/missions/${firstMissionResponse.body.draft.missionId}/operations-timeline`,
    );

    expect(firstTimelineResponse.status).toBe(200);
    expect(firstTimelineResponse.body.timeline.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "planning_risk_input",
        }),
        expect.objectContaining({
          type: "planning_airspace_input",
        }),
      ]),
    );
    expect(firstTimelineResponse.body.timeline.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "planning_approval_handoff",
          details: expect.objectContaining({
            missionDecisionEvidenceLinkId:
              handoffResponse.body.handoff.approvalEvidenceLink.id,
          }),
        }),
      ]),
    );
  });

  it("returns 404 for missing operations timeline missions", async () => {
    const response = await request(app).get(
      `/missions/${randomUUID()}/operations-timeline`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
  });

  it("lists recent missions for operator search and selection", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();

    const firstDraftResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "search-alpha",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });
    const secondDraftResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "search-bravo",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(firstDraftResponse.status).toBe(201);
    expect(secondDraftResponse.status).toBe(201);

    const response = await request(app).get("/missions");

    expect(response.status).toBe(200);
    expect(response.body.missions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          missionPlanId: "search-alpha",
          status: "draft",
          platformId: platform.id,
          platformName: "Planning UAV",
          pilotId: pilot.id,
          pilotDisplayName: "Planning Pilot",
        }),
        expect.objectContaining({
          missionPlanId: "search-bravo",
          status: "draft",
        }),
      ]),
    );
    expect(response.body.limit).toBe(20);
  });

  it("filters listed missions by operator search query", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();

    const alphaResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "ops-alpha",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });
    const bravoResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "ops-bravo",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(alphaResponse.status).toBe(201);
    expect(bravoResponse.status).toBe(201);

    const response = await request(app).get("/missions").query({ q: "bravo" });

    expect(response.status).toBe(200);
    expect(response.body.query).toBe("bravo");
    expect(response.body.missions).toHaveLength(1);
    expect(response.body.missions[0]).toMatchObject({
      missionPlanId: "ops-bravo",
      status: "draft",
    });
  });

  it("serves the operator mission workspace screen", async () => {
    const response = await request(app).get("/operator/mission-workspace");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("Operator Mission Workspace");
    expect(response.text).toContain("Mission Lifecycle Actions");
    expect(response.text).toContain("Mission Search and Selection");
    expect(response.text).toContain("Evidence Helpers");
    expect(response.text).toContain("mission-search-input");
    expect(response.text).toContain("mission-browser-list");
    expect(response.text).toContain("evidence-panel");
    expect(response.text).toContain("/static/operator-mission-workspace.js");
  });

  it("serves the operator live operations map screen", async () => {
    const response = await request(app).get("/operator/live-operations-map");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("Operator Live Operations View");
    expect(response.text).toContain("Map and Replay Surface");
    expect(response.text).toContain("Telemetry and Risk Status");
    expect(response.text).toContain("Alert Timeline Correlation");
    expect(response.text).toContain("Conflict Assessment");
    expect(response.text).toContain("Conflict Advisory Guidance");
    expect(response.text).toContain("Enter mission UUID");
    expect(response.text).toContain("Open workspace");
    expect(response.text).toContain("live-ops-mission-search-input");
    expect(response.text).toContain("live-ops-mission-search-btn");
    expect(response.text).toContain("live-ops-mission-browser-list");
    expect(response.text).toContain("live-ops-mission-browser-detail");
    expect(response.text).toContain("live-ops-replay-play-btn");
    expect(response.text).toContain("live-ops-replay-slider");
    expect(response.text).toContain("live-ops-replay-markers");
    expect(response.text).toContain("live-ops-replay-progress");
    expect(response.text).toContain("live-ops-replay-step-back-btn");
    expect(response.text).toContain("live-ops-replay-step-forward-btn");
    expect(response.text).toContain("live-ops-replay-speed");
    expect(response.text).toContain("Replay Milestones");
    expect(response.text).toContain("live-ops-jump-controls");
    expect(response.text).toContain("map-alert-stack");
    expect(response.text).toContain("map-terrain");
    expect(response.text).toContain("map-compass");
    expect(response.text).toContain("/static/operator-live-operations-map.js");
  });

  it("serves the operator mission workspace javascript bundle", async () => {
    const response = await request(app).get(
      "/static/operator-mission-workspace.js",
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("javascript");
    expect(response.text).toContain("/planning-workspace");
    expect(response.text).toContain("/dispatch-workspace");
    expect(response.text).toContain("/operations-timeline");
    expect(response.text).toContain("/transitions/${action}/check");
    expect(response.text).toContain('["submit", "approve", "launch", "complete", "abort"]');
    expect(response.text).toContain("/missions/${missionId}/${action}");
    expect(response.text).toContain('getElementById("mission-search-input")');
    expect(response.text).toContain('fetchJson(`/missions?${params.toString()}`)');
    expect(response.text).toContain('data-open-mission');
    expect(response.text).toContain('getElementById("evidence-panel")');
    expect(response.text).toContain("/readiness/audit-snapshots");
    expect(response.text).toContain("/approval-handoff");
    expect(response.text).toContain('payload.decisionType = "dispatch"');
  });

  it("serves the operator live operations javascript bundle", async () => {
    const response = await request(app).get(
      "/static/operator-live-operations-map.js",
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("javascript");
    expect(response.text).toContain("/missions/${");
    expect(response.text).toContain("/replay");
    expect(response.text).toContain("/telemetry/latest");
    expect(response.text).toContain("/alerts");
    expect(response.text).toContain("/external-overlays");
    expect(response.text).toContain("/conflict-assessment");
    expect(response.text).toContain("/planning-workspace");
    expect(response.text).toContain("/dispatch-workspace");
    expect(response.text).toContain("/operations-timeline");
    expect(response.text).toContain("/operator/missions/${encodeURIComponent(missionId)}");
    expect(response.text).toContain("buildOverlayCards");
    expect(response.text).toContain("normalizeMissionId");
    expect(response.text).toContain("isPlaceholderMissionId");
    expect(response.text).toContain("hasSelectedMissionId");
    expect(response.text).toContain("renderEntryState");
    expect(response.text).toContain("loadMissionList");
    expect(response.text).toContain("renderMissionBrowser");
    expect(response.text).toContain('fetchJson(`/missions?${params.toString()}`)');
    expect(response.text).toContain('data-open-mission');
    expect(response.text).toContain("live-ops-mission-search-input");
    expect(response.text).toContain("map-alert-card");
    expect(response.text).toContain("severityStroke");
    expect(response.text).toContain("alertTrackHighlight");
    expect(response.text).toContain("renderReplayControls");
    expect(response.text).toContain("replayPlayButton");
    expect(response.text).toContain("replaySlider");
    expect(response.text).toContain("replayMarkers");
    expect(response.text).toContain("conflictReplayMarkers");
    expect(response.text).toContain("currentConflictWindowSummary");
    expect(response.text).toContain("conflictTrackWindowPoints");
    expect(response.text).toContain("correlatedAlertWindows");
    expect(response.text).toContain("renderAlertCorrelation");
    expect(response.text).toContain("replaySpeedSelect");
    expect(response.text).toContain("replayStepBackButton");
    expect(response.text).toContain("replayStepForwardButton");
    expect(response.text).toContain("startReplayPlayback");
    expect(response.text).toContain("replayPlaybackIntervalMs");
    expect(response.text).toContain("findNearestReplayIndexForTime");
    expect(response.text).toContain("renderJumpControls");
    expect(response.text).toContain("data-jump-timestamp");
    expect(response.text).toContain("setInterval");
    expect(response.text).toContain("map-terrain");
    expect(response.text).toContain("weatherOverlays");
    expect(response.text).toContain("activeWeatherOverlay");
    expect(response.text).toContain("weatherSummary");
    expect(response.text).toContain("crewedTrafficOverlays");
    expect(response.text).toContain("activeCrewedTrafficOverlays");
    expect(response.text).toContain("crewedTrafficSummary");
    expect(response.text).toContain("droneTrafficOverlays");
    expect(response.text).toContain("activeDroneTrafficOverlays");
    expect(response.text).toContain("droneTrafficSummary");
    expect(response.text).toContain("conflictAssessmentSummary");
    expect(response.text).toContain("conflictAdvisorySummary");
    expect(response.text).toContain("refreshContext");
    expect(response.text).toContain("formatRangeBearing");
    expect(response.text).toContain("formatTemporalContext");
    expect(response.text).toContain("formatVerticalContext");
    expect(response.text).toContain("formatBearingDegrees");
    expect(response.text).toContain("rangeMeters");
    expect(response.text).toContain("bearingDegrees");
    expect(response.text).toContain("insideArea");
    expect(response.text).toContain("inside_window");
    expect(response.text).toContain("inside_band");
    expect(response.text).toContain("primaryConflictAssessmentItem");
    expect(response.text).toContain("secondaryConflictAssessmentItems");
    expect(response.text).toContain("primaryConflictAdvisory");
    expect(response.text).toContain("secondaryConflictAdvisories");
    expect(response.text).toContain("isPostLaunchMission");
    expect(response.text).toContain("currentConflictReplayRelation");
    expect(response.text).toContain("correlatedConflictTimelineItems");
    expect(response.text).toContain("renderConflictAssessment");
    expect(response.text).toContain("renderConflictAdvisory");
    expect(response.text).toContain("Primary Conflict");
    expect(response.text).toContain("Additional Conflicts");
    expect(response.text).toContain("Primary Advisory");
    expect(response.text).toContain("Additional Advisories");
    expect(response.text).toContain("Not applicable");
    expect(response.text).toContain("timeline-chip-row");
    expect(response.text).toContain("map-window-summary");
    expect(response.text).toContain("conflictTrackHighlight");
    expect(response.text).toContain("conflictSeverityBands");
    expect(response.text).toContain("conflictProximityEnvelope");
    expect(response.text).toContain("conflictProximityEnvelopeSummary");
    expect(response.text).toContain("conflictEnvelopeRadius");
    expect(response.text).toContain("map-envelope-summary");
    expect(response.text).toContain("lastFailedRefreshRunId");
    expect(response.text).toContain("carriedForwardFromFailedRefresh");
    expect(response.text).toContain("lastPartialRefreshRunId");
    expect(response.text).toContain("carriedForwardFromPartialRefresh");
    expect(response.text).toContain("notamGeometryContext");
    expect(response.text).toContain("areaOverlayNotamGeometryDetail");
    expect(response.text).toContain("areaOverlayNotamGeometrySummaryContext");
    expect(response.text).toContain("areaOverlayQLineIndexReviewContext");
    expect(response.text).toContain("NOTAM geometry");
    expect(response.text).toContain("NOTAM geometry E-field");
    expect(response.text).toContain("NOTAM geometry Q-line fallback");
    expect(response.text).toContain("NOTAM geometry provided");
    expect(response.text).toContain("Q-line index metadata");
    expect(response.text).toContain("coarse index only");
    expect(response.text).toContain("Q-line center");
    expect(response.text).toContain("Q-line radius");
    expect(response.text).toContain("Last failed refresh");
    expect(response.text).toContain("Last partial refresh");
    expect(response.text).toContain("carried forward after partial refresh");
    expect(response.text).toContain("carried forward after failed refresh");
    expect(response.text).toContain("areaOverlaySourceRefreshCardContext");
    expect(response.text).toContain("Area source failed");
    expect(response.text).toContain("Area source partial");
    expect(response.text).toContain("Area source stale");
    expect(response.text).toContain("Area source fresh");
    expect(response.text).toContain("carried forward after failed refresh");
    expect(response.text).toContain("carried forward after partial refresh");
    expect(response.text).toContain(
      "No mission-specific fetch is attempted until a valid mission ID is provided.",
    );
  });
});
