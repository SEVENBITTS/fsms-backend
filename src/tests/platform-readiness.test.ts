import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearPlatformTables = async () => {
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

const countPlatformRows = async (platformId: string) => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from platforms where id = $1) as platform_count,
      (select count(*)::int from maintenance_schedules where platform_id = $1) as schedule_count,
      (select count(*)::int from maintenance_records where platform_id = $1) as record_count
    `,
    [platformId],
  );

  return result.rows[0] as {
    platform_count: number;
    schedule_count: number;
    record_count: number;
  };
};

describe("platform readiness integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearPlatformTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("passes readiness for an active platform with no overdue maintenance", async () => {
    const platform = await createPlatform({
      name: "Ready UAV",
      status: "active",
      totalFlightHours: 10,
    });

    const before = await countPlatformRows(platform.id);
    const response = await request(app).get(`/platforms/${platform.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      platformId: platform.id,
      result: "pass",
      reasons: [
        {
          code: "PLATFORM_ACTIVE",
          severity: "pass",
          message: "Platform is active with no overdue maintenance",
        },
      ],
    });
    expect(response.body.maintenanceStatus.effectiveStatus).toBe("active");
    expect(await countPlatformRows(platform.id)).toEqual(before);
  });

  it("warns readiness for an active platform with overdue maintenance", async () => {
    const platform = await createPlatform({
      name: "Due UAV",
      status: "active",
      totalFlightHours: 50,
    });

    const scheduleResponse = await request(app)
      .post(`/platforms/${platform.id}/maintenance-schedules`)
      .send({
        taskName: "Airframe inspection",
        nextDueFlightHours: 40,
      });

    expect(scheduleResponse.status).toBe(201);
    const scheduleId = scheduleResponse.body.schedule.id;
    const before = await countPlatformRows(platform.id);

    const response = await request(app).get(`/platforms/${platform.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("warning");
    expect(response.body.reasons).toContainEqual({
      code: "PLATFORM_MAINTENANCE_DUE",
      severity: "warning",
      message: "Platform has overdue maintenance requiring review before mission use",
      relatedScheduleIds: [scheduleId],
    });
    expect(response.body.maintenanceStatus.effectiveStatus).toBe("maintenance_due");
    expect(response.body.maintenanceStatus.dueSchedules).toHaveLength(1);
    expect(await countPlatformRows(platform.id)).toEqual(before);
  });

  it("warns readiness for an inactive platform", async () => {
    const platform = await createPlatform({
      name: "Inactive UAV",
      status: "inactive",
    });

    const response = await request(app).get(`/platforms/${platform.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      platformId: platform.id,
      result: "warning",
      reasons: [
        {
          code: "PLATFORM_INACTIVE",
          severity: "warning",
          message: "Platform is inactive and requires review before mission use",
        },
      ],
    });
  });

  it.each([
    {
      status: "grounded",
      code: "PLATFORM_GROUNDED",
      message: "Platform is grounded and is not fit for mission use",
    },
    {
      status: "retired",
      code: "PLATFORM_RETIRED",
      message: "Platform is retired and is not fit for mission use",
    },
  ])("fails readiness for a $status platform", async ({ status, code, message }) => {
    const platform = await createPlatform({
      name: `${status} UAV`,
      status,
    });

    const response = await request(app).get(`/platforms/${platform.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      platformId: platform.id,
      result: "fail",
      reasons: [
        {
          code,
          severity: "fail",
          message,
        },
      ],
    });
  });

  it("returns not found for unknown platforms", async () => {
    const response = await request(app).get(
      "/platforms/7a2ed2c4-e238-4743-aa60-5bcd5a50d7b7/readiness",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "platform_not_found",
      },
    });
  });
});
