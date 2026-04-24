import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";
import { AlertRepository } from "../alerts/alert.repository";
import { AlertService } from "../alerts/alert.service";

const alertRepository = new AlertRepository();

const alertService = new AlertService(pool, alertRepository, {
  altitudeHighM: 1000,
  speedHighMps: 50,
});

const insertMission = async (id: string, status: string = "active") => {
  await pool.query(
    `
    insert into missions (
      id,
      status,
      mission_plan_id,
      last_event_sequence_no
    )
    values ($1, $2, $3, $4)
    `,
    [id, status, "plan-1", 0],
  );
};

const listAlertsForMission = async (missionId: string) => {
  const client = await pool.connect();
  try {
    return await alertRepository.list(client, { missionId, limit: 100 });
  } finally {
    client.release();
  }
};

describe("AlertService", () => {
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

  it("creates an ALTITUDE_HIGH alert when altitude exceeds threshold", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const result = await alertService.evaluateTelemetry(missionId, {
      timestamp: "2026-04-15T10:00:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 1200,
      speedMps: 20,
    });

    expect(result.created).toHaveLength(1);
    expect(result.created[0].alertType).toBe("ALTITUDE_HIGH");
    expect(result.created[0].status).toBe("open");
    expect(result.resolvedCount).toBe(0);

    const alerts = await listAlertsForMission(missionId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe("ALTITUDE_HIGH");
  });

  it("creates a SPEED_HIGH alert when speed exceeds threshold", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const result = await alertService.evaluateTelemetry(missionId, {
      timestamp: "2026-04-15T10:00:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 100,
      speedMps: 60,
    });

    expect(result.created).toHaveLength(1);
    expect(result.created[0].alertType).toBe("SPEED_HIGH");
    expect(result.resolvedCount).toBe(0);

    const alerts = await listAlertsForMission(missionId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe("SPEED_HIGH");
  });

  it("creates both alerts when both conditions are exceeded", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const result = await alertService.evaluateTelemetry(missionId, {
      timestamp: "2026-04-15T10:00:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 1500,
      speedMps: 80,
    });

    expect(result.created).toHaveLength(2);
    expect(result.created.map((item: { alertType: string }) => item.alertType).sort()).toEqual([
      "ALTITUDE_HIGH",
      "SPEED_HIGH",
    ]);

    const alerts = await listAlertsForMission(missionId);
    expect(alerts).toHaveLength(2);
  });

  it("does not create duplicate open alerts for the same mission and type", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const first = await alertService.evaluateTelemetry(missionId, {
      timestamp: "2026-04-15T10:00:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 1200,
      speedMps: 20,
    });

    const second = await alertService.evaluateTelemetry(missionId, {
      timestamp: "2026-04-15T10:01:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 1300,
      speedMps: 20,
    });

    expect(first.created).toHaveLength(1);
    expect(second.created).toHaveLength(0);

    const alerts = await listAlertsForMission(missionId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe("ALTITUDE_HIGH");
    expect(alerts[0].status).toBe("open");
  });

  it("resolves an open ALTITUDE_HIGH alert when altitude returns to normal", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    await alertService.evaluateTelemetry(missionId, {
      timestamp: "2026-04-15T10:00:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 1200,
      speedMps: 20,
    });

    const result = await alertService.evaluateTelemetry(missionId, {
      timestamp: "2026-04-15T10:02:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 900,
      speedMps: 20,
    });

    expect(result.created).toHaveLength(0);
    expect(result.resolvedCount).toBe(1);

    const alerts = await listAlertsForMission(missionId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].status).toBe("resolved");
    expect(alerts[0].resolvedAt).toBe("2026-04-15T10:02:00.000Z");
  });

  it("resolves only the alert type whose condition clears", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    await alertService.evaluateTelemetry(missionId, {
      timestamp: "2026-04-15T10:00:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 1200,
      speedMps: 60,
    });

    const result = await alertService.evaluateTelemetry(missionId, {
      timestamp: "2026-04-15T10:05:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 900,
      speedMps: 60,
    });

    expect(result.created).toHaveLength(0);
    expect(result.resolvedCount).toBe(1);

    const alerts = await listAlertsForMission(missionId);
    const byType = Object.fromEntries(
      alerts.map((item: { alertType: string }) => [item.alertType, item]),
    ) as Record<string, (typeof alerts)[number]>;

    expect(byType["ALTITUDE_HIGH"].status).toBe("resolved");
    expect(byType["SPEED_HIGH"].status).toBe("open");
  });

  it("does nothing when no conditions are triggered and no open alerts exist", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const result = await alertService.evaluateTelemetry(missionId, {
      timestamp: "2026-04-15T10:00:00Z",
      lat: 51.5,
      lng: -0.1,
      altitudeM: 500,
      speedMps: 20,
    });

    expect(result.created).toHaveLength(0);
    expect(result.resolvedCount).toBe(0);

    const alerts = await listAlertsForMission(missionId);
    expect(alerts).toHaveLength(0);
  });

  it("creates a regulatory amendment alert with change impact details", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const result = await alertService.recordRegulatoryAmendmentImpact(
      missionId,
      {
        sourceDocument: "CAP 722",
        previousVersion: "9.2",
        currentVersion: "9.3",
        publishedAt: "2026-04-20T09:00:00Z",
        effectiveFrom: "2026-05-01T00:00:00Z",
        amendmentSummary: "Updated UAS operating guidance",
        changeImpact: "Review airspace planning and operating safety case evidence",
        affectedRequirementRefs: ["CAP722:2.1", "CAP722A:OSC"],
        reviewAction: "Compliance owner to assess affected controls before dispatch",
      },
    );

    expect(result.duplicate).toBe(false);
    expect(result.created).toHaveLength(1);
    expect(result.created[0]).toMatchObject({
      alertType: "REGULATORY_AMENDMENT",
      severity: "warning",
      source: "regulatory",
      triggeredAt: "2026-04-20T09:00:00.000Z",
    });
    expect(result.created[0].metadata).toMatchObject({
      sourceDocument: "CAP 722",
      previousVersion: "9.2",
      currentVersion: "9.3",
      changeImpact: "Review airspace planning and operating safety case evidence",
      reviewAction: "Compliance owner to assess affected controls before dispatch",
    });

    const alerts = await listAlertsForMission(missionId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toBe(
      "Regulatory amendment detected: CAP 722 9.2 -> 9.3",
    );
  });

  it("does not duplicate an open regulatory amendment alert for the same source version", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const amendment = {
      sourceDocument: "CAP 722",
      previousVersion: "9.2",
      currentVersion: "9.3",
      publishedAt: "2026-04-20T09:00:00Z",
      amendmentSummary: "Updated UAS operating guidance",
      changeImpact: "Review affected planning controls",
      reviewAction: "Compliance owner review required",
    };

    const first = await alertService.recordRegulatoryAmendmentImpact(
      missionId,
      amendment,
    );
    const second = await alertService.recordRegulatoryAmendmentImpact(
      missionId,
      amendment,
    );

    expect(first.created).toHaveLength(1);
    expect(second).toEqual({ created: [], duplicate: true });

    const alerts = await listAlertsForMission(missionId);
    expect(alerts).toHaveLength(1);
  });
});
