import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

type InsertTelemetryParams = {
  missionId: string;
  recordedAt: string;
  lat?: number | null;
  lng?: number | null;
  altitudeM?: number | null;
  speedMps?: number | null;
  headingDeg?: number | null;
  progressPct?: number | null;
  payload?: Record<string, unknown>;
};

const insertMission = async (id: string, status = "active") => {
  await pool.query(
    `
    insert into missions (
      id,
      status,
      mission_plan_id,
      last_event_sequence_no
    )
    values ($1, $2, 'plan-1', 0)
    `,
    [id, status],
  );
};

const insertTelemetry = async (params: InsertTelemetryParams) => {
  await pool.query(
    `
    insert into mission_telemetry (
      id,
      mission_id,
      recorded_at,
      lat,
      lng,
      altitude_m,
      speed_mps,
      heading_deg,
      progress_pct,
      payload
    )
    values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    `,
    [
      params.missionId,
      params.recordedAt,
      params.lat ?? null,
      params.lng ?? null,
      params.altitudeM ?? null,
      params.speedMps ?? null,
      params.headingDeg ?? null,
      params.progressPct ?? null,
      JSON.stringify(params.payload ?? {}),
    ],
  );
};

const getMissionSnapshot = async (missionId: string) => {
  const missionResult = await pool.query(
    `
    select status, last_event_sequence_no
    from missions
    where id = $1
    `,
    [missionId],
  );

  const eventCountResult = await pool.query(
    `
    select count(*)::int as count
    from mission_events
    where mission_id = $1
    `,
    [missionId],
  );

  return {
    mission: missionResult.rows[0],
    eventCount: eventCountResult.rows[0].count as number,
  };
};

describe("mission replay integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query("delete from alerts");
    await pool.query("delete from mission_telemetry");
    await pool.query("delete from mission_events");
    await pool.query("delete from missions");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("GET /missions/:id/replay returns all replay records oldest-first without mutating mission state", async () => {
    const missionId = randomUUID();

    await insertMission(missionId);

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:20:00Z",
      lat: 3,
      lng: 3,
      altitudeM: 130,
      speedMps: 12,
      headingDeg: 90,
      progressPct: 30,
      payload: { point: "third" },
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:00:00Z",
      lat: 1,
      lng: 1,
      altitudeM: 110,
      payload: { point: "first" },
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:10:00Z",
      lat: 2,
      lng: 2,
      altitudeM: 120,
      payload: { point: "second" },
    });

    const before = await getMissionSnapshot(missionId);

    const response = await request(app).get(`/missions/${missionId}/replay`);

    expect(response.status).toBe(200);
    expect(response.body.missionId).toBe(missionId);
    expect(response.body.replay).toHaveLength(3);
    expect(
      response.body.replay.map((item: { timestamp: string }) =>
        new Date(item.timestamp).toISOString(),
      ),
    ).toEqual([
      "2026-04-13T10:00:00.000Z",
      "2026-04-13T10:10:00.000Z",
      "2026-04-13T10:20:00.000Z",
    ]);

    expect(response.body.replay[0]).toMatchObject({
      lat: 1,
      lng: 1,
      altitudeM: 110,
      payload: { point: "first" },
    });

    expect(await getMissionSnapshot(missionId)).toEqual(before);
  });

  it("GET /missions/:id/replay respects mission isolation and requested time range", async () => {
    const missionId = randomUUID();
    const otherMissionId = randomUUID();

    await insertMission(missionId);
    await insertMission(otherMissionId);

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T09:55:00Z",
      lat: 1,
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:05:00Z",
      lat: 2,
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:15:00Z",
      lat: 3,
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:25:00Z",
      lat: 4,
    });

    await insertTelemetry({
      missionId: otherMissionId,
      recordedAt: "2026-04-13T10:10:00Z",
      lat: 999,
    });

    const before = await getMissionSnapshot(missionId);

    const response = await request(app)
      .get(`/missions/${missionId}/replay`)
      .query({
        from: "2026-04-13T10:00:00Z",
        to: "2026-04-13T10:20:00Z",
      });

    expect(response.status).toBe(200);
    expect(response.body.missionId).toBe(missionId);
    expect(response.body.replay).toHaveLength(2);
    expect(
      response.body.replay.map((item: { timestamp: string }) =>
        new Date(item.timestamp).toISOString(),
      ),
    ).toEqual([
      "2026-04-13T10:05:00.000Z",
      "2026-04-13T10:15:00.000Z",
    ]);
    expect(response.body.replay.map((item: { lat: number }) => item.lat)).toEqual([
      2,
      3,
    ]);

    expect(await getMissionSnapshot(missionId)).toEqual(before);
  });

  it("GET /missions/:id/replay rejects invalid query params without mutating mission state", async () => {
    const missionId = randomUUID();

    await insertMission(missionId);
    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:05:00Z",
      lat: 1,
    });

    const before = await getMissionSnapshot(missionId);

    const invalidDateResponse = await request(app)
      .get(`/missions/${missionId}/replay`)
      .query({
        from: "not-a-date",
      });

    expect(invalidDateResponse.status).toBe(400);
    expect(invalidDateResponse.body).toMatchObject({
      error: {
        type: "mission_replay_validation_error",
      },
    });

    const invalidRangeResponse = await request(app)
      .get(`/missions/${missionId}/replay`)
      .query({
        from: "2026-04-13T11:00:00Z",
        to: "2026-04-13T10:00:00Z",
      });

    expect(invalidRangeResponse.status).toBe(400);
    expect(invalidRangeResponse.body).toMatchObject({
      error: {
        type: "mission_replay_validation_error",
        message: "from must be <= to",
      },
    });

    expect(await getMissionSnapshot(missionId)).toEqual(before);
  });
});
