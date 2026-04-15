import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";
import { MissionTelemetryService } from "../missions/mission-telemetry.service";
import { MissionRepository } from "../missions/mission.repository";
import { MissionTelemetryRepository } from "../missions/mission-telemetry.repository";
import { MissionLifecyclePolicy } from "../missions/mission-lifecycle.policy";
import { AlertRepository } from "../alerts/alert.repository";
import { AlertService } from "../alerts/alert.service";
const createService = () =>
  new MissionTelemetryService(
  pool,
  new MissionRepository(),
  new MissionTelemetryRepository(),
  new MissionLifecyclePolicy(),
  new AlertService(pool, new AlertRepository()),
)

const service = createService();

const insertMission = async (id: string, status: string) => {
  await pool.query(
    `
    INSERT INTO missions (id, status, mission_plan_id, last_event_sequence_no)
    VALUES ($1, $2, 'plan-1', 0)
    `,
    [id, status],
  );
};

const getTelemetryRows = async (missionId: string) => {
  const result = await pool.query(
    `SELECT * FROM mission_telemetry WHERE mission_id = $1`,
    [missionId],
  );
  return result.rows;
};

describe("MissionTelemetryService", () => {
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

  // ✅ Happy path
  it("records telemetry for an active mission", async () => {
    const missionId = randomUUID();

    await insertMission(missionId, "active");

    await service.recordTelemetry(missionId, {
      records: [
        {
          timestamp: "2026-04-13T10:15:30Z",
          lat: 51.5,
          lng: -0.1,
          altitudeM: 1000,
        },
      ],
    });

    const rows = await getTelemetryRows(missionId);

    expect(rows).toHaveLength(1);
    expect(rows[0].lat).toBe(51.5);
  });

  // ❌ inactive mission
  it("throws if mission is not active", async () => {
    const missionId = randomUUID();

    await insertMission(missionId, "completed");

    await expect(
      service.recordTelemetry(missionId, {
        records: [
          {
            timestamp: "2026-04-13T10:15:30Z",
            lat: 1,
          },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  // ❌ invalid payload
  it("throws on invalid telemetry payload", async () => {
    const missionId = randomUUID();

    await insertMission(missionId, "active");

    await expect(
      service.recordTelemetry(missionId, {
        records: [
          {
            timestamp: "not-a-date",
            lat: 1,
          },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  // ❌ unknown mission
  it("throws if mission does not exist", async () => {
    const missionId = randomUUID();

    await expect(
      service.recordTelemetry(missionId, {
        records: [
          {
            timestamp: "2026-04-13T10:15:30Z",
            lat: 1,
          },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  // 📊 history query
  it("returns telemetry history within range", async () => {
    const missionId = randomUUID();

    await insertMission(missionId, "active");

    await pool.query(`
      INSERT INTO mission_telemetry (id, mission_id, recorded_at, lat)
      VALUES
        (gen_random_uuid(), '${missionId}', '2026-04-13T10:00:00Z', 1),
        (gen_random_uuid(), '${missionId}', '2026-04-13T10:10:00Z', 2)
    `);

    const result = await service.getTelemetryHistory(missionId, {
      from: "2026-04-13T09:00:00Z",
      to: "2026-04-13T11:00:00Z",
    });

    expect(result.records).toHaveLength(2);
  });

  // ❌ invalid query
  it("throws on invalid history query", async () => {
    const missionId = randomUUID();

    await insertMission(missionId, "active");

    await expect(
      service.getTelemetryHistory(missionId, {
        from: "bad-date",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});