import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

type InsertMissionParams = {
  id: string;
  status: string;
  missionPlanId?: string;
  lastEventSequenceNo?: number;
};

type InsertTelemetryParams = {
  id?: string;
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

const insertMission = async (params: InsertMissionParams) => {
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

const insertTelemetry = async (params: InsertTelemetryParams) => {
  await pool.query(
    `
    INSERT INTO mission_telemetry (
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    `,
    [
      params.id ?? randomUUID(),
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

const getTelemetryRows = async (missionId: string) => {
  const result = await pool.query(
    `
    SELECT
      id,
      mission_id,
      recorded_at,
      lat,
      lng,
      altitude_m,
      speed_mps,
      heading_deg,
      progress_pct,
      payload,
      created_at
    FROM mission_telemetry
    WHERE mission_id = $1
    ORDER BY recorded_at ASC, created_at ASC, id ASC
    `,
    [missionId],
  );

  return result.rows as Array<{
    id: string;
    mission_id: string;
    recorded_at: string | Date;
    lat: number | null;
    lng: number | null;
    altitude_m: number | null;
    speed_mps: number | null;
    heading_deg: number | null;
    progress_pct: number | null;
    payload: Record<string, unknown>;
    created_at: string | Date;
  }>;
};

const getAlertsForMission = async (missionId: string) => {
  const result = await pool.query(
    `
    SELECT
      id,
      mission_id,
      alert_type,
      status,
      triggered_at,
      resolved_at
    FROM alerts
    WHERE mission_id = $1
    ORDER BY triggered_at ASC
    `,
    [missionId],
  );

  return result.rows as Array<{
    id: string;
    mission_id: string;
    alert_type: string;
    status: string;
    triggered_at: string | Date;
    resolved_at: string | Date | null;
  }>;
};

const countTelemetryRows = async (missionId: string) => {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM mission_telemetry
    WHERE mission_id = $1
    `,
    [missionId],
  );

  return result.rows[0].count as number;
};

const getMissionStatus = async (missionId: string) => {
  const result = await pool.query(
    `
    SELECT status
    FROM missions
    WHERE id = $1
    `,
    [missionId],
  );

  expect(result.rows).toHaveLength(1);
  return result.rows[0].status as string;
};

describe("telemetry integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM mission_telemetry");
    await pool.query("DELETE FROM mission_events");
    await pool.query("DELETE FROM missions");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("POST /missions/:id/telemetry persists exactly one telemetry row for an active mission", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "active",
    });

    const response = await request(app)
      .post(`/missions/${missionId}/telemetry`)
      .send({
        records: [
          {
            timestamp: "2026-04-13T10:15:30Z",
            lat: 51.5074,
            lng: -0.1278,
            altitudeM: 1200,
          },
        ],
      });

    expect(response.status).toBe(202);

    const rows = await getTelemetryRows(missionId);
    expect(rows).toHaveLength(1);

    expect(rows[0]).toMatchObject({
      mission_id: missionId,
      lat: 51.5074,
      lng: -0.1278,
      altitude_m: 1200,
    });

    expect(new Date(rows[0].recorded_at).toISOString()).toBe(
      "2026-04-13T10:15:30.000Z",
    );

    expect(await countTelemetryRows(missionId)).toBe(1);
    expect(await getMissionStatus(missionId)).toBe("active");
  });

it("POST /missions/:id/telemetry resolves ALTITUDE_HIGH alert when altitude normalizes", async () => {
  const missionId = randomUUID();

  await insertMission({
    id: missionId,
    status: "active",
  });

  // Step 1: trigger alert
  await request(app)
    .post(`/missions/${missionId}/telemetry`)
    .send({
      records: [
        {
          timestamp: "2026-04-15T10:00:00Z",
          lat: 51.5,
          lng: -0.1,
          altitudeM: 1200,
        },
      ],
    });

  // Step 2: normalize altitude
  const response = await request(app)
    .post(`/missions/${missionId}/telemetry`)
    .send({
      records: [
        {
          timestamp: "2026-04-15T10:02:00Z",
          lat: 51.5,
          lng: -0.1,
          altitudeM: 900, // below threshold
        },
      ],
    });

  expect(response.status).toBe(202);

  const alerts = await getAlertsForMission(missionId);

  expect(alerts).toHaveLength(1);
  expect(alerts[0].status).toBe("resolved");

  expect(new Date(alerts[0].resolved_at!).toISOString()).toBe(
    "2026-04-15T10:02:00.000Z",
  );
});

it("POST /missions/:id/telemetry does not create duplicate ALTITUDE_HIGH alerts", async () => {
  const missionId = randomUUID();

  await insertMission({
    id: missionId,
    status: "active",
  });

  // First trigger
  await request(app)
    .post(`/missions/${missionId}/telemetry`)
    .send({
      records: [
        {
          timestamp: "2026-04-15T10:00:00Z",
          lat: 51.5,
          lng: -0.1,
          altitudeM: 1200,
        },
      ],
    });

  // Second trigger (still high)
  await request(app)
    .post(`/missions/${missionId}/telemetry`)
    .send({
      records: [
        {
          timestamp: "2026-04-15T10:01:00Z",
          lat: 51.5,
          lng: -0.1,
          altitudeM: 1300,
        },
      ],
    });

  const alerts = await getAlertsForMission(missionId);

  expect(alerts).toHaveLength(1);
  expect(alerts[0].status).toBe("open");
});

  it("POST /missions/:id/telemetry rejects inactive mission and does not persist telemetry", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "completed",
    });

    const rowsBefore = await getTelemetryRows(missionId);

    const response = await request(app)
      .post(`/missions/${missionId}/telemetry`)
      .send({
        records: [
          {
            timestamp: "2026-04-13T10:15:30Z",
            lat: 51.5074,
            lng: -0.1278,
            altitudeM: 1200,
          },
        ],
      });

    expect(response.status).toBe(409);

    expect(await getMissionStatus(missionId)).toBe("completed");
    expect(await getTelemetryRows(missionId)).toEqual(rowsBefore);
    expect(await countTelemetryRows(missionId)).toBe(0);
  });

  it("POST /missions/:id/telemetry rejects invalid request and does not persist telemetry", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "active",
    });

    const response = await request(app)
      .post(`/missions/${missionId}/telemetry`)
      .send({
        records: [
          {
            timestamp: "not-a-date",
            lat: "bad-latitude",
            lng: -0.1278,
          },
        ],
      });

    expect(response.status).toBe(400);

    expect(await getMissionStatus(missionId)).toBe("active");
    expect(await getTelemetryRows(missionId)).toEqual([]);
    expect(await countTelemetryRows(missionId)).toBe(0);
  });

it("creates SPEED_HIGH alert when speed exceeds threshold", async () => {
  const missionId = randomUUID();

  await insertMission({ id: missionId, status: "active" });

  await request(app)
    .post(`/missions/${missionId}/telemetry`)
    .send({
      records: [
        {
          timestamp: "2026-04-15T10:00:00Z",
          lat: 0,
          lng: 0,
          speedMps: 60,
        },
      ],
    });

  const alerts = await getAlertsForMission(missionId);

  expect(alerts).toHaveLength(1);
  expect(alerts[0].alert_type).toBe("SPEED_HIGH");
});


  it("POST /missions/:id/telemetry rejects unknown mission and does not persist telemetry", async () => {
    const missionId = randomUUID();

    const response = await request(app)
      .post(`/missions/${missionId}/telemetry`)
      .send({
        records: [
          {
            timestamp: "2026-04-13T10:15:30Z",
            lat: 51.5074,
            lng: -0.1278,
            altitudeM: 1200,
          },
        ],
      });

    expect(response.status).toBe(404);
    expect(await countTelemetryRows(missionId)).toBe(0);
  });

  it("GET /missions/:id/telemetry/latest returns the most recent telemetry record for the requested mission only", async () => {
    const missionId = randomUUID();
    const otherMissionId = randomUUID();

    await insertMission({ id: missionId, status: "active" });
    await insertMission({ id: otherMissionId, status: "active" });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:00:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 900,
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:30:00Z",
      lat: 51.6,
      lng: -0.2,
      altitudeM: 950,
    });

    await insertTelemetry({
      missionId: otherMissionId,
      recordedAt: "2026-04-13T10:45:00Z",
      lat: 10,
      lng: 20,
      altitudeM: 9999,
    });

    const response = await request(app).get(
      `/missions/${missionId}/telemetry/latest`,
    );

    expect(response.status).toBe(200);
    expect(response.body.missionId).toBe(missionId);
  });

  it("GET /missions/:id/telemetry/latest returns not found or empty contract when no telemetry exists and does not mutate state", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "active",
    });

    const response = await request(app).get(
      `/missions/${missionId}/telemetry/latest`,
    );

    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      expect(response.body.missionId).toBe(missionId);
    }

    expect(await getMissionStatus(missionId)).toBe("active");
    expect(await getTelemetryRows(missionId)).toEqual([]);
  });

  it("GET /missions/:id/telemetry returns telemetry ordered by recordedAt descending for the requested range", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "active",
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T09:55:00Z",
      lat: 1,
      lng: 1,
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:05:00Z",
      lat: 2,
      lng: 2,
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:15:00Z",
      lat: 3,
      lng: 3,
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:25:00Z",
      lat: 4,
      lng: 4,
    });

    const response = await request(app)
      .get(`/missions/${missionId}/telemetry`)
      .query({
        from: "2026-04-13T10:00:00Z",
        to: "2026-04-13T10:20:00Z",
      });

    expect(response.status).toBe(200);
    expect(response.body.missionId).toBe(missionId);
    expect(response.body.records).toHaveLength(2);

    // 🔥 THIS is where it goes
    expect(
      response.body.records.map((r: { timestamp: string }) =>
        new Date(r.timestamp).toISOString(),
      ),
    ).toEqual([
      "2026-04-13T10:15:00.000Z", // later first
      "2026-04-13T10:05:00.000Z", // earlier second
    ]);

    expect(
      response.body.records.map((item: { lat: number }) => item.lat),
    ).toEqual([3, 2]);
  });

  it("GET /missions/:id/telemetry does not leak telemetry from another mission", async () => {
    const missionId = randomUUID();
    const otherMissionId = randomUUID();

    await insertMission({ id: missionId, status: "active" });
    await insertMission({ id: otherMissionId, status: "active" });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:05:00Z",
      lat: 11,
      lng: 11,
    });

    await insertTelemetry({
      missionId: otherMissionId,
      recordedAt: "2026-04-13T10:06:00Z",
      lat: 22,
      lng: 22,
    });

    const response = await request(app)
      .get(`/missions/${missionId}/telemetry`)
      .query({
        from: "2026-04-13T10:00:00Z",
        to: "2026-04-13T10:10:00Z",
      });

    expect(response.status).toBe(200);
    expect(response.body.missionId).toBe(missionId);
    expect(response.body.records).toHaveLength(1);
    expect(response.body.records[0].lat).toBe(11);
  });

  it("GET /missions/:id/telemetry rejects invalid query params and does not mutate state", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "active",
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:05:00Z",
      lat: 1,
      lng: 1,
    });

    const rowsBefore = await getTelemetryRows(missionId);

    const response = await request(app)
      .get(`/missions/${missionId}/telemetry`)
      .query({
        from: "bad-date",
        to: "2026-04-13T10:20:00Z",
      });

    expect(response.status).toBe(400);
    expect(await getTelemetryRows(missionId)).toEqual(rowsBefore);
  });

  it("POST /missions/:id/telemetry followed by GET latest and GET history produces a consistent read chain", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "active",
    });

    const postOne = await request(app)
      .post(`/missions/${missionId}/telemetry`)
      .send({
        records: [
          {
            timestamp: "2026-04-13T10:01:00Z",
            lat: 51.5001,
            lng: -0.1001,
            altitudeM: 100,
          },
        ],
      });

    expect(postOne.status).toBe(202);

    const postTwo = await request(app)
      .post(`/missions/${missionId}/telemetry`)
      .send({
        records: [
          {
            timestamp: "2026-04-13T10:02:00Z",
            lat: 51.5002,
            lng: -0.1002,
            altitudeM: 200,
          },
        ],
      });

    expect(postTwo.status).toBe(202);

    const latestResponse = await request(app).get(
      `/missions/${missionId}/telemetry/latest`,
    );

    expect(latestResponse.status).toBe(200);
    expect(latestResponse.body.missionId).toBe(missionId);

    const historyResponse = await request(app)
      .get(`/missions/${missionId}/telemetry`)
      .query({
        from: "2026-04-13T10:00:00Z",
        to: "2026-04-13T10:05:00Z",
      });

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.missionId).toBe(missionId);
    expect(historyResponse.body.records).toHaveLength(2);

    expect(
      historyResponse.body.records.map((item: { timestamp: string }) =>
        new Date(item.timestamp).toISOString(),
      ),
    ).toEqual([
      "2026-04-13T10:02:00.000Z",
      "2026-04-13T10:01:00.000Z",
    ]);

    expect(await countTelemetryRows(missionId)).toBe(2);
  });

  it("GET /missions/:id/telemetry returns empty when range matches no records and does not mutate state", async () => {
    const missionId = randomUUID();

    await insertMission({
      id: missionId,
      status: "active",
    });

    await insertTelemetry({
      missionId,
      recordedAt: "2026-04-13T10:05:00Z",
      lat: 1,
      lng: 1,
    });

    const rowsBefore = await getTelemetryRows(missionId);

    const response = await request(app)
      .get(`/missions/${missionId}/telemetry`)
      .query({
        from: "2026-04-13T11:00:00Z",
        to: "2026-04-13T11:05:00Z",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      missionId,
      records: [],
    });
    expect(await getTelemetryRows(missionId)).toEqual(rowsBefore);
  });
});