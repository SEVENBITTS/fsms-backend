import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearPlatformTables = async () => {
  await pool.query("delete from maintenance_records");
  await pool.query("delete from maintenance_schedules");
  await pool.query("delete from platforms");
};

describe("platform maintenance integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearPlatformTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates and reads a UAV platform with operational status", async () => {
    const createResponse = await request(app)
      .post("/platforms")
      .send({
        name: "UAV Alpha",
        registration: "G-FSMS-001",
        platformType: "multi-rotor",
        manufacturer: "FSMS Test",
        model: "Prototype X",
        serialNumber: "SN-001",
        status: "active",
        totalFlightHours: 12.5,
        notes: "Initial concept-test aircraft",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.platform).toMatchObject({
      name: "UAV Alpha",
      registration: "G-FSMS-001",
      platformType: "multi-rotor",
      manufacturer: "FSMS Test",
      model: "Prototype X",
      serialNumber: "SN-001",
      status: "active",
      totalFlightHours: 12.5,
      notes: "Initial concept-test aircraft",
    });

    const platformId = createResponse.body.platform.id;

    const readResponse = await request(app).get(`/platforms/${platformId}`);

    expect(readResponse.status).toBe(200);
    expect(readResponse.body.platform).toMatchObject({
      id: platformId,
      name: "UAV Alpha",
      status: "active",
    });
  });

  it("reports maintenance_due when an active platform has overdue maintenance", async () => {
    const platformResponse = await request(app)
      .post("/platforms")
      .send({
        name: "UAV Bravo",
        status: "active",
        totalFlightHours: 50,
      });

    const platformId = platformResponse.body.platform.id;

    const scheduleResponse = await request(app)
      .post(`/platforms/${platformId}/maintenance-schedules`)
      .send({
        taskName: "Airframe inspection",
        description: "Routine airframe inspection",
        intervalDays: 30,
        intervalFlightHours: 25,
        nextDueAt: "2026-01-01T00:00:00Z",
        nextDueFlightHours: 40,
      });

    expect(scheduleResponse.status).toBe(201);
    expect(scheduleResponse.body.schedule).toMatchObject({
      platformId,
      taskName: "Airframe inspection",
      intervalDays: 30,
      intervalFlightHours: 25,
      nextDueAt: "2026-01-01T00:00:00.000Z",
      nextDueFlightHours: 40,
      status: "active",
    });

    const statusResponse = await request(app).get(
      `/platforms/${platformId}/maintenance-status`,
    );

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.platform.id).toBe(platformId);
    expect(statusResponse.body.platform.status).toBe("active");
    expect(statusResponse.body.effectiveStatus).toBe("maintenance_due");
    expect(statusResponse.body.dueSchedules).toHaveLength(1);
    expect(statusResponse.body.dueSchedules[0]).toMatchObject({
      taskName: "Airframe inspection",
    });
  });

  it("records completed maintenance and updates the linked schedule due thresholds", async () => {
    const platformResponse = await request(app)
      .post("/platforms")
      .send({
        name: "UAV Charlie",
        status: "active",
        totalFlightHours: 10,
      });

    const platformId = platformResponse.body.platform.id;

    const scheduleResponse = await request(app)
      .post(`/platforms/${platformId}/maintenance-schedules`)
      .send({
        taskName: "Propeller replacement",
        intervalDays: 30,
        intervalFlightHours: 25,
        nextDueAt: "2026-01-01T00:00:00Z",
        nextDueFlightHours: 5,
      });

    const scheduleId = scheduleResponse.body.schedule.id;

    const recordResponse = await request(app)
      .post(`/platforms/${platformId}/maintenance-records`)
      .send({
        scheduleId,
        completedAt: "2026-04-15T10:00:00Z",
        completedBy: "engineer-1",
        completedFlightHours: 12,
        notes: "Props replaced and checked",
        evidenceRef: "maint-2026-04-15-props",
      });

    expect(recordResponse.status).toBe(201);
    expect(recordResponse.body.record).toMatchObject({
      platformId,
      scheduleId,
      taskName: "Propeller replacement",
      completedAt: "2026-04-15T10:00:00.000Z",
      completedBy: "engineer-1",
      completedFlightHours: 12,
      notes: "Props replaced and checked",
      evidenceRef: "maint-2026-04-15-props",
    });

    const statusResponse = await request(app).get(
      `/platforms/${platformId}/maintenance-status`,
    );

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.effectiveStatus).toBe("active");
    expect(statusResponse.body.dueSchedules).toEqual([]);
    expect(statusResponse.body.upcomingSchedules).toHaveLength(1);
    expect(statusResponse.body.upcomingSchedules[0]).toMatchObject({
      id: scheduleId,
      lastCompletedAt: "2026-04-15T10:00:00.000Z",
      lastCompletedFlightHours: 12,
      nextDueAt: "2026-05-15T10:00:00.000Z",
      nextDueFlightHours: 37,
    });
    expect(statusResponse.body.latestRecords).toHaveLength(1);
  });

  it("rejects incomplete maintenance records without mutating stored records", async () => {
    const platformResponse = await request(app)
      .post("/platforms")
      .send({
        name: "UAV Delta",
      });

    const platformId = platformResponse.body.platform.id;

    const invalidResponse = await request(app)
      .post(`/platforms/${platformId}/maintenance-records`)
      .send({
        completedAt: "2026-04-15T10:00:00Z",
        completedBy: "engineer-1",
      });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body).toMatchObject({
      error: {
        type: "platform_validation_error",
        message: "taskName is required when scheduleId is not provided",
      },
    });

    const statusResponse = await request(app).get(
      `/platforms/${platformId}/maintenance-status`,
    );

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.latestRecords).toEqual([]);
  });

  it("rejects maintenance schedules for unknown platforms", async () => {
    const response = await request(app)
      .post("/platforms/7a2ed2c4-e238-4743-aa60-5bcd5a50d7b7/maintenance-schedules")
      .send({
        taskName: "Battery health check",
        intervalDays: 7,
      });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "platform_not_found",
      },
    });
  });
});
