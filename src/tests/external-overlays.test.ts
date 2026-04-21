import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from mission_external_overlays");
  await pool.query("delete from mission_planning_approval_handoffs");
  await pool.query("delete from mission_decision_evidence_links");
  await pool.query("delete from audit_evidence_snapshots");
  await pool.query("delete from airspace_compliance_inputs");
  await pool.query("delete from mission_risk_inputs");
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
};

const createMission = async () => {
  const response = await request(app).post("/mission-plans/drafts").send({});
  expect(response.status).toBe(201);
  return response.body.draft.missionId as string;
};

describe("mission external overlays integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates and lists weather overlays through the mission-linked external overlay boundary", async () => {
    const missionId = await createMission();

    const createResponse = await request(app)
      .post(`/missions/${missionId}/external-overlays`)
      .send({
        kind: "weather",
        source: {
          provider: "met-office",
          sourceType: "surface_observation",
          sourceRecordId: "obs-1001",
        },
        observedAt: "2026-04-21T10:00:00.000Z",
        validFrom: "2026-04-21T10:00:00.000Z",
        validTo: "2026-04-21T10:30:00.000Z",
        geometry: {
          type: "point",
          lat: 51.5074,
          lng: -0.1278,
          altitudeMslFt: 220,
        },
        severity: "caution",
        confidence: 0.92,
        freshnessSeconds: 300,
        metadata: {
          windSpeedKnots: 18,
          windDirectionDegrees: 240,
          temperatureC: 11,
          precipitation: "rain",
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.overlay).toMatchObject({
      missionId,
      kind: "weather",
      source: {
        provider: "met-office",
        sourceType: "surface_observation",
        sourceRecordId: "obs-1001",
      },
      geometry: {
        type: "point",
        lat: 51.5074,
        lng: -0.1278,
        altitudeMslFt: 220,
      },
      severity: "caution",
      freshnessSeconds: 300,
      metadata: {
        windSpeedKnots: 18,
        windDirectionDegrees: 240,
        temperatureC: 11,
        precipitation: "rain",
      },
    });

    const listResponse = await request(app).get(
      `/missions/${missionId}/external-overlays?kind=weather`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toMatchObject({
      missionId,
      overlays: [
        expect.objectContaining({
          kind: "weather",
          severity: "caution",
          metadata: expect.objectContaining({
            windSpeedKnots: 18,
            windDirectionDegrees: 240,
            temperatureC: 11,
            precipitation: "rain",
          }),
        }),
      ],
    });
  });

  it("preserves mission isolation for external overlays", async () => {
    const firstMissionId = await createMission();
    const secondMissionId = await createMission();

    const createResponse = await request(app)
      .post(`/missions/${secondMissionId}/external-overlays`)
      .send({
        kind: "weather",
        source: {
          provider: "met-office",
          sourceType: "surface_observation",
        },
        observedAt: "2026-04-21T10:00:00.000Z",
        geometry: {
          type: "point",
          lat: 51.5074,
          lng: -0.1278,
        },
        metadata: {
          windSpeedKnots: 15,
          windDirectionDegrees: 180,
          temperatureC: 12,
          precipitation: "none",
        },
      });

    expect(createResponse.status).toBe(201);

    const listResponse = await request(app).get(
      `/missions/${firstMissionId}/external-overlays?kind=weather`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.overlays).toEqual([]);
  });

  it("returns 404 for missing missions on external overlay reads", async () => {
    const response = await request(app).get(
      `/missions/${randomUUID()}/external-overlays?kind=weather`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
  });
});
