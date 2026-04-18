import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const insertMission = async (params: {
  id: string;
  status: string;
  missionPlanId?: string;
  lastEventSequenceNo?: number;
}) => {
  await pool.query(
    `
    INSERT INTO missions (
      id,
      status,
      mission_plan_id,
      last_event_sequence_no
    )
    VALUES ($1, $2, $3, $4)
    `,
    [
      params.id,
      params.status,
      params.missionPlanId ?? "plan-1",
      params.lastEventSequenceNo ?? 0,
    ],
  );
};

const getMissionState = async (missionId: string) => {
  const result = await pool.query(
    `
    SELECT status, last_event_sequence_no
    FROM missions
    WHERE id = $1
    `,
    [missionId],
  );

  expect(result.rows).toHaveLength(1);

  return result.rows[0] as {
    status: string;
    last_event_sequence_no: number;
  };
};

const getMissionEvents = async (missionId: string) => {
  const response = await request(app).get(`/missions/${missionId}/events`);

  expect(response.status).toBe(200);

  return response.body as Array<{
    type: string;
    sequence: number;
    fromState: string | null;
    toState: string | null;
    actorType: string;
    actorId: string | null;
    summary: string;
    details: Record<string, unknown>;
  }>;
};

const countMissionEventsByType = async (
  missionId: string,
  eventType: string,
) => {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM mission_events
    WHERE mission_id = $1
      AND event_type = $2
    `,
    [missionId, eventType],
  );

  return result.rows[0].count as number;
};

const createDecisionEvidenceLink = async (
  missionId: string,
  decisionType: "approval" | "dispatch",
) => {
  const snapshotResponse = await request(app)
    .post(`/missions/${missionId}/readiness/audit-snapshots`)
    .send({});

  expect(snapshotResponse.status).toBe(201);

  const linkResponse = await request(app)
    .post(`/missions/${missionId}/decision-evidence-links`)
    .send({
      snapshotId: snapshotResponse.body.snapshot.id,
      decisionType,
      createdBy: "reviewer-1",
    });

  expect(linkResponse.status).toBe(201);

  return linkResponse.body.link as { id: string };
};

const createApprovalEvidenceLink = async (missionId: string) =>
  createDecisionEvidenceLink(missionId, "approval");

const createDispatchEvidenceLink = async (missionId: string) =>
  createDecisionEvidenceLink(missionId, "dispatch");

const getAuditEvidenceState = async (missionId: string) => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from audit_evidence_snapshots where mission_id = $1) as snapshot_count,
      (select count(*)::int from mission_decision_evidence_links where mission_id = $1) as decision_link_count,
      (
        select readiness_snapshot
        from audit_evidence_snapshots
        where mission_id = $1
        order by created_at desc, id desc
        limit 1
      ) as latest_snapshot
    `,
    [missionId],
  );

  return result.rows[0] as {
    snapshot_count: number;
    decision_link_count: number;
    latest_snapshot: Record<string, unknown> | null;
  };
};

type DuplicateTransitionCase = {
  name: string;
  route: (missionId: string) => string;
  initialStatus: string;
  expectedStatusAfterFirstCall: string;
  requestBody:
    | Record<string, unknown>
    | ((missionId: string) => Promise<Record<string, unknown>>);
  expectedErrorMessage: string;
  eventType: string;
};

const runDuplicateTransitionTest = ({
  name,
  route,
  initialStatus,
  expectedStatusAfterFirstCall,
  requestBody,
  expectedErrorMessage,
  eventType,
}: DuplicateTransitionCase) => {
  it(name, async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: initialStatus,
    });

    const resolvedRequestBody =
      typeof requestBody === "function"
        ? await requestBody(missionId)
        : requestBody;

    const firstResponse = await request(app)
      .post(route(missionId))
      .send(resolvedRequestBody);

    expect(firstResponse.status).toBe(204);

    const missionStateAfterFirstCall = await getMissionState(missionId);
    expect(missionStateAfterFirstCall.status).toBe(
      expectedStatusAfterFirstCall,
    );

    const eventsAfterFirstCall = await getMissionEvents(missionId);

    const matchingEventsAfterFirstCall = eventsAfterFirstCall.filter(
      (item: { type: string }) => item.type === eventType,
    );

    expect(matchingEventsAfterFirstCall).toHaveLength(1);

    const secondResponse = await request(app)
      .post(route(missionId))
      .send(resolvedRequestBody);

    expect(secondResponse.status).toBe(409);

    expect(secondResponse.body).toMatchObject({
      error: {
        message: expect.stringContaining(expectedErrorMessage),
        type: "invalid_state_transition",
      },
    });

    expect(await getMissionState(missionId)).toEqual(
      missionStateAfterFirstCall,
    );

    expect(await getMissionEvents(missionId)).toEqual(
      eventsAfterFirstCall,
    );

    expect(await countMissionEventsByType(missionId, eventType)).toBe(1);
  });
};

describe("mission integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  runDuplicateTransitionTest({
    name: "POST /missions/:missionId/submit rejects duplicate submit and does not append a second mission.submitted event",
    route: (missionId) => `/missions/${missionId}/submit`,
    initialStatus: "draft",
    expectedStatusAfterFirstCall: "submitted",
    requestBody: {
      userId: "user-1",
    },
    expectedErrorMessage: "Mission cannot be submitted from status submitted",
    eventType: "mission.submitted",
  });

  runDuplicateTransitionTest({
    name: "POST /missions/:missionId/approve rejects duplicate approve and does not append a second mission.approved event",
    route: (missionId) => `/missions/${missionId}/approve`,
    initialStatus: "submitted",
    expectedStatusAfterFirstCall: "approved",
    requestBody: async (missionId) => {
      const link = await createApprovalEvidenceLink(missionId);

      return {
        reviewerId: "reviewer-1",
        decisionEvidenceLinkId: link.id,
        notes: "first approval",
      };
    },
    expectedErrorMessage: "Mission cannot be approved from status approved",
    eventType: "mission.approved",
  });

  runDuplicateTransitionTest({
    name: "POST /missions/:missionId/launch rejects duplicate launch and does not append a second mission.launched event",
    route: (missionId) => `/missions/${missionId}/launch`,
    initialStatus: "approved",
    expectedStatusAfterFirstCall: "active",
    requestBody: async (missionId) => {
      const link = await createDispatchEvidenceLink(missionId);

      return {
        operatorId: "operator-1",
        vehicleId: "vehicle-1",
        lat: 51.5074,
        lng: -0.1278,
        decisionEvidenceLinkId: link.id,
      };
    },
    expectedErrorMessage: "Mission cannot be launched from status active",
    eventType: "mission.launched",
  });

  runDuplicateTransitionTest({
    name: "POST /missions/:missionId/complete rejects duplicate complete and does not append a second mission.completed event",
    route: (missionId) => `/missions/${missionId}/complete`,
    initialStatus: "active",
    expectedStatusAfterFirstCall: "completed",
    requestBody: {
      operatorId: "operator-1",
    },
    expectedErrorMessage: "Mission cannot be completed from status completed",
    eventType: "mission.completed",
  });

  runDuplicateTransitionTest({
    name: "POST /missions/:missionId/abort rejects duplicate abort and does not append a second mission.aborted event",
    route: (missionId) => `/missions/${missionId}/abort`,
    initialStatus: "active",
    expectedStatusAfterFirstCall: "aborted",
    requestBody: {
      actorId: "operator-1",
      reason: "weather",
    },
    expectedErrorMessage: "Mission cannot be aborted from status aborted",
    eventType: "mission.aborted",
  });

  it("POST /missions/:missionId/approve rejects approve before submit and does not append mission.approved", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "draft",
    });

    const approveResponse = await request(app)
      .post(`/missions/${missionId}/approve`)
      .send({
        reviewerId: "reviewer-1",
        notes: "should fail before submit",
      });

    expect(approveResponse.status).toBe(409);

    expect(approveResponse.body).toMatchObject({
      error: {
        message: expect.stringContaining(
          "Mission cannot be approved from status draft",
        ),
        type: "invalid_state_transition",
      },
    });

    expect(await getMissionState(missionId)).toEqual({
      status: "draft",
      last_event_sequence_no: 0,
    });

    expect(await getMissionEvents(missionId)).toEqual([]);
    expect(await countMissionEventsByType(missionId, "mission.approved")).toBe(0);
  });

  it("POST /missions/:missionId/approve rejects submitted approval without linked readiness evidence", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "submitted",
    });
    const auditBefore = await getAuditEvidenceState(missionId);

    const approveResponse = await request(app)
      .post(`/missions/${missionId}/approve`)
      .send({
        reviewerId: "reviewer-1",
        notes: "should fail without evidence",
      });

    expect(approveResponse.status).toBe(400);
    expect(approveResponse.body).toMatchObject({
      error: {
        type: "mission_approval_evidence_required",
      },
    });

    expect(await getMissionState(missionId)).toEqual({
      status: "submitted",
      last_event_sequence_no: 0,
    });
    expect(await getMissionEvents(missionId)).toEqual([]);
    expect(await getAuditEvidenceState(missionId)).toEqual(auditBefore);
  });

  it("POST /missions/:missionId/approve rejects dispatch evidence links", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "submitted",
    });
    const dispatchLink = await createDecisionEvidenceLink(missionId, "dispatch");
    const auditBefore = await getAuditEvidenceState(missionId);

    const approveResponse = await request(app)
      .post(`/missions/${missionId}/approve`)
      .send({
        reviewerId: "reviewer-1",
        decisionEvidenceLinkId: dispatchLink.id,
        notes: "should fail with dispatch evidence",
      });

    expect(approveResponse.status).toBe(409);
    expect(approveResponse.body).toMatchObject({
      error: {
        type: "invalid_mission_approval_evidence",
      },
    });

    expect(await getMissionState(missionId)).toEqual({
      status: "submitted",
      last_event_sequence_no: 0,
    });
    expect(await getMissionEvents(missionId)).toEqual([]);
    expect(await getAuditEvidenceState(missionId)).toEqual(auditBefore);
  });

  it("POST /missions/:missionId/approve rejects approval evidence from another mission", async () => {
    const missionId = randomUUID();
    const otherMissionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "submitted",
    });
    await insertMission({
      id: otherMissionId,
      status: "submitted",
    });
    const otherLink = await createApprovalEvidenceLink(otherMissionId);
    const auditBefore = await getAuditEvidenceState(missionId);
    const otherAuditBefore = await getAuditEvidenceState(otherMissionId);

    const approveResponse = await request(app)
      .post(`/missions/${missionId}/approve`)
      .send({
        reviewerId: "reviewer-1",
        decisionEvidenceLinkId: otherLink.id,
      });

    expect(approveResponse.status).toBe(409);
    expect(approveResponse.body).toMatchObject({
      error: {
        type: "invalid_mission_approval_evidence",
      },
    });

    expect(await getMissionState(missionId)).toEqual({
      status: "submitted",
      last_event_sequence_no: 0,
    });
    expect(await getMissionEvents(missionId)).toEqual([]);
    expect(await getAuditEvidenceState(missionId)).toEqual(auditBefore);
    expect(await getAuditEvidenceState(otherMissionId)).toEqual(otherAuditBefore);
  });

  it("POST /missions/:missionId/complete rejects complete before launch and does not append mission.completed", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "approved",
    });

    const completeResponse = await request(app)
      .post(`/missions/${missionId}/complete`)
      .send({
        operatorId: "operator-1",
      });

    expect(completeResponse.status).toBe(409);

    expect(completeResponse.body).toMatchObject({
      error: {
        message: expect.stringContaining(
          "Mission cannot be completed from status approved",
        ),
        type: "invalid_state_transition",
      },
    });

    expect(await getMissionState(missionId)).toEqual({
      status: "approved",
      last_event_sequence_no: 0,
    });

    expect(await getMissionEvents(missionId)).toEqual([]);
    expect(await countMissionEventsByType(missionId, "mission.completed")).toBe(0);
  });

  it("POST /missions/:missionId/approve rejects approve after launch and does not append mission.approved", async () => {
  const missionId = randomUUID();

  await insertMission({
    id: missionId,
    status: "active",
  });

  const approveResponse = await request(app)
    .post(`/missions/${missionId}/approve`)
    .send({
      reviewerId: "reviewer-1",
      notes: "should fail after launch",
    });

  expect(approveResponse.status).toBe(409);

  expect(approveResponse.body).toMatchObject({
    error: {
      message: expect.stringContaining(
        "Mission cannot be approved from status active",
      ),
      type: "invalid_state_transition",
    },
  });

  expect(await getMissionState(missionId)).toEqual({
    status: "active",
    last_event_sequence_no: 0,
  });

  expect(await getMissionEvents(missionId)).toEqual([]);
  expect(await countMissionEventsByType(missionId, "mission.approved")).toBe(0);
});

  it("POST /missions/:missionId/launch rejects launch before approve and does not append mission.launched", async () => {
  const missionId = randomUUID();

  await insertMission({
    id: missionId,
    status: "submitted",
  });

  const launchResponse = await request(app)
    .post(`/missions/${missionId}/launch`)
    .send({
      operatorId: "operator-1",
      vehicleId: "vehicle-1",
      lat: 51.5074,
      lng: -0.1278,
    });

  expect(launchResponse.status).toBe(409);

  expect(launchResponse.body).toMatchObject({
    error: {
      message: expect.stringContaining(
        "Mission cannot be launched from status submitted",
      ),
      type: "invalid_state_transition",
    },
  });

  expect(await getMissionState(missionId)).toEqual({
    status: "submitted",
    last_event_sequence_no: 0,
  });

  expect(await getMissionEvents(missionId)).toEqual([]);
  expect(await countMissionEventsByType(missionId, "mission.launched")).toBe(0);
});

  it("POST /missions/:missionId/launch rejects approved launch without linked readiness evidence", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "approved",
    });
    const auditBefore = await getAuditEvidenceState(missionId);

    const launchResponse = await request(app)
      .post(`/missions/${missionId}/launch`)
      .send({
        operatorId: "operator-1",
        vehicleId: "vehicle-1",
        lat: 51.5074,
        lng: -0.1278,
      });

    expect(launchResponse.status).toBe(400);
    expect(launchResponse.body).toMatchObject({
      error: {
        type: "mission_dispatch_evidence_required",
      },
    });

    expect(await getMissionState(missionId)).toEqual({
      status: "approved",
      last_event_sequence_no: 0,
    });
    expect(await getMissionEvents(missionId)).toEqual([]);
    expect(await getAuditEvidenceState(missionId)).toEqual(auditBefore);
  });

  it("POST /missions/:missionId/launch rejects approval evidence links", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "approved",
    });
    const approvalLink = await createApprovalEvidenceLink(missionId);
    const auditBefore = await getAuditEvidenceState(missionId);

    const launchResponse = await request(app)
      .post(`/missions/${missionId}/launch`)
      .send({
        operatorId: "operator-1",
        vehicleId: "vehicle-1",
        lat: 51.5074,
        lng: -0.1278,
        decisionEvidenceLinkId: approvalLink.id,
      });

    expect(launchResponse.status).toBe(409);
    expect(launchResponse.body).toMatchObject({
      error: {
        type: "invalid_mission_dispatch_evidence",
      },
    });

    expect(await getMissionState(missionId)).toEqual({
      status: "approved",
      last_event_sequence_no: 0,
    });
    expect(await getMissionEvents(missionId)).toEqual([]);
    expect(await getAuditEvidenceState(missionId)).toEqual(auditBefore);
  });

  it("POST /missions/:missionId/launch rejects dispatch evidence from another mission", async () => {
    const missionId = randomUUID();
    const otherMissionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "approved",
    });
    await insertMission({
      id: otherMissionId,
      status: "approved",
    });
    const otherLink = await createDispatchEvidenceLink(otherMissionId);
    const auditBefore = await getAuditEvidenceState(missionId);
    const otherAuditBefore = await getAuditEvidenceState(otherMissionId);

    const launchResponse = await request(app)
      .post(`/missions/${missionId}/launch`)
      .send({
        operatorId: "operator-1",
        vehicleId: "vehicle-1",
        lat: 51.5074,
        lng: -0.1278,
        decisionEvidenceLinkId: otherLink.id,
      });

    expect(launchResponse.status).toBe(409);
    expect(launchResponse.body).toMatchObject({
      error: {
        type: "invalid_mission_dispatch_evidence",
      },
    });

    expect(await getMissionState(missionId)).toEqual({
      status: "approved",
      last_event_sequence_no: 0,
    });
    expect(await getMissionEvents(missionId)).toEqual([]);
    expect(await getAuditEvidenceState(missionId)).toEqual(auditBefore);
    expect(await getAuditEvidenceState(otherMissionId)).toEqual(otherAuditBefore);
  });

  it("POST /missions/:missionId/launch updates mission state and creates exactly one mission.launched event", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "approved",
    });
    const dispatchLink = await createDispatchEvidenceLink(missionId);

    const launchResponse = await request(app)
      .post(`/missions/${missionId}/launch`)
      .send({
        operatorId: "operator-1",
        vehicleId: "vehicle-1",
        lat: 51.5074,
        lng: -0.1278,
        decisionEvidenceLinkId: dispatchLink.id,
      });

    expect(launchResponse.status).toBe(204);

    const missionResult = await getMissionState(missionId);
    expect(missionResult.status).toBe("active");

    const eventsResponse = await getMissionEvents(missionId);

    const launchedEvents = eventsResponse.filter(
      (item: { type: string }) => item.type === "mission.launched",
    );

    expect(launchedEvents).toHaveLength(1);

    expect(launchedEvents[0]).toMatchObject({
      type: "mission.launched",
      actorType: "user",
      actorId: "operator-1",
      fromState: "approved",
      toState: "active",
      summary: "Mission launched",
    });

    expect(launchedEvents[0].details).toMatchObject({
      vehicle_id: "vehicle-1",
      decision_evidence_link_id: dispatchLink.id,
      launch_site: {
        lat: 51.5074,
        lng: -0.1278,
      },
    });

    expect(launchedEvents[0].sequence).toBeGreaterThan(0);
    expect(missionResult.last_event_sequence_no).toBe(
      launchedEvents[0].sequence,
    );

    expect(
      await countMissionEventsByType(missionId, "mission.launched"),
    ).toBe(1);
  });

it("POST /missions/:missionId/abort rejects abort from completed and does not append mission.aborted", async () => {
  const missionId = randomUUID();

  await pool.query(
    `
    INSERT INTO missions (
      id,
      status,
      mission_plan_id,
      last_event_sequence_no
    )
    VALUES ($1, $2, $3, $4)
    `,
    [missionId, "completed", "plan-1", 0],
  );

  const abortResponse = await request(app)
    .post(`/missions/${missionId}/abort`)
    .send({
      actorId: "operator-1",
      reason: "should be rejected after completion",
    });

  expect(abortResponse.status).toBe(409);

  expect(abortResponse.body).toMatchObject({
    error: {
      message: expect.stringContaining(
        "Mission cannot be aborted from status completed",
      ),
      type: "invalid_state_transition",
    },
  });

  const missionResult = await pool.query(
    `
    SELECT status, last_event_sequence_no
    FROM missions
    WHERE id = $1
    `,
    [missionId],
  );

  expect(missionResult.rows).toHaveLength(1);
  expect(missionResult.rows[0]).toEqual({
    status: "completed",
    last_event_sequence_no: 0,
  });

  const eventsResponse = await request(app).get(`/missions/${missionId}/events`);

  expect(eventsResponse.status).toBe(200);
  expect(eventsResponse.body).toEqual([]);

  const abortedEventCountResult = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM mission_events
    WHERE mission_id = $1
      AND event_type = 'mission.aborted'
    `,
    [missionId],
  );

  expect(abortedEventCountResult.rows[0].count).toBe(0);
});

it("POST /missions/:missionId/submit rejects submit after approval and does not append mission.submitted", async () => {
  const missionId = randomUUID();

  await insertMission({
    id: missionId,
    status: "approved",
  });

  const submitResponse = await request(app)
    .post(`/missions/${missionId}/submit`)
    .send({
      userId: "user-1",
    });

  expect(submitResponse.status).toBe(409);

  expect(submitResponse.body).toMatchObject({
    error: {
      message: expect.stringContaining(
        "Mission cannot be submitted from status approved",
      ),
      type: "invalid_state_transition",
    },
  });

  expect(await getMissionState(missionId)).toEqual({
    status: "approved",
    last_event_sequence_no: 0,
  });

  expect(await getMissionEvents(missionId)).toEqual([]);
  expect(await countMissionEventsByType(missionId, "mission.submitted")).toBe(0);
});

it("POST /missions/:missionId/submit rejects submit after completion and does not append mission.submitted", async () => {
  const missionId = randomUUID();

  await insertMission({
    id: missionId,
    status: "completed",
  });

  const submitResponse = await request(app)
    .post(`/missions/${missionId}/submit`)
    .send({
      userId: "user-1",
    });

  expect(submitResponse.status).toBe(409);

  expect(submitResponse.body).toMatchObject({
    error: {
      message: expect.stringContaining(
        "Mission cannot be submitted from status completed",
      ),
      type: "invalid_state_transition",
    },
  });

  expect(await getMissionState(missionId)).toEqual({
    status: "completed",
    last_event_sequence_no: 0,
  });

  expect(await getMissionEvents(missionId)).toEqual([]);
  expect(await countMissionEventsByType(missionId, "mission.submitted")).toBe(0);
});

it("POST /missions/:missionId/complete rejects complete after abort and does not append mission.completed", async () => {
  const missionId = randomUUID();

  await insertMission({
    id: missionId,
    status: "aborted",
  });

  const completeResponse = await request(app)
    .post(`/missions/${missionId}/complete`)
    .send({
      operatorId: "operator-1",
    });

  expect(completeResponse.status).toBe(409);

  expect(completeResponse.body).toMatchObject({
    error: {
      message: expect.stringContaining(
        "Mission cannot be completed from status aborted",
      ),
      type: "invalid_state_transition",
    },
  });

  expect(await getMissionState(missionId)).toEqual({
    status: "aborted",
    last_event_sequence_no: 0,
  });

  expect(await getMissionEvents(missionId)).toEqual([]);
  expect(await countMissionEventsByType(missionId, "mission.completed")).toBe(0);
});

it("GET /missions/:missionId/transitions/:action/check returns allowed true for approve from submitted", async () => {
  const missionId = randomUUID();

  await insertMission({
    id: missionId,
    status: "submitted",
  });

  const response = await request(app).get(
    `/missions/${missionId}/transitions/approve/check`,
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    missionId,
    currentStatus: "submitted",
    action: "approve",
    targetStatus: "approved",
    allowed: true,
    error: null,
  });

  expect(await getMissionState(missionId)).toEqual({
    status: "submitted",
    last_event_sequence_no: 0,
  });

  expect(await getMissionEvents(missionId)).toEqual([]);
});

it("GET /missions/:missionId/transitions/:action/check returns allowed false for approve from draft without mutating state", async () => {
  const missionId = randomUUID();

  await insertMission({
    id: missionId,
    status: "draft",
  });

  const response = await request(app).get(
    `/missions/${missionId}/transitions/approve/check`,
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    missionId,
    currentStatus: "draft",
    action: "approve",
    targetStatus: "approved",
    allowed: false,
    error: {
      type: "invalid_state_transition",
      message: "Mission cannot be approved from status draft",
    },
  });

  expect(await getMissionState(missionId)).toEqual({
    status: "draft",
    last_event_sequence_no: 0,
  });

  expect(await getMissionEvents(missionId)).toEqual([]);
});

it("GET /missions/:missionId/transitions/:action/check rejects unsupported action", async () => {
  const missionId = randomUUID();

  await insertMission({
    id: missionId,
    status: "draft",
  });

  const response = await request(app).get(
    `/missions/${missionId}/transitions/fly/check`,
  );

  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({
    error: {
      type: "invalid_action",
      message: expect.stringContaining("Unsupported lifecycle action fly"),
    },
  });

  expect(await getMissionState(missionId)).toEqual({
    status: "draft",
    last_event_sequence_no: 0,
  });

  expect(await getMissionEvents(missionId)).toEqual([]);
});

it("POST mission lifecycle submit -> approve -> launch -> complete writes ordered events with monotonic sequence", async () => {
    const missionId = randomUUID();

    await pool.query(
      `
      INSERT INTO missions (
        id,
        status,
        mission_plan_id,
        last_event_sequence_no
      )
      VALUES ($1, $2, $3, $4)
      `,
      [missionId, "draft", "plan-1", 0],
    );

    const submitResponse = await request(app)
      .post(`/missions/${missionId}/submit`)
      .send({
        userId: "user-1",
      });

    expect(submitResponse.status).toBe(204);

    const approvalEvidenceLink = await createApprovalEvidenceLink(missionId);

    const approveResponse = await request(app)
      .post(`/missions/${missionId}/approve`)
      .send({
        reviewerId: "reviewer-1",
        decisionEvidenceLinkId: approvalEvidenceLink.id,
        notes: "approved in lifecycle test",
      });

    expect(approveResponse.status).toBe(204);

    const dispatchEvidenceLink = await createDispatchEvidenceLink(missionId);

    const launchResponse = await request(app)
      .post(`/missions/${missionId}/launch`)
      .send({
        operatorId: "operator-1",
        vehicleId: "vehicle-1",
        lat: 51.5074,
        lng: -0.1278,
        decisionEvidenceLinkId: dispatchEvidenceLink.id,
      });

    expect(launchResponse.status).toBe(204);

    const completeResponse = await request(app)
      .post(`/missions/${missionId}/complete`)
      .send({
        operatorId: "operator-1",
      });

    expect(completeResponse.status).toBe(204);

    const missionResult = await pool.query(
      `
      SELECT status, last_event_sequence_no
      FROM missions
      WHERE id = $1
      `,
      [missionId],
    );

    expect(missionResult.rows).toHaveLength(1);
    expect(missionResult.rows[0].status).toBe("completed");

    const eventsResponse = await request(app).get(`/missions/${missionId}/events`);

    expect(eventsResponse.status).toBe(200);
    expect(eventsResponse.body).toHaveLength(4);

    expect(
      eventsResponse.body.map((item: { type: string }) => item.type),
    ).toEqual([
      "mission.submitted",
      "mission.approved",
      "mission.launched",
      "mission.completed",
    ]);

    expect(
      eventsResponse.body.map(
        (item: { fromState: string | null }) => item.fromState,
      ),
    ).toEqual(["draft", "submitted", "approved", "active"]);

    expect(
      eventsResponse.body.map(
        (item: { toState: string | null }) => item.toState,
      ),
    ).toEqual(["submitted", "approved", "active", "completed"]);

    expect(eventsResponse.body[0]).toMatchObject({
      type: "mission.submitted",
      actorType: "user",
      actorId: "user-1",
      fromState: "draft",
      toState: "submitted",
      summary: "Mission submitted for review",
      details: {
        reason: "operator_submitted_for_review",
      },
    });

    expect(eventsResponse.body[1]).toMatchObject({
      type: "mission.approved",
      actorType: "user",
      actorId: "reviewer-1",
      fromState: "submitted",
      toState: "approved",
      summary: "Mission approved",
      details: {
        decision: "approved",
        decision_evidence_link_id: approvalEvidenceLink.id,
        notes: "approved in lifecycle test",
      },
    });

    expect(eventsResponse.body[2]).toMatchObject({
      type: "mission.launched",
      actorType: "user",
      actorId: "operator-1",
      fromState: "approved",
      toState: "active",
      summary: "Mission launched",
      details: {
        vehicle_id: "vehicle-1",
        decision_evidence_link_id: dispatchEvidenceLink.id,
        launch_site: {
          lat: 51.5074,
          lng: -0.1278,
        },
      },
    });

    expect(eventsResponse.body[3]).toMatchObject({
      type: "mission.completed",
      actorType: "user",
      actorId: "operator-1",
      fromState: "active",
      toState: "completed",
      summary: "Mission completed",
      details: {},
    });

    const sequences = eventsResponse.body.map(
      (item: { sequence: number }) => item.sequence,
    );

    expect(sequences).toEqual([1, 2, 3, 4]);
    expect(sequences[1]).toBeGreaterThan(sequences[0]);
    expect(sequences[2]).toBeGreaterThan(sequences[1]);
    expect(sequences[3]).toBeGreaterThan(sequences[2]);

    expect(missionResult.rows[0].last_event_sequence_no).toBe(4);

    const eventCountsResult = await pool.query(
      `
      SELECT event_type, COUNT(*)::int AS count
      FROM mission_events
      WHERE mission_id = $1
      GROUP BY event_type
      ORDER BY event_type
      `,
      [missionId],
    );

    expect(eventCountsResult.rows).toEqual([
      { event_type: "mission.approved", count: 1 },
      { event_type: "mission.completed", count: 1 },
      { event_type: "mission.launched", count: 1 },
      { event_type: "mission.submitted", count: 1 },
    ]);
  });
});
