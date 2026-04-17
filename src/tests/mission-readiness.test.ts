import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
  await pool.query("delete from maintenance_records");
  await pool.query("delete from maintenance_schedules");
  await pool.query("delete from platforms");
};

const createPlatform = async (params: {
  name: string;
  status?: string;
  totalFlightHours?: number;
}) => {
  const response = await request(app).post("/platforms").send(params);
  expect(response.status).toBe(201);
  return response.body.platform as { id: string };
};

const insertMission = async (params: {
  id?: string;
  status?: string;
  platformId?: string | null;
}) => {
  const missionId = params.id ?? randomUUID();

  await pool.query(
    `
    insert into missions (
      id,
      status,
      mission_plan_id,
      platform_id,
      last_event_sequence_no
    )
    values ($1, $2, $3, $4, $5)
    `,
    [
      missionId,
      params.status ?? "submitted",
      "plan-1",
      params.platformId ?? null,
      0,
    ],
  );

  return missionId;
};

const countRows = async (params: { missionId: string; platformId?: string }) => {
  const result = await pool.query(
    `
    select
      (select status from missions where id = $1) as mission_status,
      (select last_event_sequence_no from missions where id = $1) as mission_sequence,
      (select count(*)::int from mission_events where mission_id = $1) as mission_event_count,
      (select count(*)::int from platforms where id = $2) as platform_count,
      (select count(*)::int from maintenance_schedules where platform_id = $2) as schedule_count,
      (select count(*)::int from maintenance_records where platform_id = $2) as record_count
    `,
    [params.missionId, params.platformId ?? null],
  );

  return result.rows[0] as {
    mission_status: string;
    mission_sequence: number;
    mission_event_count: number;
    platform_count: number;
    schedule_count: number;
    record_count: number;
  };
};

describe("mission readiness platform gate integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("passes the mission platform gate when the assigned platform is ready", async () => {
    const platform = await createPlatform({
      name: "Mission Ready UAV",
      status: "active",
    });
    const missionId = await insertMission({ platformId: platform.id });
    const before = await countRows({ missionId, platformId: platform.id });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      result: "pass",
      gate: {
        result: "pass",
        blocksApproval: false,
        blocksDispatch: false,
        requiresReview: false,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_READY",
          severity: "pass",
          source: "platform",
          relatedPlatformId: platform.id,
          relatedPlatformReasonCodes: ["PLATFORM_ACTIVE"],
        },
      ],
      platformReadiness: {
        platformId: platform.id,
        result: "pass",
      },
    });
    expect(await countRows({ missionId, platformId: platform.id })).toEqual(before);
  });

  it("surfaces a warning when the assigned platform has overdue maintenance", async () => {
    const platform = await createPlatform({
      name: "Maintenance Due UAV",
      status: "active",
      totalFlightHours: 55,
    });
    const missionId = await insertMission({ platformId: platform.id });

    const scheduleResponse = await request(app)
      .post(`/platforms/${platform.id}/maintenance-schedules`)
      .send({
        taskName: "Propulsion inspection",
        nextDueFlightHours: 50,
      });

    expect(scheduleResponse.status).toBe(201);
    const before = await countRows({ missionId, platformId: platform.id });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      result: "warning",
      gate: {
        result: "warning",
        blocksApproval: false,
        blocksDispatch: false,
        requiresReview: true,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_WARNING",
          severity: "warning",
          source: "platform",
          relatedPlatformId: platform.id,
          relatedPlatformReasonCodes: ["PLATFORM_MAINTENANCE_DUE"],
        },
      ],
      platformReadiness: {
        platformId: platform.id,
        result: "warning",
      },
    });
    expect(await countRows({ missionId, platformId: platform.id })).toEqual(before);
  });

  it.each([
    {
      status: "grounded",
      platformCode: "PLATFORM_GROUNDED",
    },
    {
      status: "retired",
      platformCode: "PLATFORM_RETIRED",
    },
  ])("fails the mission platform gate for a $status platform", async ({ status, platformCode }) => {
    const platform = await createPlatform({
      name: `${status} UAV`,
      status,
    });
    const missionId = await insertMission({ platformId: platform.id });
    const before = await countRows({ missionId, platformId: platform.id });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      result: "fail",
      gate: {
        result: "fail",
        blocksApproval: true,
        blocksDispatch: true,
        requiresReview: false,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_FAILED",
          severity: "fail",
          source: "platform",
          relatedPlatformId: platform.id,
          relatedPlatformReasonCodes: [platformCode],
        },
      ],
      platformReadiness: {
        platformId: platform.id,
        result: "fail",
      },
    });
    expect(await countRows({ missionId, platformId: platform.id })).toEqual(before);
  });

  it("fails explicitly when the mission has no assigned platform", async () => {
    const missionId = await insertMission({ platformId: null });
    const before = await countRows({ missionId });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: null,
      result: "fail",
      gate: {
        result: "fail",
        blocksApproval: true,
        blocksDispatch: true,
        requiresReview: false,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_NOT_ASSIGNED",
          severity: "fail",
          source: "mission",
        },
      ],
      platformReadiness: null,
    });
    expect(await countRows({ missionId })).toEqual(before);
  });

  it("fails explicitly when a candidate platform override is unknown", async () => {
    const platform = await createPlatform({
      name: "Assigned UAV",
      status: "active",
    });
    const missingPlatformId = randomUUID();
    const missionId = await insertMission({ platformId: platform.id });
    const before = await countRows({ missionId, platformId: platform.id });

    const response = await request(app)
      .get(`/missions/${missionId}/readiness`)
      .query({ platformId: missingPlatformId });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: missingPlatformId,
      result: "fail",
      gate: {
        result: "fail",
        blocksApproval: true,
        blocksDispatch: true,
        requiresReview: false,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_NOT_FOUND",
          severity: "fail",
          source: "mission",
          relatedPlatformId: missingPlatformId,
        },
      ],
      platformReadiness: null,
    });
    expect(await countRows({ missionId, platformId: platform.id })).toEqual(before);
  });
});
