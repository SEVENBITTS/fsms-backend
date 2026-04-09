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

type TransitionCase = {
  name: string;
  route: (missionId: string) => string;
  requestBody: Record<string, unknown>;
  fromStatus: string;
  allowed: boolean;
  expectedToStatus?: string;
  expectedEventType: string;
  expectedErrorMessage: string;
};

const transitionCases: TransitionCase[] = [
  {
    name: "submit from draft is allowed",
    route: (missionId) => `/missions/${missionId}/submit`,
    requestBody: { userId: "user-1" },
    fromStatus: "draft",
    allowed: true,
    expectedToStatus: "submitted",
    expectedEventType: "mission.submitted",
    expectedErrorMessage: "Mission cannot be submitted from status draft",
  },
  {
    name: "submit from submitted is rejected",
    route: (missionId) => `/missions/${missionId}/submit`,
    requestBody: { userId: "user-1" },
    fromStatus: "submitted",
    allowed: false,
    expectedEventType: "mission.submitted",
    expectedErrorMessage: "Mission cannot be submitted from status submitted",
  },
  {
    name: "submit from approved is rejected",
    route: (missionId) => `/missions/${missionId}/submit`,
    requestBody: { userId: "user-1" },
    fromStatus: "approved",
    allowed: false,
    expectedEventType: "mission.submitted",
    expectedErrorMessage: "Mission cannot be submitted from status approved",
  },
  {
    name: "approve from submitted is allowed",
    route: (missionId) => `/missions/${missionId}/approve`,
    requestBody: { reviewerId: "reviewer-1", notes: "ok" },
    fromStatus: "submitted",
    allowed: true,
    expectedToStatus: "approved",
    expectedEventType: "mission.approved",
    expectedErrorMessage: "Mission cannot be approved from status submitted",
  },
  {
    name: "approve from draft is rejected",
    route: (missionId) => `/missions/${missionId}/approve`,
    requestBody: { reviewerId: "reviewer-1", notes: "ok" },
    fromStatus: "draft",
    allowed: false,
    expectedEventType: "mission.approved",
    expectedErrorMessage: "Mission cannot be approved from status draft",
  },
  {
    name: "approve from approved is rejected",
    route: (missionId) => `/missions/${missionId}/approve`,
    requestBody: { reviewerId: "reviewer-1", notes: "ok" },
    fromStatus: "approved",
    allowed: false,
    expectedEventType: "mission.approved",
    expectedErrorMessage: "Mission cannot be approved from status approved",
  },
  {
    name: "launch from approved is allowed",
    route: (missionId) => `/missions/${missionId}/launch`,
    requestBody: {
      operatorId: "operator-1",
      vehicleId: "vehicle-1",
      lat: 51.5074,
      lng: -0.1278,
    },
    fromStatus: "approved",
    allowed: true,
    expectedToStatus: "active",
    expectedEventType: "mission.launched",
    expectedErrorMessage: "Mission cannot be launched from status approved",
  },
  {
    name: "launch from submitted is rejected",
    route: (missionId) => `/missions/${missionId}/launch`,
    requestBody: {
      operatorId: "operator-1",
      vehicleId: "vehicle-1",
      lat: 51.5074,
      lng: -0.1278,
    },
    fromStatus: "submitted",
    allowed: false,
    expectedEventType: "mission.launched",
    expectedErrorMessage: "Mission cannot be launched from status submitted",
  },
  {
    name: "launch from active is rejected",
    route: (missionId) => `/missions/${missionId}/launch`,
    requestBody: {
      operatorId: "operator-1",
      vehicleId: "vehicle-1",
      lat: 51.5074,
      lng: -0.1278,
    },
    fromStatus: "active",
    allowed: false,
    expectedEventType: "mission.launched",
    expectedErrorMessage: "Mission cannot be launched from status active",
  },
  {
    name: "complete from active is allowed",
    route: (missionId) => `/missions/${missionId}/complete`,
    requestBody: { operatorId: "operator-1" },
    fromStatus: "active",
    allowed: true,
    expectedToStatus: "completed",
    expectedEventType: "mission.completed",
    expectedErrorMessage: "Mission cannot be completed from status active",
  },
  {
    name: "complete from approved is rejected",
    route: (missionId) => `/missions/${missionId}/complete`,
    requestBody: { operatorId: "operator-1" },
    fromStatus: "approved",
    allowed: false,
    expectedEventType: "mission.completed",
    expectedErrorMessage: "Mission cannot be completed from status approved",
  },
  {
    name: "complete from completed is rejected",
    route: (missionId) => `/missions/${missionId}/complete`,
    requestBody: { operatorId: "operator-1" },
    fromStatus: "completed",
    allowed: false,
    expectedEventType: "mission.completed",
    expectedErrorMessage: "Mission cannot be completed from status completed",
  },
  {
    name: "abort from draft is allowed",
    route: (missionId) => `/missions/${missionId}/abort`,
    requestBody: { actorId: "operator-1", reason: "cancelled" },
    fromStatus: "draft",
    allowed: true,
    expectedToStatus: "aborted",
    expectedEventType: "mission.aborted",
    expectedErrorMessage: "Mission cannot be aborted from status draft",
  },
  {
    name: "abort from active is allowed",
    route: (missionId) => `/missions/${missionId}/abort`,
    requestBody: { actorId: "operator-1", reason: "weather" },
    fromStatus: "active",
    allowed: true,
    expectedToStatus: "aborted",
    expectedEventType: "mission.aborted",
    expectedErrorMessage: "Mission cannot be aborted from status active",
  },
  {
    name: "abort from completed is rejected",
    route: (missionId) => `/missions/${missionId}/abort`,
    requestBody: { actorId: "operator-1", reason: "should fail" },
    fromStatus: "completed",
    allowed: false,
    expectedEventType: "mission.aborted",
    expectedErrorMessage: "Mission cannot be aborted from status completed",
  },
  {
    name: "abort from aborted is rejected",
    route: (missionId) => `/missions/${missionId}/abort`,
    requestBody: { actorId: "operator-1", reason: "should fail" },
    fromStatus: "aborted",
    allowed: false,
    expectedEventType: "mission.aborted",
    expectedErrorMessage: "Mission cannot be aborted from status aborted",
  },
];

describe("mission transition matrix integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  for (const testCase of transitionCases) {
    it(testCase.name, async () => {
      const missionId = randomUUID();

      await insertMission({
        id: missionId,
        status: testCase.fromStatus,
      });

      const stateBefore = await getMissionState(missionId);
      const eventsBefore = await getMissionEvents(missionId);

      const response = await request(app)
        .post(testCase.route(missionId))
        .send(testCase.requestBody);

      if (testCase.allowed) {
        expect(response.status).toBe(204);

        const stateAfter = await getMissionState(missionId);
        expect(stateAfter.status).toBe(testCase.expectedToStatus);

        const eventsAfter = await getMissionEvents(missionId);
        const matchingEvents = eventsAfter.filter(
          (item) => item.type === testCase.expectedEventType,
        );

        expect(matchingEvents).toHaveLength(1);
        expect(matchingEvents[0]).toMatchObject({
          type: testCase.expectedEventType,
          fromState: testCase.fromStatus,
          toState: testCase.expectedToStatus,
        });

        expect(await countMissionEventsByType(
          missionId,
          testCase.expectedEventType,
        )).toBe(1);
      } else {
        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
          error: {
            message: expect.stringContaining(testCase.expectedErrorMessage),
            type: "invalid_state_transition",
          },
        });

        expect(await getMissionState(missionId)).toEqual(stateBefore);
        expect(await getMissionEvents(missionId)).toEqual(eventsBefore);
        expect(await countMissionEventsByType(
          missionId,
          testCase.expectedEventType,
        )).toBe(0);
      }
    });
  }
});