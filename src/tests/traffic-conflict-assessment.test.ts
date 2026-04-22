import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from mission_external_overlays");
  await pool.query("delete from mission_telemetry");
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

const recordTelemetry = async (missionId: string) => {
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
    values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb)
    `,
    [missionId, "2026-04-21T12:00:00.000Z", 51.5074, -0.1278, 120, 15, 90, 40],
  );
};

describe("traffic conflict assessment integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns no conflicts when a mission has telemetry but no traffic overlays", async () => {
    const missionId = await createMission();
    await recordTelemetry(missionId);

    const response = await request(app).get(
      `/missions/${missionId}/conflict-assessment`,
    );

    expect(response.status).toBe(200);
    expect(response.body.assessment).toMatchObject({
      missionId,
      reference: {
        replayPointCount: 1,
        telemetry: expect.objectContaining({
          timestamp: "2026-04-21T12:00:00.000Z",
        }),
      },
      conflicts: [],
    });
  });

  it("assesses crewed and drone traffic conflict candidates without mutating raw overlay records", async () => {
    const missionId = await createMission();
    await recordTelemetry(missionId);

    await request(app)
      .post(`/missions/${missionId}/external-overlays`)
      .send({
        kind: "weather",
        source: {
          provider: "met-office",
          sourceType: "surface_observation",
        },
        observedAt: "2026-04-21T12:00:00.000Z",
        geometry: {
          type: "point",
          lat: 51.5074,
          lng: -0.1278,
        },
        severity: "caution",
        metadata: {
          windSpeedKnots: 28,
          windDirectionDegrees: 235,
          temperatureC: 9,
          precipitation: "rain",
        },
      });

    await request(app)
      .post(`/missions/${missionId}/external-overlays`)
      .send({
        kind: "crewed_traffic",
        source: {
          provider: "traffic-hub",
          sourceType: "adsb_exchange",
        },
        observedAt: "2026-04-21T12:00:30.000Z",
        geometry: {
          type: "point",
          lat: 51.5125,
          lng: -0.1218,
          altitudeMslFt: 620,
        },
        headingDegrees: 110,
        speedKnots: 145,
        metadata: {
          trafficId: "crewed-22",
          callsign: "HELIMED21",
          trackSource: "adsb_exchange",
          aircraftCategory: "helicopter",
          verticalRateFpm: 150,
        },
      });

    await request(app)
      .post(`/missions/${missionId}/external-overlays`)
      .send({
        kind: "drone_traffic",
        source: {
          provider: "utm-hub",
          sourceType: "remote_id",
        },
        observedAt: "2026-04-21T12:00:15.000Z",
        geometry: {
          type: "point",
          lat: 51.5077,
          lng: -0.1275,
          altitudeMslFt: 410,
        },
        headingDegrees: 38,
        speedKnots: 24,
        metadata: {
          trafficId: "drone-44",
          trackSource: "remote_id",
          vehicleType: "multirotor",
          operatorReference: "op-44",
          verticalRateFpm: 80,
        },
      });

    const before = await pool.query<{
      mission_id: string;
      overlay_kind: string;
    }>("select mission_id, overlay_kind from mission_external_overlays order by id");

    const response = await request(app).get(
      `/missions/${missionId}/conflict-assessment`,
    );

    expect(response.status).toBe(200);
    expect(response.body.assessment.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          missionId,
          overlayKind: "crewed_traffic",
          overlayLabel: "HELIMED21",
          measurementBasis: {
            referencePoint: "latest_telemetry",
            targetGeometry: "overlay_point",
            rangeRule: "point_to_point",
            bearingReference: "true_north",
          },
          metrics: expect.objectContaining({
            rangeMeters: expect.any(Number),
            bearingDegrees: expect.any(Number),
          }),
        }),
        expect.objectContaining({
          missionId,
          overlayKind: "drone_traffic",
          overlayLabel: "op-44",
          measurementBasis: {
            referencePoint: "latest_telemetry",
            targetGeometry: "overlay_point",
            rangeRule: "point_to_point",
            bearingReference: "true_north",
          },
          metrics: expect.objectContaining({
            rangeMeters: expect.any(Number),
            bearingDegrees: expect.any(Number),
          }),
        }),
      ]),
    );
    expect(
      response.body.assessment.conflicts.every(
        (item: { status: string }) =>
          item.status === "monitor" || item.status === "conflict_candidate",
      ),
    ).toBe(true);

    const after = await pool.query<{
      mission_id: string;
      overlay_kind: string;
    }>("select mission_id, overlay_kind from mission_external_overlays order by id");

    expect(after.rows).toEqual(before.rows);
  });

  it("assesses area conflict geometry using nearest-boundary range and bearing metadata", async () => {
    const missionId = await createMission();
    await recordTelemetry(missionId);

    await request(app)
      .post(`/missions/${missionId}/external-overlays`)
      .send({
        kind: "area_conflict",
        source: {
          provider: "airspace-hub",
          sourceType: "zone_service",
        },
        observedAt: "2026-04-21T12:00:10.000Z",
        geometry: {
          type: "circle",
          centerLat: 51.5075,
          centerLng: -0.1277,
          radiusMeters: 150,
          altitudeFloorFt: 0,
          altitudeCeilingFt: 1000,
        },
        severity: "critical",
        metadata: {
          areaId: "zone-1",
          label: "Restricted tower zone",
          areaType: "restricted_zone",
          description: "Temporary restriction",
        },
      });

    await request(app)
      .post(`/missions/${missionId}/external-overlays`)
      .send({
        kind: "area_conflict",
        source: {
          provider: "airspace-hub",
          sourceType: "zone_service",
        },
        observedAt: "2026-04-21T12:00:20.000Z",
        geometry: {
          type: "polygon",
          points: [
            { lat: 51.5071, lng: -0.1281 },
            { lat: 51.5071, lng: -0.1269 },
            { lat: 51.5079, lng: -0.1269 },
            { lat: 51.5079, lng: -0.1281 },
          ],
          altitudeFloorFt: 0,
          altitudeCeilingFt: 900,
        },
        severity: "caution",
        metadata: {
          areaId: "zone-2",
          label: "Event exclusion polygon",
          areaType: "event_restriction",
          description: null,
        },
      });

    const response = await request(app).get(
      `/missions/${missionId}/conflict-assessment`,
    );

    expect(response.status).toBe(200);
    expect(response.body.assessment.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          missionId,
          overlayKind: "area_conflict",
          overlayLabel: "Restricted tower zone",
          measurementBasis: {
            referencePoint: "latest_telemetry",
            targetGeometry: "overlay_circle",
            rangeRule: "nearest_boundary",
            bearingReference: "true_north",
          },
          metrics: expect.objectContaining({
            rangeMeters: expect.any(Number),
            bearingDegrees: expect.any(Number),
            insideArea: expect.any(Boolean),
          }),
        }),
        expect.objectContaining({
          missionId,
          overlayKind: "area_conflict",
          overlayLabel: "Event exclusion polygon",
          measurementBasis: {
            referencePoint: "latest_telemetry",
            targetGeometry: "overlay_polygon",
            rangeRule: "nearest_boundary",
            bearingReference: "true_north",
          },
          metrics: expect.objectContaining({
            rangeMeters: expect.any(Number),
            insideArea: expect.any(Boolean),
          }),
        }),
      ]),
    );
  });

  it("preserves mission isolation for conflict assessment reads", async () => {
    const firstMissionId = await createMission();
    const secondMissionId = await createMission();
    await recordTelemetry(firstMissionId);
    await recordTelemetry(secondMissionId);

    await request(app)
      .post(`/missions/${secondMissionId}/external-overlays`)
      .send({
        kind: "drone_traffic",
        source: {
          provider: "utm-hub",
          sourceType: "remote_id",
        },
        observedAt: "2026-04-21T12:00:15.000Z",
        geometry: {
          type: "point",
          lat: 51.5077,
          lng: -0.1275,
          altitudeMslFt: 410,
        },
        headingDegrees: 38,
        speedKnots: 24,
        metadata: {
          trafficId: "drone-44",
          trackSource: "remote_id",
          vehicleType: "multirotor",
          operatorReference: "op-44",
          verticalRateFpm: 80,
        },
      });

    const response = await request(app).get(
      `/missions/${firstMissionId}/conflict-assessment`,
    );

    expect(response.status).toBe(200);
    expect(response.body.assessment.conflicts).toEqual([]);
  });

  it("returns 404 for missing missions on conflict assessment reads", async () => {
    const response = await request(app).get(
      `/missions/${randomUUID()}/conflict-assessment`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
  });
});
