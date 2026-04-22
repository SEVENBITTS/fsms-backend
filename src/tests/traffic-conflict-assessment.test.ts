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
          temporalContext: {
            referenceTimestamp: "2026-04-21T12:00:00.000Z",
            validFrom: null,
            validTo: null,
            relation: "not_applicable",
          },
          verticalContext: {
            referenceAltitudeFt: expect.any(Number),
            altitudeFloorFt: 0,
            altitudeCeilingFt: 1000,
            relation: "inside_band",
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
          temporalContext: {
            referenceTimestamp: "2026-04-21T12:00:00.000Z",
            validFrom: null,
            validTo: null,
            relation: "not_applicable",
          },
          verticalContext: {
            referenceAltitudeFt: expect.any(Number),
            altitudeFloorFt: 0,
            altitudeCeilingFt: 900,
            relation: "inside_band",
          },
          metrics: expect.objectContaining({
            rangeMeters: expect.any(Number),
            insideArea: expect.any(Boolean),
          }),
        }),
      ]),
    );
  });

  it("suppresses area conflicts when mission altitude is outside the restriction band", async () => {
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
          altitudeCeilingFt: 300,
        },
        severity: "critical",
        metadata: {
          areaId: "zone-high",
          label: "Low ceiling restriction",
          areaType: "restricted_zone",
          description: "Should not apply above the ceiling",
        },
      });

    const response = await request(app).get(
      `/missions/${missionId}/conflict-assessment`,
    );

    expect(response.status).toBe(200);
    expect(
      response.body.assessment.conflicts.some(
        (item: { overlayLabel: string }) =>
          item.overlayLabel === "Low ceiling restriction",
      ),
    ).toBe(false);
  });

  it("suppresses area conflicts when mission reference time is outside the active window", async () => {
    const missionId = await createMission();
    await recordTelemetry(missionId);

    await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B9999/26",
            },
            observedAt: "2026-04-21T12:00:10.000Z",
            validFrom: "2026-04-21T13:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5075,
              centerLng: -0.1277,
              radiusMeters: 150,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            area: {
              areaId: "NOTAM-LATE",
              label: "Future NOTAM Zone",
              areaType: "notam_restriction",
              description: "Should not apply before validFrom",
              authorityName: "NATS",
              notamNumber: "B9999/26",
              sourceReference: "NOTAM B9999/26",
            },
          },
        ],
      });

    const response = await request(app).get(
      `/missions/${missionId}/conflict-assessment`,
    );

    expect(response.status).toBe(200);
    expect(
      response.body.assessment.conflicts.some(
        (item: { overlayLabel: string }) => item.overlayLabel === "Future NOTAM Zone",
      ),
    ).toBe(false);
  });

  it("consumes normalized authoritative area overlays without source-specific conflict branching", async () => {
    const missionId = await createMission();
    await recordTelemetry(missionId);

    const normalizeResponse = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-33",
            },
            observedAt: "2026-04-21T12:00:10.000Z",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5075,
              centerLng: -0.1277,
              radiusMeters: 150,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            area: {
              areaId: "TDA-33",
              label: "Temporary Danger Area 33",
              areaType: "temporary_danger_area",
              description: "Temporary activity area",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1234/26",
            },
            observedAt: "2026-04-21T12:00:20.000Z",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T15:00:00.000Z",
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
            area: {
              areaId: "NOTAM-B1234-26",
              label: "NOTAM Restricted Zone",
              areaType: "notam_restriction",
              description: "Event restriction",
              authorityName: "NATS",
              notamNumber: "B1234/26",
              sourceReference: "NOTAM B1234/26",
            },
          },
        ],
      });

    expect(normalizeResponse.status).toBe(201);

    const response = await request(app).get(
      `/missions/${missionId}/conflict-assessment`,
    );

    expect(response.status).toBe(200);
    expect(response.body.assessment.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          overlayKind: "area_conflict",
          overlayLabel: "Temporary Danger Area 33",
          relatedSource: expect.objectContaining({
            provider: "uk-ais",
            sourceType: "temporary_danger_area",
          }),
          measurementBasis: expect.objectContaining({
            rangeRule: "nearest_boundary",
          }),
          temporalContext: expect.objectContaining({
            relation: "inside_window",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
          }),
          verticalContext: expect.objectContaining({
            relation: "inside_band",
          }),
        }),
        expect.objectContaining({
          overlayKind: "area_conflict",
          overlayLabel: "NOTAM Restricted Zone",
          relatedSource: expect.objectContaining({
            provider: "uk-ais",
            sourceType: "notam_restriction",
          }),
          measurementBasis: expect.objectContaining({
            rangeRule: "nearest_boundary",
          }),
          temporalContext: expect.objectContaining({
            relation: "inside_window",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T15:00:00.000Z",
          }),
          verticalContext: expect.objectContaining({
            relation: "inside_band",
          }),
        }),
      ]),
    );
  });

  it("does not create redundant interpreted conflicts for deduplicated overlapping area sources", async () => {
    const missionId = await createMission();
    await recordTelemetry(missionId);

    const normalizeResponse = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-900",
            },
            observedAt: "2026-04-21T12:00:10.000Z",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5075,
              centerLng: -0.1277,
              radiusMeters: 150,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            area: {
              areaId: "EGD-900",
              label: "Danger Area EGD-900",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B9000/26",
            },
            observedAt: "2026-04-21T12:00:20.000Z",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5075,
              centerLng: -0.1277,
              radiusMeters: 150,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B9000-26",
              label: "Danger Area EGD-900 Active NOTAM",
              areaType: "notam_restriction",
              description: "Higher-priority duplicate",
              authorityName: "NATS",
              notamNumber: "B9000/26",
              sourceReference: "NOTAM B9000/26",
            },
          },
        ],
      });

    expect(normalizeResponse.status).toBe(201);
    expect(normalizeResponse.body.overlays).toHaveLength(1);

    const response = await request(app).get(
      `/missions/${missionId}/conflict-assessment`,
    );

    expect(response.status).toBe(200);
    const areaConflicts = response.body.assessment.conflicts.filter(
      (item: { overlayKind: string }) => item.overlayKind === "area_conflict",
    );
    expect(areaConflicts).toHaveLength(1);
    expect(areaConflicts[0]).toMatchObject({
      overlayLabel: "Danger Area EGD-900 Active NOTAM",
      relatedSource: {
        sourceType: "notam_restriction",
      },
    });
  });

  it("uses the superseded higher-priority overlay on later normalization runs without creating parallel area conflicts", async () => {
    const missionId = await createMission();
    await recordTelemetry(missionId);

    await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-901",
            },
            observedAt: "2026-04-21T12:00:10.000Z",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5075,
              centerLng: -0.1277,
              radiusMeters: 150,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            area: {
              areaId: "EGD-901",
              label: "Danger Area EGD-901",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
        ],
      });

    await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B9010/26",
            },
            observedAt: "2026-04-21T12:00:20.000Z",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5075,
              centerLng: -0.1277,
              radiusMeters: 150,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B9010-26",
              label: "Danger Area EGD-901 Active NOTAM",
              areaType: "notam_restriction",
              description: "Superseding NOTAM",
              authorityName: "NATS",
              notamNumber: "B9010/26",
              sourceReference: "NOTAM B9010/26",
            },
          },
        ],
      });

    const response = await request(app).get(
      `/missions/${missionId}/conflict-assessment`,
    );

    expect(response.status).toBe(200);
    const areaConflicts = response.body.assessment.conflicts.filter(
      (item: { overlayKind: string }) => item.overlayKind === "area_conflict",
    );
    expect(areaConflicts).toHaveLength(1);
    expect(areaConflicts[0]).toMatchObject({
      overlayLabel: "Danger Area EGD-901 Active NOTAM",
      relatedSource: {
        sourceType: "notam_restriction",
      },
    });
  });

  it("does not assess retired normalized area overlays after a later authoritative refresh omits them", async () => {
    const missionId = await createMission();
    await recordTelemetry(missionId);

    await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-902",
            },
            observedAt: "2026-04-21T12:00:10.000Z",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5075,
              centerLng: -0.1277,
              radiusMeters: 150,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            area: {
              areaId: "EGD-902",
              label: "Danger Area EGD-902",
              areaType: "danger_area",
              description: "Should retire on later refresh",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-902",
            },
            observedAt: "2026-04-21T12:00:20.000Z",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5095,
              centerLng: -0.1267,
              radiusMeters: 150,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            area: {
              areaId: "TDA-902",
              label: "Temporary Danger Area 902",
              areaType: "temporary_danger_area",
              description: "Remains active",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-902",
            },
            observedAt: "2026-04-21T12:00:20.000Z",
            validFrom: "2026-04-21T12:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5095,
              centerLng: -0.1267,
              radiusMeters: 150,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            area: {
              areaId: "TDA-902",
              label: "Temporary Danger Area 902",
              areaType: "temporary_danger_area",
              description: "Remains active",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    const response = await request(app).get(
      `/missions/${missionId}/conflict-assessment`,
    );

    expect(response.status).toBe(200);
    const areaConflicts = response.body.assessment.conflicts.filter(
      (item: { overlayKind: string }) => item.overlayKind === "area_conflict",
    );
    expect(areaConflicts).toHaveLength(1);
    expect(areaConflicts[0]).toMatchObject({
      overlayLabel: "Temporary Danger Area 902",
      relatedSource: {
        sourceType: "temporary_danger_area",
      },
    });
    expect(
      areaConflicts.some(
        (item: { overlayLabel: string }) => item.overlayLabel === "Danger Area EGD-902",
      ),
    ).toBe(false);
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
