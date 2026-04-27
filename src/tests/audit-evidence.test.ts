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
  await pool.query("delete from safety_action_implementation_evidence");
  await pool.query("delete from safety_action_decisions");
  await pool.query("delete from safety_action_proposals");
  await pool.query("delete from safety_event_agenda_links");
  await pool.query("delete from safety_event_meeting_triggers");
  await pool.query("delete from safety_events");
  await pool.query("delete from air_safety_meetings");
  await pool.query("delete from post_operation_audit_signoffs");
  await pool.query("delete from post_operation_evidence_snapshots");
  await pool.query("delete from live_ops_map_view_state_snapshots");
  await pool.query("delete from mission_planning_approval_handoffs");
  await pool.query("delete from mission_decision_evidence_links");
  await pool.query("delete from conflict_guidance_acknowledgements");
  await pool.query("delete from audit_evidence_snapshots");
  await pool.query("delete from airspace_compliance_inputs");
  await pool.query("delete from mission_risk_inputs");
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
  await pool.query("delete from mission_external_overlays");
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

const createConflictOverlay = async (missionId: string) => {
  const overlayId = randomUUID();

  await pool.query(
    `
    insert into mission_external_overlays (
      id,
      mission_id,
      overlay_kind,
      source_provider,
      source_type,
      source_record_id,
      observed_at,
      geometry_type,
      latitude,
      longitude,
      severity
    )
    values ($1, $2, 'crewed_traffic', 'test-radar', 'adsb', 'traffic-1', $3, 'point', 51.5, -0.12, 'critical')
    `,
    [overlayId, missionId, "2026-04-18T12:00:00.000Z"],
  );

  return overlayId;
};

const createConflictGuidanceAcknowledgement = async (
  missionId: string,
  params?: {
    conflictId?: string;
    guidanceActionCode?: string;
    evidenceAction?: string;
    acknowledgementRole?: string;
    acknowledgedBy?: string;
    acknowledgementNote?: string;
    guidanceSummary?: string;
  },
) => {
  const overlayId = await createConflictOverlay(missionId);
  const response = await request(app)
    .post(`/missions/${missionId}/conflict-guidance-acknowledgements`)
    .send({
      conflictId: params?.conflictId ?? "conflict-critical-export",
      overlayId,
      guidanceActionCode: params?.guidanceActionCode ?? "hold_or_suspend",
      evidenceAction: params?.evidenceAction ?? "record_supervisor_review",
      acknowledgementRole: params?.acknowledgementRole ?? "supervisor",
      acknowledgedBy: params?.acknowledgedBy ?? "ops-supervisor",
      acknowledgementNote:
        params?.acknowledgementNote ??
        "Reviewed for post-operation evidence export.",
      guidanceSummary:
        params?.guidanceSummary ?? "Critical live-ops conflict advisory reviewed.",
    });

  expect(response.status).toBe(201);
  return response.body.acknowledgement as {
    id: string;
    conflictId: string;
    overlayId: string;
    guidanceActionCode: string;
    evidenceAction: string;
    acknowledgementRole: string;
    acknowledgedBy: string;
    acknowledgementNote: string | null;
    pilotInstructionStatus: string;
  };
};

const createRegulatoryAmendmentAlert = async (
  missionId: string,
  params?: {
    acknowledge?: boolean;
    resolve?: boolean;
  },
) => {
  const response = await request(app)
    .post(`/missions/${missionId}/regulatory-amendments`)
    .send({
      sourceDocument: "CAA CAP 722",
      previousVersion: "9.1",
      currentVersion: "9.2",
      publishedAt: "2026-04-18T09:00:00.000Z",
      effectiveFrom: "2026-05-01T00:00:00.000Z",
      amendmentSummary: "Updated operator assessment evidence expectations.",
      changeImpact:
        "Review affected operating safety case and post-operation evidence pack.",
      affectedRequirementRefs: ["CAP722-OSC", "CAP722-Records"],
      reviewAction:
        "Accountable manager to confirm mission evidence remains current.",
    });

  expect(response.status).toBe(201);
  let alert = response.body.alerts[0] as {
    id: string;
    status: string;
    acknowledgedAt: string | null;
    resolvedAt: string | null;
  };

  if (params?.acknowledge) {
    const acknowledgeResponse = await request(app)
      .post(`/missions/${missionId}/alerts/${alert.id}/acknowledge`)
      .send({ acknowledgedAt: "2026-04-18T10:00:00.000Z" });

    expect(acknowledgeResponse.status).toBe(200);
    alert = acknowledgeResponse.body.alert;
  }

  if (params?.resolve) {
    const resolveResponse = await request(app)
      .post(`/missions/${missionId}/alerts/${alert.id}/resolve`)
      .send({ resolvedAt: "2026-04-18T11:00:00.000Z" });

    expect(resolveResponse.status).toBe(200);
    alert = resolveResponse.body.alert;
  }

  return alert;
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
      (select count(*)::int from conflict_guidance_acknowledgements where mission_id = $1) as conflict_guidance_acknowledgement_count,
      (select count(*)::int from post_operation_evidence_snapshots where mission_id = $1) as post_operation_snapshot_count,
      (select count(*)::int from live_ops_map_view_state_snapshots where mission_id = $1) as live_ops_map_view_state_snapshot_count,
      (select count(*)::int from post_operation_audit_signoffs where mission_id = $1) as post_operation_signoff_count,
      (select count(*)::int from mission_decision_evidence_links where mission_id = $1) as decision_link_count,
      (select count(*)::int from mission_events where mission_id = $1) as mission_event_count,
      (select count(*)::int from mission_risk_inputs where mission_id = $1) as risk_input_count,
      (select count(*)::int from airspace_compliance_inputs where mission_id = $1) as airspace_input_count,
      (select count(*)::int from safety_events where mission_id = $1) as safety_event_count,
      (select count(*)::int from safety_action_implementation_evidence evidence
       inner join safety_events events on events.id = evidence.safety_event_id
       where events.mission_id = $1) as safety_action_implementation_evidence_count,
      (select last_event_sequence_no from missions where id = $1) as mission_sequence
    `,
    [missionId],
  );

  return result.rows[0] as {
    mission_status: string;
    snapshot_count: number;
    conflict_guidance_acknowledgement_count: number;
    post_operation_snapshot_count: number;
    live_ops_map_view_state_snapshot_count: number;
    post_operation_signoff_count: number;
    decision_link_count: number;
    mission_event_count: number;
    risk_input_count: number;
    airspace_input_count: number;
    safety_event_count: number;
    safety_action_implementation_evidence_count: number;
    mission_sequence: number;
  };
};

const createSafetyActionClosureEvidence = async (
  missionId: string,
  params?: {
    eventType?: string;
    proposalType?: string;
    evidenceCategory?: string;
    implementationSummary?: string;
    completedAt?: string;
  },
) => {
  const meetingResponse = await request(app)
    .post("/air-safety-meetings")
    .send({
      meetingType: "event_triggered_safety_review",
      dueAt: "2026-04-19T10:00:00.000Z",
      chairperson: "Safety Manager",
    });

  expect(meetingResponse.status).toBe(201);

  const eventResponse = await request(app).post("/safety-events").send({
    eventType: params?.eventType ?? "sop_breach",
    severity: "high",
    missionId,
    eventOccurredAt: "2026-04-18T11:00:00.000Z",
    reportedBy: "safety-manager",
    summary: "Mission safety action requires closure evidence",
    sopReference: "OPS-SOP-LAUNCH-001",
  });

  expect(eventResponse.status).toBe(201);

  const triggerResponse = await request(app)
    .post(`/safety-events/${eventResponse.body.event.id}/meeting-trigger`)
    .send({
      assessedBy: "safety-manager",
    });

  expect(triggerResponse.status).toBe(201);

  const agendaLinkResponse = await request(app)
    .post(`/safety-events/${eventResponse.body.event.id}/meeting-triggers/${triggerResponse.body.trigger.id}/agenda-links`)
    .send({
      airSafetyMeetingId: meetingResponse.body.meeting.id,
      agendaItem: "Review mission safety action closure",
      linkedBy: "safety-coordinator",
    });

  expect(agendaLinkResponse.status).toBe(201);

  const proposalResponse = await request(app)
    .post(`/safety-events/${eventResponse.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals`)
    .send({
      proposalType: params?.proposalType ?? "sop_change",
      summary: "Update launch SOP and brief operators",
      proposedOwner: "Safety Manager",
      proposedDueAt: "2026-05-01T10:00:00.000Z",
      createdBy: "safety-manager",
    });

  expect(proposalResponse.status).toBe(201);

  const acceptResponse = await request(app)
    .post(`/safety-events/${eventResponse.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals/${proposalResponse.body.proposal.id}/decisions`)
    .send({
      decision: "accepted",
      decidedBy: "accountable-manager",
      decisionNotes: "Accepted for implementation.",
    });

  expect(acceptResponse.status).toBe(201);

  const completeResponse = await request(app)
    .post(`/safety-events/${eventResponse.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals/${proposalResponse.body.proposal.id}/decisions`)
    .send({
      decision: "completed",
      decidedBy: "safety-manager",
      decisionNotes: "Implementation completed.",
    });

  expect(completeResponse.status).toBe(201);

  const evidenceResponse = await request(app)
    .post(`/safety-events/${eventResponse.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals/${proposalResponse.body.proposal.id}/implementation-evidence`)
    .send({
      evidenceCategory: params?.evidenceCategory ?? "sop_implementation",
      implementationSummary:
        params?.implementationSummary ?? "Launch SOP update completed",
      evidenceReference: "DOC-OPS-SOP-LAUNCH-002",
      completedBy: "safety-manager",
      completedAt: params?.completedAt ?? "2026-05-02T09:00:00.000Z",
      reviewedBy: "accountable-manager",
      reviewNotes: "Closure evidence accepted for audit pack.",
    });

  expect(evidenceResponse.status).toBe(201);

  return {
    meeting: meetingResponse.body.meeting,
    event: eventResponse.body.event,
    trigger: triggerResponse.body.trigger,
    agendaLink: agendaLinkResponse.body.link,
    proposal: completeResponse.body.proposal,
    acceptDecision: acceptResponse.body.decision,
    completeDecision: completeResponse.body.decision,
    evidence: evidenceResponse.body.evidence,
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
    const beforeMappings = await countSmsMappingRows();

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
        smsControlMappings: expect.arrayContaining([
          expect.objectContaining({
            code: "PLATFORM_READINESS_MAINTENANCE",
            title: "Platform readiness and maintenance controls",
            smsElements: expect.arrayContaining([
              "3.1 Monitoring and Measurement of Safety Performance",
            ]),
          }),
          expect.objectContaining({
            code: "PILOT_READINESS",
            title: "Pilot readiness controls",
            smsElements: expect.arrayContaining(["4.1 Training and education"]),
          }),
          expect.objectContaining({
            code: "MISSION_RISK_ASSESSMENT",
            title: "Mission risk controls",
            smsElements: expect.arrayContaining([
              "2.1 Risk/hazard detection and identification",
            ]),
          }),
          expect.objectContaining({
            code: "AIRSPACE_COMPLIANCE",
            title: "Airspace compliance controls",
            smsElements: expect.arrayContaining([
              "2.1 Risk/hazard detection and identification",
            ]),
          }),
          expect.objectContaining({
            code: "MISSION_READINESS_GATE",
            title: "Mission readiness gate controls",
            smsElements: expect.arrayContaining(["1.5 SMS documentation"]),
          }),
        ]),
      },
    });
    expect(response.body.snapshot.id).toEqual(expect.any(String));
    expect(response.body.snapshot.createdAt).toEqual(expect.any(String));
    expect(response.body.snapshot.readinessSnapshot.smsControlMappings).toHaveLength(
      9,
    );

    expect(await countRows(missionId)).toEqual({
      ...before,
      snapshot_count: before.snapshot_count + 1,
    });
    expect(await countSmsMappingRows()).toEqual(beforeMappings);
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
        smsControlMappings: expect.arrayContaining([
          expect.objectContaining({
            code: "MISSION_READINESS_GATE",
            smsElements: expect.arrayContaining(["1.5 SMS documentation"]),
          }),
        ]),
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

  it("captures live-ops map view-state metadata as audit evidence", async () => {
    const { missionId } = await createReadyMission();
    const before = await countRows(missionId);

    const response = await request(app)
      .post(
        `/missions/${missionId}/live-operations/map-view-state/audit-snapshots`,
      )
      .send({
        replayCursor: "2 / 4",
        replayTimestamp: "2026-04-18T12:01:00.000Z",
        areaFreshnessFilter: "degraded",
        visibleAreaOverlayCount: 2,
        totalAreaOverlayCount: 4,
        degradedAreaOverlayCount: 2,
        openAlertCount: 3,
        activeConflictCount: 1,
        areaRefreshRunCount: 5,
        viewStateUrl:
          "/operator/missions/live-ops-demo/live-operations?areaFreshnessFilter=degraded",
        conflictVectorSourceFocus: "focused",
        conflictVectorMode: "bearing_only_fallback",
        conflictVectorSourceQuality:
          "Bearing-only vector | source partial | synthetic/local demo source",
        conflictVectorOverlayId: "traffic-1",
        conflictVectorOverlayLabel: "Traffic VA-INS-12",
        conflictVectorOverlayKind: "drone_traffic",
        conflictVectorBearingDegrees: 128,
        conflictVectorRangeMeters: 420,
        conflictVectorObservedAt: "2026-04-18T12:00:45.000Z",
        conflictVectorSourcePanel: "#conflict-evidence-panel",
        createdBy: " live-ops-controller ",
      });

    expect(response.status).toBe(201);
    expect(response.body.snapshot).toMatchObject({
      missionId,
      evidenceType: "live_ops_map_view_state",
      replayCursor: "2 / 4",
      replayTimestamp: "2026-04-18T12:01:00.000Z",
      areaFreshnessFilter: "degraded",
      visibleAreaOverlayCount: 2,
      totalAreaOverlayCount: 4,
      degradedAreaOverlayCount: 2,
      openAlertCount: 3,
      activeConflictCount: 1,
      areaRefreshRunCount: 5,
      captureScope: "metadata_only",
      pilotInstructionStatus: "not_a_pilot_command",
      createdBy: "live-ops-controller",
      snapshotMetadata: {
        formatVersion: 1,
        evidenceType: "live_ops_map_view_state",
        captureScope: "metadata_only",
        pilotInstructionStatus: "not_a_pilot_command",
        screenshotStatus: "not_captured",
        fileGenerationStatus: "not_requested",
        viewState: {
          replayCursor: "2 / 4",
          areaFreshnessFilter: "degraded",
          visibleAreaOverlayCount: 2,
          totalAreaOverlayCount: 4,
          degradedAreaOverlayCount: 2,
          openAlertCount: 3,
          activeConflictCount: 1,
          areaRefreshRunCount: 5,
          conflictVector: {
            sourceFocus: "focused",
            mode: "bearing_only_fallback",
            sourceQuality:
              "Bearing-only vector | source partial | synthetic/local demo source",
            overlayId: "traffic-1",
            overlayLabel: "Traffic VA-INS-12",
            overlayKind: "drone_traffic",
            bearingDegrees: 128,
            rangeMeters: 420,
            observedAt: "2026-04-18T12:00:45.000Z",
            sourcePanel: "#conflict-evidence-panel",
          },
        },
      },
    });
    expect(response.body.snapshot.id).toEqual(expect.any(String));
    expect(response.body.snapshot.createdAt).toEqual(expect.any(String));
    expect(await countRows(missionId)).toEqual({
      ...before,
      live_ops_map_view_state_snapshot_count:
        before.live_ops_map_view_state_snapshot_count + 1,
    });
  });

  it("lists live-ops map view-state snapshots for the owning mission only", async () => {
    const first = await createReadyMission();
    const second = await createReadyMission();

    const firstSnapshot = await request(app)
      .post(
        `/missions/${first.missionId}/live-operations/map-view-state/audit-snapshots`,
      )
      .send({
        replayCursor: "1 / 3",
        replayTimestamp: null,
        areaFreshnessFilter: "all",
        visibleAreaOverlayCount: 3,
        totalAreaOverlayCount: 3,
        degradedAreaOverlayCount: 1,
        openAlertCount: 0,
        activeConflictCount: 0,
        areaRefreshRunCount: 1,
      });
    const secondSnapshot = await request(app)
      .post(
        `/missions/${second.missionId}/live-operations/map-view-state/audit-snapshots`,
      )
      .send({
        replayCursor: "2 / 3",
        areaFreshnessFilter: "hidden",
        visibleAreaOverlayCount: 0,
        totalAreaOverlayCount: 3,
        degradedAreaOverlayCount: 1,
        openAlertCount: 1,
        activeConflictCount: 1,
        areaRefreshRunCount: 1,
      });

    expect(firstSnapshot.status).toBe(201);
    expect(secondSnapshot.status).toBe(201);

    const response = await request(app).get(
      `/missions/${first.missionId}/live-operations/map-view-state/audit-snapshots`,
    );

    expect(response.status).toBe(200);
    expect(response.body.snapshots).toHaveLength(1);
    expect(response.body.snapshots[0]).toMatchObject({
      id: firstSnapshot.body.snapshot.id,
      missionId: first.missionId,
      replayCursor: "1 / 3",
      areaFreshnessFilter: "all",
    });
  });

  it("rejects invalid live-ops map view-state snapshot metadata", async () => {
    const { missionId } = await createReadyMission();
    const before = await countRows(missionId);

    const unsupportedFilterResponse = await request(app)
      .post(
        `/missions/${missionId}/live-operations/map-view-state/audit-snapshots`,
      )
      .send({
        replayCursor: "1 / 2",
        areaFreshnessFilter: "stale",
        visibleAreaOverlayCount: 1,
        totalAreaOverlayCount: 2,
        degradedAreaOverlayCount: 1,
        openAlertCount: 0,
        activeConflictCount: 0,
        areaRefreshRunCount: 0,
      });
    const impossibleCountsResponse = await request(app)
      .post(
        `/missions/${missionId}/live-operations/map-view-state/audit-snapshots`,
      )
      .send({
        replayCursor: "3 / 2",
        areaFreshnessFilter: "all",
        visibleAreaOverlayCount: 3,
        totalAreaOverlayCount: 2,
        degradedAreaOverlayCount: 1,
        openAlertCount: 0,
        activeConflictCount: 0,
        areaRefreshRunCount: 0,
      });

    expect(unsupportedFilterResponse.status).toBe(400);
    expect(impossibleCountsResponse.status).toBe(400);
    expect(await countRows(missionId)).toEqual(before);
  });

  it("returns 404 for unknown live-ops map view-state snapshot missions", async () => {
    const missingMissionId = randomUUID();

    const createResponse = await request(app)
      .post(
        `/missions/${missingMissionId}/live-operations/map-view-state/audit-snapshots`,
      )
      .send({
        replayCursor: "1 / 1",
        areaFreshnessFilter: "all",
        visibleAreaOverlayCount: 0,
        totalAreaOverlayCount: 0,
        degradedAreaOverlayCount: 0,
        openAlertCount: 0,
        activeConflictCount: 0,
        areaRefreshRunCount: 0,
      });
    const listResponse = await request(app).get(
      `/missions/${missingMissionId}/live-operations/map-view-state/audit-snapshots`,
    );

    expect(createResponse.status).toBe(404);
    expect(listResponse.status).toBe(404);
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

  it("records conflict guidance acknowledgements as decision-support evidence", async () => {
    const { missionId } = await createReadyMission();
    const overlayId = await createConflictOverlay(missionId);
    const before = await countRows(missionId);

    const response = await request(app)
      .post(`/missions/${missionId}/conflict-guidance-acknowledgements`)
      .send({
        conflictId: " conflict-critical-1 ",
        overlayId,
        guidanceActionCode: "hold_or_suspend",
        evidenceAction: "record_supervisor_review",
        acknowledgementRole: "supervisor",
        acknowledgedBy: " ops-supervisor ",
        acknowledgementNote: " Supervisor reviewed the advisory. ",
        guidanceSummary: " Critical crewed traffic conflict advisory. ",
      });

    expect(response.status).toBe(201);
    expect(response.body.acknowledgement).toMatchObject({
      missionId,
      conflictId: "conflict-critical-1",
      overlayId,
      guidanceActionCode: "hold_or_suspend",
      evidenceAction: "record_supervisor_review",
      acknowledgementRole: "supervisor",
      acknowledgedBy: "ops-supervisor",
      acknowledgementNote: "Supervisor reviewed the advisory.",
      guidanceSummary: "Critical crewed traffic conflict advisory.",
      pilotInstructionStatus: "not_a_pilot_command",
    });
    expect(response.body.acknowledgement.id).toEqual(expect.any(String));
    expect(response.body.acknowledgement.createdAt).toEqual(expect.any(String));
    expect(await countRows(missionId)).toEqual({
      ...before,
      conflict_guidance_acknowledgement_count:
        before.conflict_guidance_acknowledgement_count + 1,
    });
  });

  it("lists conflict guidance acknowledgements only for the requested mission", async () => {
    const first = await createReadyMission();
    const second = await createReadyMission();
    const firstOverlayId = await createConflictOverlay(first.missionId);
    const secondOverlayId = await createConflictOverlay(second.missionId);

    const firstResponse = await request(app)
      .post(`/missions/${first.missionId}/conflict-guidance-acknowledgements`)
      .send({
        conflictId: "first-conflict",
        overlayId: firstOverlayId,
        guidanceActionCode: "prepare_deconfliction",
        evidenceAction: "record_operator_review",
        acknowledgementRole: "operator",
        acknowledgedBy: "operator-a",
        guidanceSummary: "Operator reviewed separation advisory.",
      });
    const secondResponse = await request(app)
      .post(`/missions/${second.missionId}/conflict-guidance-acknowledgements`)
      .send({
        conflictId: "second-conflict",
        overlayId: secondOverlayId,
        guidanceActionCode: "hold_or_suspend",
        evidenceAction: "record_supervisor_review",
        acknowledgementRole: "supervisor",
        acknowledgedBy: "supervisor-b",
        guidanceSummary: "Supervisor reviewed hold-or-suspend advisory.",
      });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);

    const response = await request(app).get(
      `/missions/${first.missionId}/conflict-guidance-acknowledgements`,
    );

    expect(response.status).toBe(200);
    expect(response.body.acknowledgements).toHaveLength(1);
    expect(response.body.acknowledgements[0]).toMatchObject({
      missionId: first.missionId,
      conflictId: "first-conflict",
      overlayId: firstOverlayId,
      evidenceAction: "record_operator_review",
      pilotInstructionStatus: "not_a_pilot_command",
    });
  });

  it("rejects duplicate conflict guidance acknowledgements for the same overlay and guidance", async () => {
    const { missionId } = await createReadyMission();
    const overlayId = await createConflictOverlay(missionId);
    const endpoint = `/missions/${missionId}/conflict-guidance-acknowledgements`;

    const firstResponse = await request(app).post(endpoint).send({
      conflictId: "first-conflict-id",
      overlayId,
      guidanceActionCode: "hold_or_suspend",
      evidenceAction: "record_supervisor_review",
      acknowledgementRole: "supervisor",
      acknowledgedBy: "supervisor-a",
      guidanceSummary: "Supervisor reviewed initial duplicate advisory.",
    });
    const beforeDuplicate = await countRows(missionId);
    const duplicateResponse = await request(app).post(endpoint).send({
      conflictId: "new-assessment-conflict-id",
      overlayId,
      guidanceActionCode: "hold_or_suspend",
      evidenceAction: "record_supervisor_review",
      acknowledgementRole: "supervisor",
      acknowledgedBy: "supervisor-b",
      guidanceSummary: "Supervisor reviewed duplicate advisory.",
    });

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body).toMatchObject({
      error: {
        type: "conflict_guidance_acknowledgement_already_exists",
      },
    });
    expect(await countRows(missionId)).toEqual(beforeDuplicate);
  });

  it("rejects invalid conflict guidance acknowledgement requests", async () => {
    const { missionId } = await createReadyMission();
    const overlayId = await createConflictOverlay(missionId);
    const before = await countRows(missionId);

    const missingActorResponse = await request(app)
      .post(`/missions/${missionId}/conflict-guidance-acknowledgements`)
      .send({
        conflictId: "conflict-a",
        overlayId,
        guidanceActionCode: "review_separation",
        evidenceAction: "record_operator_review",
        acknowledgementRole: "operator",
        guidanceSummary: "Operator review required.",
      });
    const missingGuidanceSummaryResponse = await request(app)
      .post(`/missions/${missionId}/conflict-guidance-acknowledgements`)
      .send({
        conflictId: "conflict-summary",
        overlayId,
        guidanceActionCode: "review_separation",
        evidenceAction: "record_operator_review",
        acknowledgementRole: "operator",
        acknowledgedBy: "operator-a",
        guidanceSummary: " ",
      });
    const monitorResponse = await request(app)
      .post(`/missions/${missionId}/conflict-guidance-acknowledgements`)
      .send({
        conflictId: "conflict-b",
        overlayId,
        guidanceActionCode: "monitor_context",
        evidenceAction: "none",
        acknowledgementRole: "operator",
        acknowledgedBy: "operator-a",
        guidanceSummary: "Monitor action is not acknowledgement evidence.",
      });
    const supervisorEvidenceByOperatorResponse = await request(app)
      .post(`/missions/${missionId}/conflict-guidance-acknowledgements`)
      .send({
        conflictId: "conflict-c",
        overlayId,
        guidanceActionCode: "hold_or_suspend",
        evidenceAction: "record_supervisor_review",
        acknowledgementRole: "operator",
        acknowledgedBy: "operator-a",
        guidanceSummary: "Supervisor evidence cannot be acknowledged by operator.",
      });
    const operatorEvidenceBySupervisorResponse = await request(app)
      .post(`/missions/${missionId}/conflict-guidance-acknowledgements`)
      .send({
        conflictId: "conflict-d",
        overlayId,
        guidanceActionCode: "review_separation",
        evidenceAction: "record_operator_review",
        acknowledgementRole: "supervisor",
        acknowledgedBy: "supervisor-a",
        guidanceSummary: "Operator evidence cannot be acknowledged by supervisor.",
      });

    expect(missingActorResponse.status).toBe(400);
    expect(missingGuidanceSummaryResponse.status).toBe(400);
    expect(monitorResponse.status).toBe(400);
    expect(supervisorEvidenceByOperatorResponse.status).toBe(400);
    expect(operatorEvidenceBySupervisorResponse.status).toBe(400);
    expect(await countRows(missionId)).toEqual(before);
  });

  it("does not acknowledge conflict guidance for another mission overlay", async () => {
    const first = await createReadyMission();
    const second = await createReadyMission();
    const secondOverlayId = await createConflictOverlay(second.missionId);
    const firstBefore = await countRows(first.missionId);
    const secondBefore = await countRows(second.missionId);

    const response = await request(app)
      .post(`/missions/${first.missionId}/conflict-guidance-acknowledgements`)
      .send({
        conflictId: "wrong-overlay-conflict",
        overlayId: secondOverlayId,
        guidanceActionCode: "hold_or_suspend",
        evidenceAction: "record_supervisor_review",
        acknowledgementRole: "supervisor",
        acknowledgedBy: "supervisor-a",
        guidanceSummary: "Supervisor reviewed the wrong overlay reference.",
      });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "conflict_guidance_overlay_not_found",
      },
    });
    expect(await countRows(first.missionId)).toEqual(firstBefore);
    expect(await countRows(second.missionId)).toEqual(secondBefore);
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
    expect(response.body.export.liveOpsMapViewStateSnapshots).toEqual([]);
    expect(response.body.export.conflictGuidanceAcknowledgements).toEqual([]);
    expect(response.body.export.safetyActionClosureEvidence).toEqual([]);
    expect(response.body.export.regulatoryAmendmentAlerts).toEqual([]);
    expect(await countRows(missionId)).toEqual(before);
  });

  it("exports live-ops map view-state snapshots in post-operation evidence", async () => {
    const { missionId } = await createCompletedMission();
    const mapSnapshotResponse = await request(app)
      .post(
        `/missions/${missionId}/live-operations/map-view-state/audit-snapshots`,
      )
      .send({
        replayCursor: "3 / 5",
        replayTimestamp: "2026-04-18T12:03:00.000Z",
        areaFreshnessFilter: "degraded",
        visibleAreaOverlayCount: 2,
        totalAreaOverlayCount: 4,
        degradedAreaOverlayCount: 2,
        openAlertCount: 3,
        activeConflictCount: 1,
        areaRefreshRunCount: 5,
        viewStateUrl:
          "/operator/missions/live-ops-demo/live-operations?areaFreshnessFilter=degraded",
        createdBy: "live-ops-ui",
      });
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(mapSnapshotResponse.status).toBe(201);
    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.liveOpsMapViewStateSnapshots).toHaveLength(1);
    expect(response.body.export.liveOpsMapViewStateSnapshots[0]).toMatchObject({
      id: mapSnapshotResponse.body.snapshot.id,
      missionId,
      evidenceType: "live_ops_map_view_state",
      replayCursor: "3 / 5",
      replayTimestamp: "2026-04-18T12:03:00.000Z",
      areaFreshnessFilter: "degraded",
      visibleAreaOverlayCount: 2,
      totalAreaOverlayCount: 4,
      degradedAreaOverlayCount: 2,
      openAlertCount: 3,
      activeConflictCount: 1,
      areaRefreshRunCount: 5,
      captureScope: "metadata_only",
      pilotInstructionStatus: "not_a_pilot_command",
      createdBy: "live-ops-ui",
      snapshotMetadata: {
        screenshotStatus: "not_captured",
        fileGenerationStatus: "not_requested",
      },
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("exports live conflict guidance acknowledgements in post-operation evidence", async () => {
    const { missionId } = await createCompletedMission();
    const acknowledgement = await createConflictGuidanceAcknowledgement(
      missionId,
      {
        conflictId: "conflict-export-1",
        acknowledgedBy: "night-ops-supervisor",
        acknowledgementNote: "Supervisor acknowledged the live-ops advisory.",
      },
    );
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.conflictGuidanceAcknowledgements).toHaveLength(1);
    expect(response.body.export.conflictGuidanceAcknowledgements[0]).toMatchObject({
      id: acknowledgement.id,
      missionId,
      conflictId: "conflict-export-1",
      overlayId: acknowledgement.overlayId,
      guidanceActionCode: "hold_or_suspend",
      evidenceAction: "record_supervisor_review",
      acknowledgementRole: "supervisor",
      acknowledgedBy: "night-ops-supervisor",
      acknowledgementNote: "Supervisor acknowledged the live-ops advisory.",
      pilotInstructionStatus: "not_a_pilot_command",
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("exports regulatory amendment alert review state in post-operation evidence", async () => {
    const { missionId } = await createCompletedMission();
    const alert = await createRegulatoryAmendmentAlert(missionId, {
      acknowledge: true,
      resolve: true,
    });
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.regulatoryAmendmentAlerts).toHaveLength(1);
    expect(response.body.export.regulatoryAmendmentAlerts[0]).toMatchObject({
      id: alert.id,
      status: "resolved",
      severity: "warning",
      message:
        "Regulatory amendment detected: CAA CAP 722 9.1 -> 9.2",
      sourceDocument: "CAA CAP 722",
      previousVersion: "9.1",
      currentVersion: "9.2",
      publishedAt: "2026-04-18T09:00:00.000Z",
      effectiveFrom: "2026-05-01T00:00:00.000Z",
      amendmentSummary: "Updated operator assessment evidence expectations.",
      changeImpact:
        "Review affected operating safety case and post-operation evidence pack.",
      affectedRequirementRefs: ["CAP722-OSC", "CAP722-Records"],
      reviewAction:
        "Accountable manager to confirm mission evidence remains current.",
      triggeredAt: "2026-04-18T09:00:00.000Z",
      acknowledgedAt: "2026-04-18T10:00:00.000Z",
      resolvedAt: "2026-04-18T11:00:00.000Z",
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("exports safety action closure evidence context for mission-linked safety events", async () => {
    const { missionId } = await createCompletedMission();
    const closure = await createSafetyActionClosureEvidence(missionId);
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.safetyActionClosureEvidence).toHaveLength(1);
    expect(response.body.export.safetyActionClosureEvidence[0]).toMatchObject({
      safetyEventId: closure.event.id,
      eventType: "sop_breach",
      eventSeverity: "high",
      eventStatus: "open",
      eventSummary: "Mission safety action requires closure evidence",
      eventOccurredAt: "2026-04-18T11:00:00.000Z",
      sopReference: "OPS-SOP-LAUNCH-001",
      safetyEventMeetingTriggerId: closure.trigger.id,
      airSafetyMeetingId: closure.meeting.id,
      safetyEventAgendaLinkId: closure.agendaLink.id,
      agendaItem: "Review mission safety action closure",
      safetyActionProposalId: closure.proposal.id,
      proposalType: "sop_change",
      proposalStatus: "completed",
      proposalSummary: "Update launch SOP and brief operators",
      proposalOwner: "Safety Manager",
      proposalDueAt: "2026-05-01T10:00:00.000Z",
      implementationEvidenceId: closure.evidence.id,
      evidenceCategory: "sop_implementation",
      implementationSummary: "Launch SOP update completed",
      evidenceReference: "DOC-OPS-SOP-LAUNCH-002",
      completedBy: "safety-manager",
      completedAt: "2026-05-02T09:00:00.000Z",
      reviewedBy: "accountable-manager",
      reviewNotes: "Closure evidence accepted for audit pack.",
    });
    expect(
      response.body.export.safetyActionClosureEvidence[0].decisions,
    ).toEqual([
      expect.objectContaining({
        id: closure.acceptDecision.id,
        decision: "accepted",
        decidedBy: "accountable-manager",
        decisionNotes: "Accepted for implementation.",
      }),
      expect.objectContaining({
        id: closure.completeDecision.id,
        decision: "completed",
        decidedBy: "safety-manager",
        decisionNotes: "Implementation completed.",
      }),
    ]);
    expect(await countRows(missionId)).toEqual(before);
  });

  it("returns post-operation evidence readiness prompts without mutating audit state", async () => {
    const { missionId } = await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/readiness`,
    );

    expect(response.status).toBe(200);
    expect(response.body.readiness).toMatchObject({
      missionId,
      snapshotId: snapshotResponse.body.snapshot.id,
      lifecycleState: "completed",
      completionStatus: "completed",
      evidenceCapturedAt: snapshotResponse.body.snapshot.createdAt,
      signoff: {
        status: "pending",
        reviewDecision: null,
        signoffId: null,
        signedAt: null,
      },
      summary: {
        hasLiveOpsMapViewStateSnapshots: false,
        hasConflictGuidanceAcknowledgements: false,
        hasSafetyActionClosureEvidence: false,
        hasRegulatoryAmendmentReviews: false,
        emptyCategoryCount: 4,
        message:
          "Empty categories are review prompts only and do not automatically reject the evidence pack or certify compliance.",
      },
    });
    expect(response.body.readiness.categories).toEqual([
      expect.objectContaining({
        key: "live_ops_map_view_state_snapshots",
        label: "Live-ops map view-state snapshots",
        count: 0,
        status: "not_recorded",
        sourceRecords: [],
        message:
          "No live-ops map view-state metadata is recorded in this evidence pack; this is a review prompt only, not an automatic rejection or compliance certificate.",
      }),
      expect.objectContaining({
        key: "conflict_guidance_acknowledgements",
        count: 0,
        status: "not_recorded",
      }),
      expect.objectContaining({
        key: "safety_action_closure_evidence",
        count: 0,
        status: "not_recorded",
      }),
      expect.objectContaining({
        key: "regulatory_amendment_reviews",
        count: 0,
        status: "not_recorded",
      }),
    ]);
    expect(await countRows(missionId)).toEqual(before);
  });

  it("summarizes post-operation evidence readiness with records and sign-off state", async () => {
    const { missionId } = await createCompletedMission();
    const mapSnapshotResponse = await request(app)
      .post(
        `/missions/${missionId}/live-operations/map-view-state/audit-snapshots`,
      )
      .send({
        replayCursor: "2 / 4",
        replayTimestamp: "2026-04-18T12:01:00.000Z",
        areaFreshnessFilter: "degraded",
        visibleAreaOverlayCount: 2,
        totalAreaOverlayCount: 4,
        degradedAreaOverlayCount: 2,
        openAlertCount: 3,
        activeConflictCount: 1,
        areaRefreshRunCount: 5,
      });
    expect(mapSnapshotResponse.status).toBe(201);
    const acknowledgement = await createConflictGuidanceAcknowledgement(missionId, {
      conflictId: "conflict-readiness-1",
    });
    const closure = await createSafetyActionClosureEvidence(missionId);
    const alert = await createRegulatoryAmendmentAlert(missionId, {
      acknowledge: true,
    });
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const signoffResponse = await request(app)
      .post(
        `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/signoffs`,
      )
      .send({
        accountableManagerName: "Alex Accountable",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-18T18:00:00.000Z",
        signatureReference: "signature://accountable-manager/alex",
        createdBy: "audit-admin",
      });

    expect(signoffResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/readiness`,
    );

    expect(response.status).toBe(200);
    expect(response.body.readiness).toMatchObject({
      missionId,
      snapshotId: snapshotResponse.body.snapshot.id,
      signoff: {
        status: "recorded",
        reviewDecision: "approved",
        signoffId: signoffResponse.body.signoff.id,
        signedAt: "2026-04-18T18:00:00.000Z",
      },
      summary: {
        hasLiveOpsMapViewStateSnapshots: true,
        hasConflictGuidanceAcknowledgements: true,
        hasSafetyActionClosureEvidence: true,
        hasRegulatoryAmendmentReviews: true,
        emptyCategoryCount: 0,
        message:
          "All tracked evidence categories have records for accountable-manager review.",
      },
    });
    expect(response.body.readiness.categories).toEqual([
      expect.objectContaining({
        key: "live_ops_map_view_state_snapshots",
        label: "Live-ops map view-state snapshots",
        count: 1,
        status: "present",
        sourceRecords: [
          expect.objectContaining({
            id: mapSnapshotResponse.body.snapshot.id,
            label: "Map view-state snapshot",
            apiUrl: `/missions/${missionId}/live-operations/map-view-state/audit-snapshots`,
            reviewUrl: `/operator/missions/${missionId}/live-operations?mapEvidenceId=${mapSnapshotResponse.body.snapshot.id}`,
          }),
        ],
        message:
          "Live-ops map view-state metadata is included for accountable-manager review; it is metadata-only evidence and not pilot command guidance.",
      }),
      expect.objectContaining({
        key: "conflict_guidance_acknowledgements",
        count: 1,
        status: "present",
        sourceRecords: [
          expect.objectContaining({
            id: acknowledgement.id,
            label: "Conflict acknowledgement",
            apiUrl: `/missions/${missionId}/conflict-guidance-acknowledgements`,
            reviewUrl: `/operator/missions/${missionId}/live-operations?conflictAcknowledgementId=${acknowledgement.id}`,
          }),
        ],
      }),
      expect.objectContaining({
        key: "safety_action_closure_evidence",
        count: 1,
        status: "present",
        sourceRecords: [
          expect.objectContaining({
            id: closure.evidence.id,
            label: "Safety action implementation evidence",
            apiUrl: `/safety-events/${closure.event.id}/agenda-links/${closure.agendaLink.id}/action-proposals/${closure.proposal.id}/implementation-evidence`,
            reviewUrl: `/operator/mission-workspace?missionId=${missionId}#timeline-panel`,
          }),
        ],
      }),
      expect.objectContaining({
        key: "regulatory_amendment_reviews",
        count: 1,
        status: "present",
        sourceRecords: [
          expect.objectContaining({
            id: alert.id,
            label: "Regulatory amendment alert",
            apiUrl: `/missions/${missionId}/alerts`,
            reviewUrl: `/operator/mission-workspace?missionId=${missionId}#regulatory-matrix-panel`,
          }),
        ],
      }),
    ]);
    expect(await countRows(missionId)).toEqual(before);
  });

  it("does not leak safety action closure evidence from other missions", async () => {
    const first = await createCompletedMission();
    const second = await createCompletedMission();
    await createSafetyActionClosureEvidence(second.missionId);
    const firstSnapshot = await request(app)
      .post(`/missions/${first.missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(firstSnapshot.status).toBe(201);
    const firstBefore = await countRows(first.missionId);
    const secondBefore = await countRows(second.missionId);

    const response = await request(app).get(
      `/missions/${first.missionId}/post-operation/evidence-snapshots/${firstSnapshot.body.snapshot.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.safetyActionClosureEvidence).toEqual([]);
    expect(await countRows(first.missionId)).toEqual(firstBefore);
    expect(await countRows(second.missionId)).toEqual(secondBefore);
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
            fields: expect.arrayContaining([
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
              { label: "Sign-off record ID", value: "Pending sign-off" },
              { label: "Sign-off recorded by", value: "Pending sign-off" },
              { label: "Sign-off recorded at", value: "Pending sign-off" },
            ]),
          },
          {
            heading: "Evidence readiness summary",
            fields: expect.arrayContaining([
              {
                label: "Readiness boundary",
                value:
                  "Evidence readiness categories are review prompts only and do not automatically reject the evidence pack or certify compliance.",
              },
              {
                label: "Sign-off separation",
                value:
                  "Accountable-manager sign-off remains separate from evidence category readiness.",
              },
              {
                label: "Live-ops map view-state snapshots count",
                value: 0,
              },
              {
                label: "Live-ops map view-state snapshots status",
                value: "not_recorded",
              },
              {
                label: "Conflict guidance acknowledgements count",
                value: 0,
              },
              {
                label: "Safety action closure evidence count",
                value: 0,
              },
              {
                label: "Regulatory amendment reviews count",
                value: 0,
              },
            ]),
          },
          {
            heading: "Live-ops map view-state evidence",
            fields: [
              {
                label: "Live-ops map view-state evidence",
                value: "No live-ops map view-state snapshots recorded",
              },
              {
                label: "Map view-state evidence boundary",
                value:
                  "Metadata-only evidence; no screenshot/file capture and not pilot command guidance.",
              },
            ],
          },
          {
            heading: "Live conflict guidance acknowledgements",
            fields: [
              {
                label: "Live conflict guidance acknowledgements",
                value: "No live conflict guidance acknowledgements recorded",
              },
            ],
          },
          {
            heading: "Safety action closure evidence",
            fields: [
              {
                label: "Safety action closure evidence",
                value: "No safety action closure evidence recorded",
              },
            ],
          },
          {
            heading: "Regulatory amendment alert review",
            fields: [
              {
                label: "Regulatory amendment alerts",
                value: "No regulatory amendment alerts recorded",
              },
            ],
          },
          {
            heading: "SMS assurance context",
            fields: expect.arrayContaining([
              expect.objectContaining({
                label: "Platform readiness and maintenance controls",
                value: expect.stringContaining(
                  "2.2 Assessment and mitigation of risks",
                ),
              }),
              expect.objectContaining({
                label: "Post-operation report and sign-off controls",
                value: expect.stringContaining("1.2 The ultimate responsibility"),
              }),
            ]),
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
    expect(response.body.report.report.plainText).toContain(
      "Evidence readiness summary",
    );
    expect(response.body.report.report.plainText).toContain(
      "Readiness boundary: Evidence readiness categories are review prompts only and do not automatically reject the evidence pack or certify compliance.",
    );
    expect(response.body.report.report.plainText).toContain(
      "Sign-off separation: Accountable-manager sign-off remains separate from evidence category readiness.",
    );
    expect(response.body.report.report.plainText).toContain(
      "Live-ops map view-state snapshots status: not_recorded",
    );
    expect(response.body.report.report.plainText).toContain(
      "Live-ops map view-state evidence: No live-ops map view-state snapshots recorded",
    );
    expect(response.body.report.report.plainText).toContain(
      "Map view-state evidence boundary: Metadata-only evidence; no screenshot/file capture and not pilot command guidance.",
    );
    expect(response.body.report.report.plainText).toContain(
      "Live conflict guidance acknowledgements: No live conflict guidance acknowledgements recorded",
    );
    expect(response.body.report.report.plainText).toContain(
      "Safety action closure evidence: No safety action closure evidence recorded",
    );
    expect(response.body.report.report.plainText).toContain(
      "SMS assurance context",
    );
    expect(response.body.report.report.plainText).toContain(
      "Platform readiness and maintenance controls",
    );
    expect(response.body.report.report.plainText).toContain(
      "Post-operation report and sign-off controls",
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("renders live-ops map view-state snapshots in post-operation reports", async () => {
    const { missionId } = await createCompletedMission();
    const mapSnapshotResponse = await request(app)
      .post(
        `/missions/${missionId}/live-operations/map-view-state/audit-snapshots`,
      )
      .send({
        replayCursor: "3 / 5",
        replayTimestamp: "2026-04-18T12:03:00.000Z",
        areaFreshnessFilter: "degraded",
        visibleAreaOverlayCount: 2,
        totalAreaOverlayCount: 4,
        degradedAreaOverlayCount: 2,
        openAlertCount: 3,
        activeConflictCount: 1,
        areaRefreshRunCount: 5,
        viewStateUrl:
          "/operator/missions/live-ops-demo/live-operations?areaFreshnessFilter=degraded",
      });
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(mapSnapshotResponse.status).toBe(201);
    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report.report.sections).toContainEqual({
      heading: "Evidence readiness summary",
      fields: expect.arrayContaining([
        {
          label: "Live-ops map view-state snapshots count",
          value: 1,
        },
        {
          label: "Live-ops map view-state snapshots status",
          value: "present",
        },
        {
          label: "Live-ops map view-state snapshots review prompt",
          value:
            "Live-ops map view-state metadata is included for accountable-manager review; it is metadata-only evidence and not pilot command guidance.",
        },
        {
          label: "Conflict guidance acknowledgements status",
          value: "not_recorded",
        },
      ]),
    });
    expect(response.body.report.report.sections).toContainEqual({
      heading: "Live-ops map view-state evidence",
      fields: expect.arrayContaining([
        {
          label: "Map view-state snapshot 1 ID",
          value: mapSnapshotResponse.body.snapshot.id,
        },
        {
          label: "Map view-state snapshot 1 replay cursor",
          value: "3 / 5",
        },
        {
          label: "Map view-state snapshot 1 area freshness filter",
          value: "degraded",
        },
        {
          label: "Map view-state snapshot 1 area overlays",
          value: "2/4 visible; 2 degraded",
        },
        {
          label: "Map view-state snapshot 1 alerts and conflicts",
          value: "3 open alerts; 1 active conflicts",
        },
        {
          label: "Map view-state snapshot 1 capture scope",
          value: "metadata_only",
        },
        {
          label: "Map view-state snapshot 1 pilot instruction status",
          value: "not_a_pilot_command",
        },
        {
          label: "Map view-state snapshot 1 evidence boundary",
          value:
            "Metadata-only evidence; no screenshot/file capture and not pilot command guidance.",
        },
      ]),
    });
    expect(response.body.report.report.plainText).toContain(
      "Live-ops map view-state evidence",
    );
    expect(response.body.report.report.plainText).toContain(
      "Live-ops map view-state snapshots status: present",
    );
    expect(response.body.report.report.plainText).toContain(
      "Live-ops map view-state snapshots review prompt: Live-ops map view-state metadata is included for accountable-manager review; it is metadata-only evidence and not pilot command guidance.",
    );
    expect(response.body.report.report.plainText).toContain(
      "Map view-state snapshot 1 replay cursor: 3 / 5",
    );
    expect(response.body.report.report.plainText).toContain(
      "Map view-state snapshot 1 area overlays: 2/4 visible; 2 degraded",
    );
    expect(response.body.report.report.plainText).toContain(
      "Map view-state snapshot 1 pilot instruction status: not_a_pilot_command",
    );
    expect(response.body.report.report.plainText).toContain(
      "Map view-state snapshot 1 evidence boundary: Metadata-only evidence; no screenshot/file capture and not pilot command guidance.",
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("renders live conflict guidance acknowledgements in post-operation reports", async () => {
    const { missionId } = await createCompletedMission();
    const acknowledgement = await createConflictGuidanceAcknowledgement(
      missionId,
      {
        conflictId: "conflict-report-1",
        acknowledgedBy: "report-supervisor",
        acknowledgementNote: "Included in post-operation report.",
        guidanceSummary:
          "Critical conflict advisory reviewed before accountable-manager sign-off.",
      },
    );
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report.report.sections).toContainEqual({
      heading: "Live conflict guidance acknowledgements",
      fields: expect.arrayContaining([
        {
          label: "Conflict acknowledgement 1 ID",
          value: acknowledgement.id,
        },
        {
          label: "Conflict acknowledgement 1 conflict ID",
          value: "conflict-report-1",
        },
        {
          label: "Conflict acknowledgement 1 action code",
          value: "hold_or_suspend",
        },
        {
          label: "Conflict acknowledgement 1 guidance summary",
          value:
            "Critical conflict advisory reviewed before accountable-manager sign-off.",
        },
        {
          label: "Conflict acknowledgement 1 pilot instruction status",
          value: "not_a_pilot_command",
        },
      ]),
    });
    expect(response.body.report.report.plainText).toContain(
      "Live conflict guidance acknowledgements",
    );
    expect(response.body.report.report.plainText).toContain(
      "Conflict acknowledgement 1 acknowledged by: report-supervisor",
    );
    expect(response.body.report.report.plainText).toContain(
      "Conflict acknowledgement 1 guidance summary: Critical conflict advisory reviewed before accountable-manager sign-off.",
    );
    expect(response.body.report.report.plainText).toContain(
      "Conflict acknowledgement 1 pilot instruction status: not_a_pilot_command",
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("renders regulatory amendment alert reviews in post-operation reports", async () => {
    const { missionId } = await createCompletedMission();
    const alert = await createRegulatoryAmendmentAlert(missionId, {
      acknowledge: true,
    });
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report.report.sections).toContainEqual({
      heading: "Regulatory amendment alert review",
      fields: expect.arrayContaining([
        {
          label: "Regulatory amendment alert 1 ID",
          value: alert.id,
        },
        {
          label: "Regulatory amendment alert 1 status",
          value: "acknowledged",
        },
        {
          label: "Regulatory amendment alert 1 source",
          value: "CAA CAP 722",
        },
        {
          label: "Regulatory amendment alert 1 version change",
          value: "9.1 -> 9.2",
        },
        {
          label: "Regulatory amendment alert 1 affected references",
          value: "CAP722-OSC, CAP722-Records",
        },
        {
          label: "Regulatory amendment alert 1 acknowledged at",
          value: "2026-04-18T10:00:00.000Z",
        },
      ]),
    });
    expect(response.body.report.report.plainText).toContain(
      "Regulatory amendment alert review",
    );
    expect(response.body.report.report.plainText).toContain(
      "Regulatory amendment alert 1 review action: Accountable manager to confirm mission evidence remains current.",
    );
    expect(response.body.report.report.plainText).toContain(
      "Regulatory amendment alert 1 affected references: CAP722-OSC, CAP722-Records",
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("renders stored accountable-manager sign-offs without mutating audit state", async () => {
    const { missionId } = await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);

    const signoffResponse = await request(app)
      .post(
        `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/signoffs`,
      )
      .send({
        accountableManagerName: "Alex Accountable",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-18T18:00:00.000Z",
        signatureReference: "signature://accountable-manager/alex",
        createdBy: "audit-admin",
      });

    expect(signoffResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report.report.sections).toContainEqual({
      heading: "Accountable manager sign-off",
      fields: expect.arrayContaining([
        { label: "Accountable manager name", value: "Alex Accountable" },
        { label: "Role/title", value: "Accountable Manager" },
        {
          label: "Signature",
          value: "signature://accountable-manager/alex",
        },
        { label: "Signed date/time", value: "2026-04-18T18:00:00.000Z" },
        { label: "Review decision/status", value: "approved" },
        { label: "Sign-off record ID", value: signoffResponse.body.signoff.id },
        { label: "Sign-off recorded by", value: "audit-admin" },
        {
          label: "Sign-off recorded at",
          value: signoffResponse.body.signoff.createdAt,
        },
      ]),
    });
    expect(response.body.report.report.plainText).toContain(
      "Accountable manager name: Alex Accountable",
    );
    expect(response.body.report.report.plainText).toContain(
      "Review decision/status: approved",
    );
    expect(response.body.report.report.plainText).toContain(
      `Sign-off record ID: ${signoffResponse.body.signoff.id}`,
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("renders safety action closure evidence in post-operation reports", async () => {
    const { missionId } = await createCompletedMission();
    await createSafetyActionClosureEvidence(missionId, {
      evidenceCategory: "training_completion",
      proposalType: "training_action",
      implementationSummary: "Crew refresher training completed",
    });
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({ createdBy: "accountable-manager" });

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report.report.sections).toContainEqual({
      heading: "Safety action closure evidence",
      fields: expect.arrayContaining([
        {
          label: "Closure 1 evidence category",
          value: "training_completion",
        },
        {
          label: "Closure 1 implementation summary",
          value: "Crew refresher training completed",
        },
        {
          label: "Closure 1 evidence reference",
          value: "DOC-OPS-SOP-LAUNCH-002",
        },
        {
          label: "Closure 1 completed by",
          value: "safety-manager",
        },
        {
          label: "Closure 1 reviewed by",
          value: "accountable-manager",
        },
        {
          label: "Closure 1 action proposal",
          value: "training_action: Update launch SOP and brief operators",
        },
        {
          label: "Closure 1 action decisions",
          value: "accepted, completed",
        },
      ]),
    });
    expect(response.body.report.report.plainText).toContain(
      "Safety action closure evidence",
    );
    expect(response.body.report.report.plainText).toContain(
      "Closure 1 implementation summary: Crew refresher training completed",
    );
    expect(response.body.report.report.plainText).toContain(
      "Closure 1 action decisions: accepted, completed",
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("adds SMS control mapping context to rendered reports without mutating reference data", async () => {
    const { missionId } = await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);
    const beforeMission = await countRows(missionId);
    const beforeMappings = await countSmsMappingRows();

    const response = await request(app).get(
      `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report.report.sections).toContainEqual({
      heading: "SMS assurance context",
      fields: expect.arrayContaining([
        {
          label: "Platform readiness and maintenance controls",
          value: expect.stringContaining(
            "3.1 Monitoring and Measurement of Safety Performance",
          ),
        },
        {
          label: "Pilot readiness controls",
          value: expect.stringContaining("4.1 Training and education"),
        },
        {
          label: "Mission risk controls",
          value: expect.stringContaining(
            "2.1 Risk/hazard detection and identification",
          ),
        },
        {
          label: "Airspace compliance controls",
          value: expect.stringContaining(
            "2.1 Risk/hazard detection and identification",
          ),
        },
        {
          label: "Mission readiness gate controls",
          value: expect.stringContaining("1.5 SMS documentation"),
        },
        {
          label: "Post-operation report and sign-off controls",
          value: expect.stringContaining("3.3 Continuous improvement of SMS"),
        },
      ]),
    });
    expect(await countRows(missionId)).toEqual(beforeMission);
    expect(await countSmsMappingRows()).toEqual(beforeMappings);
  });

  it("does not leak stored sign-offs from other post-operation snapshots", async () => {
    const first = await createCompletedMission();
    const second = await createCompletedMission();
    const firstSnapshot = await request(app)
      .post(`/missions/${first.missionId}/post-operation/evidence-snapshots`)
      .send({});
    const secondSnapshot = await request(app)
      .post(`/missions/${second.missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(firstSnapshot.status).toBe(201);
    expect(secondSnapshot.status).toBe(201);

    const signoffResponse = await request(app)
      .post(
        `/missions/${second.missionId}/post-operation/evidence-snapshots/${secondSnapshot.body.snapshot.id}/signoffs`,
      )
      .send({
        accountableManagerName: "Second Manager",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-18T18:00:00.000Z",
      });

    expect(signoffResponse.status).toBe(201);
    const firstBefore = await countRows(first.missionId);
    const secondBefore = await countRows(second.missionId);

    const response = await request(app).get(
      `/missions/${first.missionId}/post-operation/evidence-snapshots/${firstSnapshot.body.snapshot.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report.report.plainText).toContain(
      "Accountable manager name: Pending sign-off",
    );
    expect(response.body.report.report.plainText).not.toContain(
      "Second Manager",
    );
    expect(await countRows(first.missionId)).toEqual(firstBefore);
    expect(await countRows(second.missionId)).toEqual(secondBefore);
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
    expect(response.body.toString("latin1")).toContain(
      "Evidence readiness summary",
    );
    expect(response.body.toString("latin1")).toContain(
      "Evidence readiness categories are review prompts only",
    );
    expect(response.body.toString("latin1")).toContain(
      "automatically reject the evidence pack or certify compliance.",
    );
    expect(response.body.toString("latin1")).toContain(
      "Sign-off separation: Accountable-manager sign-off remains separate",
    );
    expect(response.body.toString("latin1")).toContain(
      "Live-ops map view-state snapshots status: not_recorded",
    );
    expect(response.body.toString("latin1")).toContain(
      "Live-ops map view-state evidence",
    );
    expect(response.body.toString("latin1")).toContain(
      "No live-ops map view-state snapshots recorded",
    );
    expect(response.body.toString("latin1")).toContain(
      "Live conflict guidance acknowledgements",
    );
    expect(response.body.toString("latin1")).toContain(
      "No live conflict guidance acknowledgements recorded",
    );
    expect(response.body.toString("latin1")).toContain(
      "Safety action closure evidence",
    );
    expect(response.body.toString("latin1")).toContain(
      "No safety action closure evidence recorded",
    );
    expect(response.body.toString("latin1")).toContain(
      "SMS assurance context",
    );
    expect(response.body.toString("latin1")).toContain(
      "Mission readiness gate controls",
    );
    expect(response.body.toString("latin1")).toContain("1.5 SMS documentation");
    expect(await countRows(missionId)).toEqual(before);
  });

  it("includes live-ops map view-state evidence boundaries in post-operation audit PDFs", async () => {
    const { missionId } = await createCompletedMission();
    await request(app)
      .post(
        `/missions/${missionId}/live-operations/map-view-state/audit-snapshots`,
      )
      .send({
        replayCursor: "3 / 5",
        replayTimestamp: "2026-04-18T12:03:00.000Z",
        areaFreshnessFilter: "degraded",
        visibleAreaOverlayCount: 2,
        totalAreaOverlayCount: 4,
        degradedAreaOverlayCount: 2,
        openAlertCount: 3,
        activeConflictCount: 1,
        areaRefreshRunCount: 5,
        viewStateUrl:
          "/operator/missions/live-ops-demo/live-operations?areaFreshnessFilter=degraded",
      });
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app)
      .get(
        `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render/pdf`,
      )
      .buffer(true)
      .parse(parseBinaryResponse);

    expect(response.status).toBe(200);
    const pdfText = response.body.toString("latin1");
    expect(pdfText).toContain("Live-ops map view-state evidence");
    expect(pdfText).toContain("Map view-state snapshot 1 replay cursor: 3 / 5");
    expect(pdfText).toContain(
      "Map view-state snapshot 1 capture scope: metadata_only",
    );
    expect(pdfText).toContain(
      "Map view-state snapshot 1 pilot instruction status",
    );
    expect(pdfText).toContain("not_a_pilot_command");
    expect(pdfText).toContain("Metadata-only evidence; no screenshot/file");
    expect(pdfText).toContain("not pilot command guidance.");
    expect(await countRows(missionId)).toEqual(before);
  });

  it("includes live conflict guidance acknowledgements in post-operation audit PDFs", async () => {
    const { missionId } = await createCompletedMission();
    await createConflictGuidanceAcknowledgement(missionId, {
      conflictId: "conflict-pdf-1",
      acknowledgedBy: "pdf-supervisor",
      acknowledgementNote: "PDF export should include this review.",
      guidanceSummary:
        "PDF export should preserve the conflict advisory summary.",
    });
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app)
      .get(
        `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render/pdf`,
      )
      .buffer(true)
      .parse(parseBinaryResponse);

    expect(response.status).toBe(200);
    const pdfText = response.body.toString("latin1");
    expect(pdfText).toContain("Live conflict guidance acknowledgements");
    expect(pdfText).toContain(
      "Conflict acknowledgement 1 conflict ID: conflict-pdf-1",
    );
    expect(pdfText).toContain(
      "Conflict acknowledgement 1 acknowledged by: pdf-supervisor",
    );
    expect(pdfText).toContain("Conflict acknowledgement 1 guidance summary");
    expect(pdfText).toContain(
      "PDF export should preserve the conflict",
    );
    expect(pdfText).toContain("advisory summary.");
    expect(pdfText).toContain(
      "Conflict acknowledgement 1 pilot instruction status: not_a_pilot_command",
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("includes safety action closure evidence in post-operation audit PDFs", async () => {
    const { missionId } = await createCompletedMission();
    await createSafetyActionClosureEvidence(missionId, {
      evidenceCategory: "maintenance_completion",
      proposalType: "maintenance_action",
      implementationSummary: "Motor mount inspection closed",
    });
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app)
      .get(
        `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render/pdf`,
      )
      .buffer(true)
      .parse(parseBinaryResponse);

    expect(response.status).toBe(200);
    const pdfText = response.body.toString("latin1");
    expect(pdfText).toContain("Safety action closure evidence");
    expect(pdfText).toContain("Closure 1 evidence category: maintenance_completion");
    expect(pdfText).toContain(
      "Closure 1 implementation summary: Motor mount inspection closed",
    );
    expect(pdfText).toContain("Closure 1 action decisions: accepted, completed");
    expect(await countRows(missionId)).toEqual(before);
  });

  it("includes regulatory amendment alert reviews in post-operation audit PDFs", async () => {
    const { missionId } = await createCompletedMission();
    await createRegulatoryAmendmentAlert(missionId, {
      acknowledge: true,
      resolve: true,
    });
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app)
      .get(
        `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render/pdf`,
      )
      .buffer(true)
      .parse(parseBinaryResponse);

    expect(response.status).toBe(200);
    const pdfText = response.body.toString("latin1");
    expect(pdfText).toContain("Regulatory amendment alert review");
    expect(pdfText).toContain("Regulatory amendment alert 1 status: resolved");
    expect(pdfText).toContain("Regulatory amendment alert 1 source: CAA CAP 722");
    expect(pdfText).toContain(
      "Regulatory amendment alert 1 version change: 9.1 -> 9.2",
    );
    expect(pdfText).toContain("Regulatory amendment alert 1 affected references");
    expect(pdfText).toContain("CAP722-OSC, CAP722-Records");
    expect(pdfText).toContain("Regulatory amendment alert 1 review action");
    expect(pdfText).toContain(
      "Accountable manager to confirm mission evidence",
    );
    expect(pdfText).toContain("remains current.");
    expect(pdfText).toContain(
      "Regulatory amendment alert 1 resolved at: 2026-04-18T11:00:00.000Z",
    );
    expect(await countRows(missionId)).toEqual(before);
  });

  it("includes stored accountable-manager sign-offs in post-operation audit PDFs", async () => {
    const { missionId } = await createCompletedMission();
    const snapshotResponse = await request(app)
      .post(`/missions/${missionId}/post-operation/evidence-snapshots`)
      .send({});

    expect(snapshotResponse.status).toBe(201);

    const signoffResponse = await request(app)
      .post(
        `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/signoffs`,
      )
      .send({
        accountableManagerName: "Alex Accountable",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-18T18:00:00.000Z",
        signatureReference: "signature://accountable-manager/alex",
        createdBy: "audit-admin",
      });

    expect(signoffResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app)
      .get(
        `/missions/${missionId}/post-operation/evidence-snapshots/${snapshotResponse.body.snapshot.id}/export/render/pdf`,
      )
      .buffer(true)
      .parse(parseBinaryResponse);
    const pdfText = response.body.toString("latin1");

    expect(response.status).toBe(200);
    expect(pdfText).toContain("Accountable manager sign-off");
    expect(pdfText).toContain("Accountable manager name: Alex Accountable");
    expect(pdfText).toContain("Role/title: Accountable Manager");
    expect(pdfText).toContain(
      "Signature: signature://accountable-manager/alex",
    );
    expect(pdfText).toContain("Signed date/time: 2026-04-18T18:00:00.000Z");
    expect(pdfText).toContain("Review decision/status: approved");
    expect(pdfText).toContain(
      `Sign-off record ID: ${signoffResponse.body.signoff.id}`,
    );
    expect(pdfText).toContain("SMS assurance context");
    expect(pdfText).toContain("Post-operation report and sign-off controls");
    expect(pdfText).toContain("3.3 Continuous improvement of SMS");
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

  it("rejects direct conflict guidance acknowledgement records with mismatched evidence roles", async () => {
    const { missionId } = await createReadyMission();
    const overlayId = await createConflictOverlay(missionId);
    const before = await countRows(missionId);

    await expect(
      pool.query(
        `
        insert into conflict_guidance_acknowledgements (
          id,
          mission_id,
          conflict_id,
          overlay_id,
          guidance_action_code,
          evidence_action,
          acknowledgement_role,
          acknowledged_by,
          guidance_summary
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          randomUUID(),
          missionId,
          "conflict-db-mismatch",
          overlayId,
          "hold_or_suspend",
          "record_supervisor_review",
          "operator",
          "operator-a",
          "Direct DB role mismatch summary.",
        ],
      ),
    ).rejects.toMatchObject({
      code: "23514",
    });

    expect(await countRows(missionId)).toEqual(before);
  });

  it("rejects direct duplicate conflict guidance acknowledgement records", async () => {
    const { missionId } = await createReadyMission();
    const overlayId = await createConflictOverlay(missionId);

    await pool.query(
      `
      insert into conflict_guidance_acknowledgements (
        id,
        mission_id,
        conflict_id,
        overlay_id,
        guidance_action_code,
        evidence_action,
        acknowledgement_role,
        acknowledged_by,
        guidance_summary
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        randomUUID(),
        missionId,
        "conflict-db-duplicate-first",
        overlayId,
        "hold_or_suspend",
        "record_supervisor_review",
        "supervisor",
        "supervisor-a",
        "First direct duplicate summary.",
      ],
    );
    const beforeDuplicate = await countRows(missionId);

    await expect(
      pool.query(
        `
        insert into conflict_guidance_acknowledgements (
          id,
          mission_id,
          conflict_id,
          overlay_id,
          guidance_action_code,
          evidence_action,
          acknowledgement_role,
          acknowledged_by,
          guidance_summary
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          randomUUID(),
          missionId,
          "conflict-db-duplicate-second",
          overlayId,
          "hold_or_suspend",
          "record_supervisor_review",
          "supervisor",
          "supervisor-b",
          "Second direct duplicate summary.",
        ],
      ),
    ).rejects.toMatchObject({
      code: "23505",
    });

    expect(await countRows(missionId)).toEqual(beforeDuplicate);
  });

  it("rejects direct conflict guidance acknowledgement records without a guidance summary", async () => {
    const { missionId } = await createReadyMission();
    const overlayId = await createConflictOverlay(missionId);
    const before = await countRows(missionId);

    await expect(
      pool.query(
        `
        insert into conflict_guidance_acknowledgements (
          id,
          mission_id,
          conflict_id,
          overlay_id,
          guidance_action_code,
          evidence_action,
          acknowledgement_role,
          acknowledged_by,
          guidance_summary
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          randomUUID(),
          missionId,
          "conflict-db-empty-summary",
          overlayId,
          "hold_or_suspend",
          "record_supervisor_review",
          "supervisor",
          "supervisor-a",
          " ",
        ],
      ),
    ).rejects.toMatchObject({
      code: "23514",
    });

    expect(await countRows(missionId)).toEqual(before);
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
