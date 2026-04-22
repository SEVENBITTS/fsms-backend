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
      `/missions/${missionId}/external-overlays`,
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
      `/missions/${firstMissionId}/external-overlays`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.overlays).toEqual([]);
  });

  it("creates and lists crewed traffic overlays through the mission-linked external overlay boundary", async () => {
    const missionId = await createMission();

    const createResponse = await request(app)
      .post(`/missions/${missionId}/external-overlays`)
      .send({
        kind: "crewed_traffic",
        source: {
          provider: "traffic-hub",
          sourceType: "adsb_exchange",
          sourceRecordId: "track-2002",
        },
        observedAt: "2026-04-21T10:04:00.000Z",
        geometry: {
          type: "point",
          lat: 51.5091,
          lng: -0.1215,
          altitudeMslFt: 1800,
        },
        headingDegrees: 122,
        speedKnots: 135,
        severity: "info",
        freshnessSeconds: 45,
        metadata: {
          trafficId: "traffic-2002",
          callsign: "HELIMED21",
          trackSource: "adsb_exchange",
          aircraftCategory: "helicopter",
          verticalRateFpm: 200,
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.overlay).toMatchObject({
      missionId,
      kind: "crewed_traffic",
      source: {
        provider: "traffic-hub",
        sourceType: "adsb_exchange",
        sourceRecordId: "track-2002",
      },
      geometry: {
        type: "point",
        lat: 51.5091,
        lng: -0.1215,
        altitudeMslFt: 1800,
      },
      headingDegrees: 122,
      speedKnots: 135,
      metadata: {
        trafficId: "traffic-2002",
        callsign: "HELIMED21",
        trackSource: "adsb_exchange",
        aircraftCategory: "helicopter",
        verticalRateFpm: 200,
      },
    });

    const listResponse = await request(app).get(
      `/missions/${missionId}/external-overlays`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toMatchObject({
      missionId,
      overlays: [
        expect.objectContaining({
          kind: "crewed_traffic",
          headingDegrees: 122,
          speedKnots: 135,
          metadata: expect.objectContaining({
            trafficId: "traffic-2002",
            callsign: "HELIMED21",
            aircraftCategory: "helicopter",
          }),
        }),
      ],
    });
  });

  it("keeps weather and crewed traffic overlay paths intact when listed together", async () => {
    const missionId = await createMission();

    await request(app)
      .post(`/missions/${missionId}/external-overlays`)
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
          windSpeedKnots: 12,
          windDirectionDegrees: 205,
          temperatureC: 10,
          precipitation: "none",
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
        observedAt: "2026-04-21T10:03:00.000Z",
        geometry: {
          type: "point",
          lat: 51.508,
          lng: -0.12,
          altitudeMslFt: 2400,
        },
        headingDegrees: 80,
        speedKnots: 148,
        metadata: {
          trafficId: "traffic-3003",
          callsign: "N123AB",
          trackSource: "adsb_exchange",
          aircraftCategory: "fixed_wing",
          verticalRateFpm: null,
        },
      });

    const listAllResponse = await request(app).get(
      `/missions/${missionId}/external-overlays`,
    );

    expect(listAllResponse.status).toBe(200);
    expect(listAllResponse.body.overlays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "weather" }),
        expect.objectContaining({ kind: "crewed_traffic" }),
      ]),
    );
  });

  it("creates and lists drone traffic overlays through the mission-linked external overlay boundary", async () => {
    const missionId = await createMission();

    const createResponse = await request(app)
      .post(`/missions/${missionId}/external-overlays`)
      .send({
        kind: "drone_traffic",
        source: {
          provider: "utm-hub",
          sourceType: "remote_id",
          sourceRecordId: "drone-4004",
        },
        observedAt: "2026-04-21T10:06:00.000Z",
        geometry: {
          type: "point",
          lat: 51.5062,
          lng: -0.1193,
          altitudeMslFt: 420,
        },
        headingDegrees: 44,
        speedKnots: 28,
        severity: "info",
        freshnessSeconds: 20,
        metadata: {
          trafficId: "drone-4004",
          trackSource: "remote_id",
          vehicleType: "multirotor",
          operatorReference: "op-ref-77",
          verticalRateFpm: 120,
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.overlay).toMatchObject({
      missionId,
      kind: "drone_traffic",
      geometry: {
        type: "point",
        lat: 51.5062,
        lng: -0.1193,
        altitudeMslFt: 420,
      },
      headingDegrees: 44,
      speedKnots: 28,
      metadata: {
        trafficId: "drone-4004",
        trackSource: "remote_id",
        vehicleType: "multirotor",
        operatorReference: "op-ref-77",
        verticalRateFpm: 120,
      },
    });

    const listResponse = await request(app).get(
      `/missions/${missionId}/external-overlays?kind=drone_traffic`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toMatchObject({
      missionId,
      overlays: [
        expect.objectContaining({
          kind: "drone_traffic",
          headingDegrees: 44,
          speedKnots: 28,
          metadata: expect.objectContaining({
            trafficId: "drone-4004",
            operatorReference: "op-ref-77",
            vehicleType: "multirotor",
          }),
        }),
      ],
    });
  });

  it("creates and lists area conflict overlays through the mission-linked external overlay boundary", async () => {
    const missionId = await createMission();

    const createResponse = await request(app)
      .post(`/missions/${missionId}/external-overlays`)
      .send({
        kind: "area_conflict",
        source: {
          provider: "airspace-hub",
          sourceType: "zone_service",
          sourceRecordId: "zone-6006",
        },
        observedAt: "2026-04-21T10:07:00.000Z",
        geometry: {
          type: "circle",
          centerLat: 51.5078,
          centerLng: -0.1269,
          radiusMeters: 350,
          altitudeFloorFt: 100,
          altitudeCeilingFt: 900,
        },
        severity: "caution",
        metadata: {
          areaId: "zone-6006",
          label: "Tower protection zone",
          areaType: "restricted_zone",
          description: "Temporary restricted area around event site",
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.overlay).toMatchObject({
      missionId,
      kind: "area_conflict",
      geometry: {
        type: "circle",
        centerLat: 51.5078,
        centerLng: -0.1269,
        radiusMeters: 350,
        altitudeFloorFt: 100,
        altitudeCeilingFt: 900,
      },
      metadata: {
        areaId: "zone-6006",
        label: "Tower protection zone",
        areaType: "restricted_zone",
        description: "Temporary restricted area around event site",
      },
    });

    const listResponse = await request(app).get(
      `/missions/${missionId}/external-overlays?kind=area_conflict`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toMatchObject({
      missionId,
      overlays: [
        expect.objectContaining({
          kind: "area_conflict",
          geometry: expect.objectContaining({
            type: "circle",
            radiusMeters: 350,
          }),
          metadata: expect.objectContaining({
            areaId: "zone-6006",
            label: "Tower protection zone",
          }),
        }),
      ],
    });
  });

  it("normalizes authoritative danger area and NOTAM records into area conflict overlays", async () => {
    const missionId = await createMission();

    const normalizeResponse = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-101",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-101",
              label: "Danger Area EGD-101",
              areaType: "danger_area",
              description: "Permanent danger area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1234/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:15:00.000Z",
            validTo: "2026-04-21T16:00:00.000Z",
            geometry: {
              type: "polygon",
              points: [
                { lat: 51.5072, lng: -0.1285 },
                { lat: 51.5089, lng: -0.1285 },
                { lat: 51.5089, lng: -0.126 },
                { lat: 51.5072, lng: -0.126 },
              ],
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1200,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1234-26",
              label: "Stadium TFR",
              areaType: "notam_restriction",
              description: "Event restriction from NOTAM",
              authorityName: "NATS",
              notamNumber: "B1234/26",
              sourceReference: "NOTAM B1234/26",
            },
          },
        ],
      });

    expect(normalizeResponse.status).toBe(201);
    expect(normalizeResponse.body.refreshRunId).toEqual(expect.any(String));
    expect(normalizeResponse.body).toMatchObject({
      missionId,
      overlays: [
        expect.objectContaining({
          kind: "area_conflict",
          source: expect.objectContaining({
            provider: "uk-ais",
            sourceType: "danger_area",
            sourceRecordId: "EGD-101",
          }),
          metadata: expect.objectContaining({
            areaId: "EGD-101",
            areaType: "danger_area",
            authorityName: "CAA",
            sourceReference: "ENR 5.1",
            refreshProvenance: expect.objectContaining({
              createdByRunId: normalizeResponse.body.refreshRunId,
              lastUpdatedByRunId: normalizeResponse.body.refreshRunId,
              supersededByRunId: null,
              retiredByRunId: null,
            }),
          }),
        }),
        expect.objectContaining({
          kind: "area_conflict",
          source: expect.objectContaining({
            provider: "uk-ais",
            sourceType: "notam_restriction",
            sourceRecordId: "B1234/26",
          }),
          metadata: expect.objectContaining({
            areaId: "NOTAM-B1234-26",
            areaType: "notam_restriction",
            notamNumber: "B1234/26",
            sourceReference: "NOTAM B1234/26",
            refreshProvenance: expect.objectContaining({
              createdByRunId: normalizeResponse.body.refreshRunId,
              lastUpdatedByRunId: normalizeResponse.body.refreshRunId,
              supersededByRunId: null,
              retiredByRunId: null,
            }),
          }),
        }),
      ],
    });

    const listResponse = await request(app).get(
      `/missions/${missionId}/external-overlays?kind=area_conflict`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.overlays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ sourceType: "danger_area" }),
        }),
        expect.objectContaining({
          source: expect.objectContaining({ sourceType: "notam_restriction" }),
        }),
      ]),
    );
  });

  it("deduplicates overlapping authoritative area sources and preserves source traceability", async () => {
    const missionId = await createMission();

    const normalizeResponse = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-400",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-400",
              label: "Danger Area EGD-400",
              areaType: "danger_area",
              description: "Permanent danger area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B4000/26",
            },
            observedAt: "2026-04-21T10:08:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B4000-26",
              label: "Danger Area EGD-400 Active NOTAM",
              areaType: "notam_restriction",
              description: "NOTAM overlay for the same area",
              authorityName: "NATS",
              notamNumber: "B4000/26",
              sourceReference: "NOTAM B4000/26",
            },
          },
        ],
      });

    expect(normalizeResponse.status).toBe(201);
    expect(normalizeResponse.body.overlays).toHaveLength(1);
    expect(normalizeResponse.body.overlays[0]).toMatchObject({
      kind: "area_conflict",
      source: {
        provider: "uk-ais",
        sourceType: "notam_restriction",
        sourceRecordId: "B4000/26",
      },
      severity: "critical",
      metadata: expect.objectContaining({
        areaType: "notam_restriction",
        normalizedSourcePriority: 3,
        dedupeKey: expect.any(String),
        sourceTrace: [
          expect.objectContaining({
            sourceType: "danger_area",
            sourceRecordId: "EGD-400",
          }),
          expect.objectContaining({
            sourceType: "notam_restriction",
            sourceRecordId: "B4000/26",
          }),
        ],
      }),
    });

    const listResponse = await request(app).get(
      `/missions/${missionId}/external-overlays?kind=area_conflict`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.overlays).toHaveLength(1);
  });

  it("supersedes an existing lower-priority normalized area overlay on a later normalization run", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-700",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-700",
              label: "Danger Area EGD-700",
              areaType: "danger_area",
              description: "Base danger area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    expect(firstRun.body.overlays).toHaveLength(1);
    const originalOverlayId = firstRun.body.overlays[0].id;
    const firstRunId = firstRun.body.refreshRunId as string;

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B7000/26",
            },
            observedAt: "2026-04-21T10:08:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B7000-26",
              label: "Danger Area EGD-700 Active NOTAM",
              areaType: "notam_restriction",
              description: "Higher-priority update",
              authorityName: "NATS",
              notamNumber: "B7000/26",
              sourceReference: "NOTAM B7000/26",
            },
          },
        ],
      });

    expect(secondRun.status).toBe(201);
    expect(secondRun.body.overlays).toHaveLength(1);
    expect(secondRun.body.refreshRunId).toEqual(expect.any(String));
    expect(secondRun.body.overlays[0]).toMatchObject({
      id: originalOverlayId,
      source: {
        sourceType: "notam_restriction",
        sourceRecordId: "B7000/26",
      },
      severity: "critical",
      metadata: expect.objectContaining({
        supersession: {
          supersededExisting: true,
          replacedSourceType: "danger_area",
          replacedSourceRecordId: "EGD-700",
        },
        sourceTrace: [
          expect.objectContaining({
            sourceType: "danger_area",
            sourceRecordId: "EGD-700",
          }),
          expect.objectContaining({
            sourceType: "notam_restriction",
            sourceRecordId: "B7000/26",
          }),
        ],
        refreshProvenance: {
          createdByRunId: firstRunId,
          lastUpdatedByRunId: secondRun.body.refreshRunId,
          supersededByRunId: secondRun.body.refreshRunId,
          retiredByRunId: null,
        },
      }),
    });

    const listResponse = await request(app).get(
      `/missions/${missionId}/external-overlays?kind=area_conflict`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.overlays).toHaveLength(1);
    expect(listResponse.body.overlays[0].id).toBe(originalOverlayId);
  });

  it("re-sees equivalent normalized area overlays across runs without creating duplicates", async () => {
    const missionId = await createMission();

    const requestBody = {
      records: [
        {
          source: {
            provider: "uk-ais",
            sourceType: "temporary_danger_area",
            sourceRecordId: "TDA-808",
          },
          observedAt: "2026-04-21T10:07:00.000Z",
          validFrom: "2026-04-21T10:00:00.000Z",
          validTo: "2026-04-21T14:00:00.000Z",
          geometry: {
            type: "circle",
            centerLat: 51.5078,
            centerLng: -0.1269,
            radiusMeters: 350,
            altitudeFloorFt: 0,
            altitudeCeilingFt: 900,
          },
          severity: "caution",
          area: {
            areaId: "TDA-808",
            label: "Temporary Danger Area 808",
            areaType: "temporary_danger_area",
            description: "Repeated authoritative input",
            authorityName: "CAA",
            sourceReference: "Temporary activation notice",
          },
        },
      ],
    };

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send(requestBody);
    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send(requestBody);

    expect(firstRun.status).toBe(201);
    expect(secondRun.status).toBe(201);
    expect(secondRun.body.overlays).toHaveLength(1);

    const listResponse = await request(app).get(
      `/missions/${missionId}/external-overlays?kind=area_conflict`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.overlays).toHaveLength(1);
    expect(listResponse.body.overlays[0].metadata.sourceTrace).toHaveLength(1);
  });

  it("retires previously-normalized area overlays when later authoritative refreshes omit them", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-990",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-990",
              label: "Danger Area EGD-990",
              areaType: "danger_area",
              description: "First refresh only",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-991",
            },
            observedAt: "2026-04-21T10:08:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5091,
              centerLng: -0.1261,
              radiusMeters: 280,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1200,
            },
            severity: "critical",
            area: {
              areaId: "TDA-991",
              label: "Temporary Danger Area 991",
              areaType: "temporary_danger_area",
              description: "Survives later refresh",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    expect(firstRun.body.overlays).toHaveLength(2);
    const firstRunId = firstRun.body.refreshRunId as string;

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-991",
            },
            observedAt: "2026-04-21T10:08:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5091,
              centerLng: -0.1261,
              radiusMeters: 280,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1200,
            },
            severity: "critical",
            area: {
              areaId: "TDA-991",
              label: "Temporary Danger Area 991",
              areaType: "temporary_danger_area",
              description: "Survives later refresh",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(secondRun.status).toBe(201);
    expect(secondRun.body.overlays).toHaveLength(1);
    expect(secondRun.body.refreshRunId).toEqual(expect.any(String));

    const listResponse = await request(app).get(
      `/missions/${missionId}/external-overlays?kind=area_conflict`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.overlays).toHaveLength(1);
    expect(listResponse.body.overlays[0].metadata.areaId).toBe("TDA-991");

    const retiredOverlay = await pool.query<{
      metadata: {
        areaId: string;
        retirement: {
          retired: boolean;
          retiredAt: string | null;
          reason: string | null;
        } | null;
      };
    }>(
      `
      select metadata
      from mission_external_overlays
      where mission_id = $1
        and metadata->>'areaId' = 'EGD-990'
      `,
      [missionId],
    );

    expect(retiredOverlay.rowCount).toBe(1);
    expect(retiredOverlay.rows[0].metadata.retirement).toMatchObject({
      retired: true,
      retiredAt: expect.any(String),
      reason: "missing_from_refresh",
    });
    expect(retiredOverlay.rows[0].metadata.refreshProvenance).toMatchObject({
      createdByRunId: firstRunId,
      lastUpdatedByRunId: secondRun.body.refreshRunId,
      retiredByRunId: secondRun.body.refreshRunId,
    });
  });

  it("returns refresh-run summaries and supports filtering a single authoritative snapshot", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-1200",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-1200",
              label: "Danger Area EGD-1200",
              areaType: "danger_area",
              description: "First snapshot",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    const firstRunId = firstRun.body.refreshRunId as string;

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1200/26",
            },
            observedAt: "2026-04-21T10:08:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1200-26",
              label: "Danger Area EGD-1200 NOTAM",
              areaType: "notam_restriction",
              description: "Higher priority snapshot",
              authorityName: "NATS",
              notamNumber: "B1200/26",
              sourceReference: "NOTAM B1200/26",
            },
          },
        ],
      });

    expect(secondRun.status).toBe(201);
    const secondRunId = secondRun.body.refreshRunId as string;

    const summaryResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs`,
    );

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.missionId).toBe(missionId);
    expect(summaryResponse.body.refreshRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          refreshRunId: firstRunId,
          missionId,
          created: [
            expect.objectContaining({
              areaId: "NOTAM-B1200-26",
              sourceType: "notam_restriction",
              retired: false,
            }),
          ],
          updated: [],
          superseded: [],
          retired: [],
          active: [],
        }),
        expect.objectContaining({
          refreshRunId: secondRunId,
          missionId,
          created: [],
          updated: [
            expect.objectContaining({
              areaId: "NOTAM-B1200-26",
              sourceType: "notam_restriction",
              retired: false,
            }),
          ],
          superseded: [
            expect.objectContaining({
              areaId: "NOTAM-B1200-26",
              sourceType: "notam_restriction",
              retired: false,
            }),
          ],
          retired: [],
          active: [
            expect.objectContaining({
              areaId: "NOTAM-B1200-26",
              sourceType: "notam_restriction",
              retired: false,
            }),
          ],
        }),
      ]),
    );

    const filteredSummaryResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?refreshRunId=${firstRunId}`,
    );

    expect(filteredSummaryResponse.status).toBe(200);
    expect(filteredSummaryResponse.body).toMatchObject({
      missionId,
      refreshRuns: [
        expect.objectContaining({
          refreshRunId: firstRunId,
        }),
      ],
    });
    expect(filteredSummaryResponse.body.refreshRuns).toHaveLength(1);

    const missingRunResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?refreshRunId=${randomUUID()}`,
    );

    expect(missingRunResponse.status).toBe(404);
    expect(missingRunResponse.body).toMatchObject({
      error: {
        type: "refresh_run_not_found",
      },
    });
  });

  it("returns refresh-run diffs between two authoritative snapshots", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-1300",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-1300",
              label: "Danger Area EGD-1300",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1301",
            },
            observedAt: "2026-04-21T10:08:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5091,
              centerLng: -0.1261,
              radiusMeters: 280,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1200,
            },
            severity: "critical",
            area: {
              areaId: "TDA-1301",
              label: "Temporary Danger Area 1301",
              areaType: "temporary_danger_area",
              description: "Will be retired later",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1300/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1300-26",
              label: "Danger Area EGD-1300 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1300/26",
              sourceReference: "NOTAM B1300/26",
            },
          },
        ],
      });

    expect(secondRun.status).toBe(201);

    const diffSecondResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?fromRefreshRunId=${firstRun.body.refreshRunId}&toRefreshRunId=${secondRun.body.refreshRunId}`,
    );

    expect(diffSecondResponse.status).toBe(200);
    expect(diffSecondResponse.body).toMatchObject({
      missionId,
      diff: {
        missionId,
        fromRefreshRunId: firstRun.body.refreshRunId,
        toRefreshRunId: secondRun.body.refreshRunId,
        added: [],
        removed: [
          expect.objectContaining({
            areaId: "TDA-1301",
            retired: true,
          }),
        ],
        persisted: [
          expect.objectContaining({
            areaId: "NOTAM-B1300-26",
            sourceType: "notam_restriction",
          }),
        ],
        changed: {
          updated: [
            expect.objectContaining({
              areaId: "NOTAM-B1300-26",
            }),
          ],
          superseded: [
            expect.objectContaining({
              areaId: "NOTAM-B1300-26",
            }),
          ],
          retired: [
            expect.objectContaining({
              areaId: "TDA-1301",
              retired: true,
            }),
          ],
        },
      },
    });

    const thirdRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1300/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1300-26",
              label: "Danger Area EGD-1300 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1300/26",
              sourceReference: "NOTAM B1300/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1302",
            },
            observedAt: "2026-04-21T10:10:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5102,
              centerLng: -0.1251,
              radiusMeters: 250,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1100,
            },
            severity: "caution",
            area: {
              areaId: "TDA-1302",
              label: "Temporary Danger Area 1302",
              areaType: "temporary_danger_area",
              description: "New area in later run",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(thirdRun.status).toBe(201);

    const diffThirdResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?fromRefreshRunId=${secondRun.body.refreshRunId}&toRefreshRunId=${thirdRun.body.refreshRunId}`,
    );

    expect(diffThirdResponse.status).toBe(200);
    expect(diffThirdResponse.body).toMatchObject({
      missionId,
      diff: {
        missionId,
        fromRefreshRunId: secondRun.body.refreshRunId,
        toRefreshRunId: thirdRun.body.refreshRunId,
        added: [
          expect.objectContaining({
            areaId: "TDA-1302",
            sourceType: "temporary_danger_area",
          }),
        ],
        removed: [],
        persisted: [
          expect.objectContaining({
            areaId: "NOTAM-B1300-26",
            sourceType: "notam_restriction",
          }),
        ],
      },
    });

    const missingParamResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?fromRefreshRunId=${firstRun.body.refreshRunId}`,
    );

    expect(missingParamResponse.status).toBe(400);
    expect(missingParamResponse.body).toMatchObject({
      error: {
        type: "refresh_run_diff_query_invalid",
      },
    });

    const sameRunResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?fromRefreshRunId=${firstRun.body.refreshRunId}&toRefreshRunId=${firstRun.body.refreshRunId}`,
    );

    expect(sameRunResponse.status).toBe(400);
    expect(sameRunResponse.body).toMatchObject({
      error: {
        type: "refresh_run_diff_query_invalid",
      },
    });
  });

  it("returns refresh-run chronology in inferred chronological order with adjacent transitions", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-1400",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-1400",
              label: "Danger Area EGD-1400",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1401",
            },
            observedAt: "2026-04-21T10:08:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5091,
              centerLng: -0.1261,
              radiusMeters: 280,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1200,
            },
            severity: "critical",
            area: {
              areaId: "TDA-1401",
              label: "Temporary Danger Area 1401",
              areaType: "temporary_danger_area",
              description: "Will be retired later",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1400/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1400-26",
              label: "Danger Area EGD-1400 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1400/26",
              sourceReference: "NOTAM B1400/26",
            },
          },
        ],
      });

    const thirdRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1400/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1400-26",
              label: "Danger Area EGD-1400 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1400/26",
              sourceReference: "NOTAM B1400/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1402",
            },
            observedAt: "2026-04-21T10:10:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5102,
              centerLng: -0.1251,
              radiusMeters: 250,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1100,
            },
            severity: "caution",
            area: {
              areaId: "TDA-1402",
              label: "Temporary Danger Area 1402",
              areaType: "temporary_danger_area",
              description: "New area in later run",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    expect(secondRun.status).toBe(201);
    expect(thirdRun.status).toBe(201);

    const chronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?chronology=true`,
    );

    expect(chronologyResponse.status).toBe(200);
    expect(chronologyResponse.body).toMatchObject({
      missionId,
      chronology: {
        missionId,
        refreshRuns: [
          expect.objectContaining({ refreshRunId: firstRun.body.refreshRunId }),
          expect.objectContaining({ refreshRunId: secondRun.body.refreshRunId }),
          expect.objectContaining({ refreshRunId: thirdRun.body.refreshRunId }),
        ],
        transitions: [
          expect.objectContaining({
            fromRefreshRunId: firstRun.body.refreshRunId,
            toRefreshRunId: secondRun.body.refreshRunId,
            persisted: [
              expect.objectContaining({
                areaId: "NOTAM-B1400-26",
              }),
            ],
          }),
          expect.objectContaining({
            fromRefreshRunId: secondRun.body.refreshRunId,
            toRefreshRunId: thirdRun.body.refreshRunId,
            added: [
              expect.objectContaining({
                areaId: "TDA-1402",
              }),
            ],
          }),
        ],
      },
    });

    const invalidChronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?chronology=true&refreshRunId=${firstRun.body.refreshRunId}`,
    );

    expect(invalidChronologyResponse.status).toBe(400);
    expect(invalidChronologyResponse.body).toMatchObject({
      error: {
        type: "refresh_run_chronology_query_invalid",
      },
    });
  });

  it("returns direct transition drilldown for one chronology transition", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-1500",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-1500",
              label: "Danger Area EGD-1500",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1501",
            },
            observedAt: "2026-04-21T10:08:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5091,
              centerLng: -0.1261,
              radiusMeters: 280,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1200,
            },
            severity: "critical",
            area: {
              areaId: "TDA-1501",
              label: "Temporary Danger Area 1501",
              areaType: "temporary_danger_area",
              description: "Will be retired later",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1500/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1500-26",
              label: "Danger Area EGD-1500 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1500/26",
              sourceReference: "NOTAM B1500/26",
            },
          },
        ],
      });

    const thirdRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1500/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1500-26",
              label: "Danger Area EGD-1500 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1500/26",
              sourceReference: "NOTAM B1500/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1502",
            },
            observedAt: "2026-04-21T10:10:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5102,
              centerLng: -0.1251,
              radiusMeters: 250,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1100,
            },
            severity: "caution",
            area: {
              areaId: "TDA-1502",
              label: "Temporary Danger Area 1502",
              areaType: "temporary_danger_area",
              description: "New area in later run",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    expect(secondRun.status).toBe(201);
    expect(thirdRun.status).toBe(201);

    const chronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?chronology=true`,
    );

    expect(chronologyResponse.status).toBe(200);

    const drilldownResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionFromRefreshRunId=${secondRun.body.refreshRunId}&transitionToRefreshRunId=${thirdRun.body.refreshRunId}`,
    );

    expect(drilldownResponse.status).toBe(200);
    expect(drilldownResponse.body).toMatchObject({
      missionId,
      transition: {
        missionId,
        fromRefreshRunId: secondRun.body.refreshRunId,
        toRefreshRunId: thirdRun.body.refreshRunId,
        added: [
          expect.objectContaining({
            areaId: "TDA-1502",
            sourceType: "temporary_danger_area",
          }),
        ],
        persisted: [
          expect.objectContaining({
            areaId: "NOTAM-B1500-26",
            sourceType: "notam_restriction",
          }),
        ],
      },
    });
    expect(drilldownResponse.body.transition).toEqual(
      chronologyResponse.body.chronology.transitions[1],
    );

    const invalidDrilldownResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionFromRefreshRunId=${secondRun.body.refreshRunId}&transitionToRefreshRunId=${thirdRun.body.refreshRunId}&chronology=true`,
    );

    expect(invalidDrilldownResponse.status).toBe(400);
    expect(invalidDrilldownResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_drilldown_query_invalid",
      },
    });
  });

  it("returns a direct transition artifact payload for one chronology transition", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-1600",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-1600",
              label: "Danger Area EGD-1600",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
        ],
      });

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1600/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1600-26",
              label: "Danger Area EGD-1600 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1600/26",
              sourceReference: "NOTAM B1600/26",
            },
          },
        ],
      });

    const thirdRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1600/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1600-26",
              label: "Danger Area EGD-1600 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1600/26",
              sourceReference: "NOTAM B1600/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1602",
            },
            observedAt: "2026-04-21T10:10:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5102,
              centerLng: -0.1251,
              radiusMeters: 250,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1100,
            },
            severity: "caution",
            area: {
              areaId: "TDA-1602",
              label: "Temporary Danger Area 1602",
              areaType: "temporary_danger_area",
              description: "New area in later run",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    expect(secondRun.status).toBe(201);
    expect(thirdRun.status).toBe(201);

    const drilldownResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionFromRefreshRunId=${secondRun.body.refreshRunId}&transitionToRefreshRunId=${thirdRun.body.refreshRunId}`,
    );

    const artifactResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifact=true&transitionFromRefreshRunId=${secondRun.body.refreshRunId}&transitionToRefreshRunId=${thirdRun.body.refreshRunId}`,
    );

    expect(artifactResponse.status).toBe(200);
    expect(artifactResponse.body).toMatchObject({
      missionId,
      artifact: {
        artifactId: `refresh_run_transition:${missionId}:${secondRun.body.refreshRunId}:${thirdRun.body.refreshRunId}`,
        missionId,
        artifactType: "refresh_run_transition",
        fromRefreshRunId: secondRun.body.refreshRunId,
        toRefreshRunId: thirdRun.body.refreshRunId,
        transition: {
          missionId,
          fromRefreshRunId: secondRun.body.refreshRunId,
          toRefreshRunId: thirdRun.body.refreshRunId,
          added: [
            expect.objectContaining({
              areaId: "TDA-1602",
            }),
          ],
          persisted: [
            expect.objectContaining({
              areaId: "NOTAM-B1600-26",
            }),
          ],
        },
      },
    });
    expect(artifactResponse.body.artifact.transition).toEqual(
      drilldownResponse.body.transition,
    );

    const invalidArtifactResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifact=true&transitionFromRefreshRunId=${secondRun.body.refreshRunId}&transitionToRefreshRunId=${thirdRun.body.refreshRunId}&chronology=true`,
    );

    expect(invalidArtifactResponse.status).toBe(400);
    expect(invalidArtifactResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_artifact_query_invalid",
      },
    });
  });

  it("filters a transition artifact directly by artifact id", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-1700",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-1700",
              label: "Danger Area EGD-1700",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
        ],
      });

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1700/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1700-26",
              label: "Danger Area EGD-1700 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1700/26",
              sourceReference: "NOTAM B1700/26",
            },
          },
        ],
      });

    const thirdRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1700/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1700-26",
              label: "Danger Area EGD-1700 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1700/26",
              sourceReference: "NOTAM B1700/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1702",
            },
            observedAt: "2026-04-21T10:10:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5102,
              centerLng: -0.1251,
              radiusMeters: 250,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1100,
            },
            severity: "caution",
            area: {
              areaId: "TDA-1702",
              label: "Temporary Danger Area 1702",
              areaType: "temporary_danger_area",
              description: "New area in later run",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    expect(secondRun.status).toBe(201);
    expect(thirdRun.status).toBe(201);

    const unfilteredArtifactResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifact=true&transitionFromRefreshRunId=${secondRun.body.refreshRunId}&transitionToRefreshRunId=${thirdRun.body.refreshRunId}`,
    );

    const filteredArtifactResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifact=true&transitionArtifactId=refresh_run_transition:${missionId}:${secondRun.body.refreshRunId}:${thirdRun.body.refreshRunId}`,
    );

    expect(filteredArtifactResponse.status).toBe(200);
    expect(filteredArtifactResponse.body).toEqual(
      unfilteredArtifactResponse.body,
    );

    const invalidArtifactIdResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifact=true&transitionArtifactId=bad-format`,
    );

    expect(invalidArtifactIdResponse.status).toBe(400);
    expect(invalidArtifactIdResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_artifact_query_invalid",
      },
    });

    const mismatchedMissionResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifact=true&transitionArtifactId=refresh_run_transition:${randomUUID()}:${secondRun.body.refreshRunId}:${thirdRun.body.refreshRunId}`,
    );

    expect(mismatchedMissionResponse.status).toBe(400);
    expect(mismatchedMissionResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_artifact_query_invalid",
      },
    });
  });

  it("lists ordered transition artifacts directly from chronology", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-1800",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-1800",
              label: "Danger Area EGD-1800",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1801",
            },
            observedAt: "2026-04-21T10:08:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5091,
              centerLng: -0.1261,
              radiusMeters: 280,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1200,
            },
            severity: "critical",
            area: {
              areaId: "TDA-1801",
              label: "Temporary Danger Area 1801",
              areaType: "temporary_danger_area",
              description: "Will be retired later",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1800/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1800-26",
              label: "Danger Area EGD-1800 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1800/26",
              sourceReference: "NOTAM B1800/26",
            },
          },
        ],
      });

    const thirdRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1800/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1800-26",
              label: "Danger Area EGD-1800 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1800/26",
              sourceReference: "NOTAM B1800/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1802",
            },
            observedAt: "2026-04-21T10:10:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5102,
              centerLng: -0.1251,
              radiusMeters: 250,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1100,
            },
            severity: "caution",
            area: {
              areaId: "TDA-1802",
              label: "Temporary Danger Area 1802",
              areaType: "temporary_danger_area",
              description: "New area in later run",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    expect(secondRun.status).toBe(201);
    expect(thirdRun.status).toBe(201);

    const chronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?chronology=true`,
    );

    const artifactChronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true`,
    );

    expect(artifactChronologyResponse.status).toBe(200);
    expect(artifactChronologyResponse.body).toMatchObject({
      missionId,
      chronology: {
        missionId,
        artifacts: [
          expect.objectContaining({
            artifactId: `refresh_run_transition:${missionId}:${firstRun.body.refreshRunId}:${secondRun.body.refreshRunId}`,
            fromRefreshRunId: firstRun.body.refreshRunId,
            toRefreshRunId: secondRun.body.refreshRunId,
          }),
          expect.objectContaining({
            artifactId: `refresh_run_transition:${missionId}:${secondRun.body.refreshRunId}:${thirdRun.body.refreshRunId}`,
            fromRefreshRunId: secondRun.body.refreshRunId,
            toRefreshRunId: thirdRun.body.refreshRunId,
          }),
        ],
      },
    });

    expect(
      artifactChronologyResponse.body.chronology.artifacts.map(
        (artifact: { transition: unknown }) => artifact.transition,
      ),
    ).toEqual(chronologyResponse.body.chronology.transitions);

    const invalidArtifactChronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifact=true`,
    );

    expect(invalidArtifactChronologyResponse.status).toBe(400);
    expect(invalidArtifactChronologyResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_artifact_chronology_query_invalid",
      },
    });
  });

  it("filters ordered transition artifacts directly from chronology", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-1900",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-1900",
              label: "Danger Area EGD-1900",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
        ],
      });

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1900/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1900-26",
              label: "Danger Area EGD-1900 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1900/26",
              sourceReference: "NOTAM B1900/26",
            },
          },
        ],
      });

    const thirdRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B1900/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B1900-26",
              label: "Danger Area EGD-1900 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B1900/26",
              sourceReference: "NOTAM B1900/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-1902",
            },
            observedAt: "2026-04-21T10:10:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5102,
              centerLng: -0.1251,
              radiusMeters: 250,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1100,
            },
            severity: "caution",
            area: {
              areaId: "TDA-1902",
              label: "Temporary Danger Area 1902",
              areaType: "temporary_danger_area",
              description: "New area in later run",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    expect(secondRun.status).toBe(201);
    expect(thirdRun.status).toBe(201);

    const fullArtifactChronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true`,
    );

    const selectedArtifactId = `refresh_run_transition:${missionId}:${secondRun.body.refreshRunId}:${thirdRun.body.refreshRunId}`;
    const filteredArtifactChronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactIds=${selectedArtifactId}`,
    );

    expect(filteredArtifactChronologyResponse.status).toBe(200);
    expect(filteredArtifactChronologyResponse.body).toMatchObject({
      missionId,
      chronology: {
        missionId,
        artifacts: [
          expect.objectContaining({
            artifactId: selectedArtifactId,
            fromRefreshRunId: secondRun.body.refreshRunId,
            toRefreshRunId: thirdRun.body.refreshRunId,
          }),
        ],
      },
    });
    expect(filteredArtifactChronologyResponse.body.chronology.artifacts).toEqual([
      fullArtifactChronologyResponse.body.chronology.artifacts[1],
    ]);

    const invalidArtifactIdsResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactIds=bad-format`,
    );

    expect(invalidArtifactIdsResponse.status).toBe(400);
    expect(invalidArtifactIdsResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_artifact_chronology_query_invalid",
      },
    });

    const mismatchedMissionResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactIds=refresh_run_transition:${randomUUID()}:${secondRun.body.refreshRunId}:${thirdRun.body.refreshRunId}`,
    );

    expect(mismatchedMissionResponse.status).toBe(400);
    expect(mismatchedMissionResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_artifact_chronology_query_invalid",
      },
    });
  });

  it("paginates ordered transition artifacts directly from chronology", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-2000",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-2000",
              label: "Danger Area EGD-2000",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
        ],
      });

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B2000/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B2000-26",
              label: "Danger Area EGD-2000 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B2000/26",
              sourceReference: "NOTAM B2000/26",
            },
          },
        ],
      });

    const thirdRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B2000/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B2000-26",
              label: "Danger Area EGD-2000 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B2000/26",
              sourceReference: "NOTAM B2000/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-2002",
            },
            observedAt: "2026-04-21T10:10:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5102,
              centerLng: -0.1251,
              radiusMeters: 250,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1100,
            },
            severity: "caution",
            area: {
              areaId: "TDA-2002",
              label: "Temporary Danger Area 2002",
              areaType: "temporary_danger_area",
              description: "New area in later run",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    const fourthRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B2000/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B2000-26",
              label: "Danger Area EGD-2000 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B2000/26",
              sourceReference: "NOTAM B2000/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-2003",
            },
            observedAt: "2026-04-21T10:11:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5112,
              centerLng: -0.1241,
              radiusMeters: 220,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            severity: "info",
            area: {
              areaId: "TDA-2003",
              label: "Temporary Danger Area 2003",
              areaType: "temporary_danger_area",
              description: "New later area",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    expect(secondRun.status).toBe(201);
    expect(thirdRun.status).toBe(201);
    expect(fourthRun.status).toBe(201);

    const fullArtifactChronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true`,
    );

    const paginatedArtifactChronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactOffset=1&transitionArtifactLimit=2`,
    );

    expect(paginatedArtifactChronologyResponse.status).toBe(200);
    expect(paginatedArtifactChronologyResponse.body).toMatchObject({
      missionId,
      chronology: {
        missionId,
        pagination: {
          totalCount: 3,
          offset: 1,
          limit: 2,
          nextOffset: null,
          previousOffset: 0,
        },
      },
    });
    expect(paginatedArtifactChronologyResponse.body.chronology.artifacts).toEqual(
      fullArtifactChronologyResponse.body.chronology.artifacts.slice(1, 3),
    );

    const filteredSelectedArtifactId =
      fullArtifactChronologyResponse.body.chronology.artifacts[1].artifactId;
    const filteredPaginatedResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactIds=${filteredSelectedArtifactId}&transitionArtifactOffset=0&transitionArtifactLimit=1`,
    );

    expect(filteredPaginatedResponse.status).toBe(200);
    expect(filteredPaginatedResponse.body).toMatchObject({
      missionId,
      chronology: {
        pagination: {
          totalCount: 1,
          offset: 0,
          limit: 1,
          nextOffset: null,
          previousOffset: null,
        },
      },
    });
    expect(filteredPaginatedResponse.body.chronology.artifacts).toEqual([
      fullArtifactChronologyResponse.body.chronology.artifacts[1],
    ]);

    const invalidOffsetResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactOffset=-1`,
    );

    expect(invalidOffsetResponse.status).toBe(400);
    expect(invalidOffsetResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_artifact_chronology_pagination_query_invalid",
      },
    });

    const invalidLimitResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactLimit=0`,
    );

    expect(invalidLimitResponse.status).toBe(400);
    expect(invalidLimitResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_artifact_chronology_pagination_query_invalid",
      },
    });
  });

  it("resumes paginated transition artifact chronology windows directly by cursor", async () => {
    const missionId = await createMission();

    const firstRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "danger_area",
              sourceRecordId: "EGD-2100",
            },
            observedAt: "2026-04-21T10:07:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "caution",
            area: {
              areaId: "EGD-2100",
              label: "Danger Area EGD-2100",
              areaType: "danger_area",
              description: "Base area",
              authorityName: "CAA",
              sourceReference: "ENR 5.1",
            },
          },
        ],
      });

    const secondRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B2100/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B2100-26",
              label: "Danger Area EGD-2100 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B2100/26",
              sourceReference: "NOTAM B2100/26",
            },
          },
        ],
      });

    const thirdRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B2100/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B2100-26",
              label: "Danger Area EGD-2100 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B2100/26",
              sourceReference: "NOTAM B2100/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-2102",
            },
            observedAt: "2026-04-21T10:10:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5102,
              centerLng: -0.1251,
              radiusMeters: 250,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1100,
            },
            severity: "caution",
            area: {
              areaId: "TDA-2102",
              label: "Temporary Danger Area 2102",
              areaType: "temporary_danger_area",
              description: "New area in later run",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    const fourthRun = await request(app)
      .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
      .send({
        records: [
          {
            source: {
              provider: "uk-ais",
              sourceType: "notam_restriction",
              sourceRecordId: "B2100/26",
            },
            observedAt: "2026-04-21T10:09:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5078,
              centerLng: -0.1269,
              radiusMeters: 350,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 900,
            },
            severity: "critical",
            area: {
              areaId: "NOTAM-B2100-26",
              label: "Danger Area EGD-2100 NOTAM",
              areaType: "notam_restriction",
              description: "Superseding area",
              authorityName: "NATS",
              notamNumber: "B2100/26",
              sourceReference: "NOTAM B2100/26",
            },
          },
          {
            source: {
              provider: "uk-ais",
              sourceType: "temporary_danger_area",
              sourceRecordId: "TDA-2103",
            },
            observedAt: "2026-04-21T10:11:00.000Z",
            validFrom: "2026-04-21T10:00:00.000Z",
            validTo: "2026-04-21T14:00:00.000Z",
            geometry: {
              type: "circle",
              centerLat: 51.5112,
              centerLng: -0.1241,
              radiusMeters: 220,
              altitudeFloorFt: 0,
              altitudeCeilingFt: 1000,
            },
            severity: "info",
            area: {
              areaId: "TDA-2103",
              label: "Temporary Danger Area 2103",
              areaType: "temporary_danger_area",
              description: "New later area",
              authorityName: "CAA",
              sourceReference: "Temporary activation notice",
            },
          },
        ],
      });

    expect(firstRun.status).toBe(201);
    expect(secondRun.status).toBe(201);
    expect(thirdRun.status).toBe(201);
    expect(fourthRun.status).toBe(201);

    const firstPageResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactLimit=1`,
    );
    const fullArtifactChronologyResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true`,
    );

    expect(firstPageResponse.status).toBe(200);
    expect(firstPageResponse.body).toMatchObject({
      missionId,
      chronology: {
        pagination: {
          totalCount: 3,
          offset: 0,
          limit: 1,
          previousCursor: null,
        },
      },
    });
    expect(firstPageResponse.body.chronology.pagination.nextCursor).toEqual(
      expect.any(String),
    );

    const secondPageResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactCursor=${firstPageResponse.body.chronology.pagination.nextCursor}`,
    );

    expect(secondPageResponse.status).toBe(200);
    expect(secondPageResponse.body).toMatchObject({
      missionId,
      chronology: {
        pagination: {
          totalCount: 3,
          offset: 1,
          limit: 1,
          previousCursor: expect.any(String),
        },
      },
    });
    expect(secondPageResponse.body.chronology.artifacts).toEqual(
      fullArtifactChronologyResponse.body.chronology.artifacts.slice(1, 2),
    );

    const previousPageResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactCursor=${secondPageResponse.body.chronology.pagination.previousCursor}`,
    );

    expect(previousPageResponse.status).toBe(200);
    expect(previousPageResponse.body.chronology.artifacts).toEqual(
      firstPageResponse.body.chronology.artifacts,
    );

    const invalidCursorResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactCursor=bad-cursor`,
    );

    expect(invalidCursorResponse.status).toBe(400);
    expect(invalidCursorResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_artifact_chronology_cursor_query_invalid",
      },
    });

    const mixedCursorResponse = await request(app).get(
      `/missions/${missionId}/external-overlays/refresh-runs?transitionArtifactChronology=true&transitionArtifactCursor=${firstPageResponse.body.chronology.pagination.nextCursor}&transitionArtifactOffset=1`,
    );

    expect(mixedCursorResponse.status).toBe(400);
    expect(mixedCursorResponse.body).toMatchObject({
      error: {
        type: "refresh_run_transition_artifact_chronology_cursor_query_invalid",
      },
    });
  });

  it("keeps weather, crewed traffic, drone traffic, and area conflict paths intact when listed together", async () => {
    const missionId = await createMission();

    await request(app)
      .post(`/missions/${missionId}/external-overlays`)
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
          windSpeedKnots: 12,
          windDirectionDegrees: 205,
          temperatureC: 10,
          precipitation: "none",
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
        observedAt: "2026-04-21T10:03:00.000Z",
        geometry: {
          type: "point",
          lat: 51.508,
          lng: -0.12,
          altitudeMslFt: 2400,
        },
        headingDegrees: 80,
        speedKnots: 148,
        metadata: {
          trafficId: "traffic-3003",
          callsign: "N123AB",
          trackSource: "adsb_exchange",
          aircraftCategory: "fixed_wing",
          verticalRateFpm: null,
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
        observedAt: "2026-04-21T10:06:00.000Z",
        geometry: {
          type: "polygon",
          points: [
            { lat: 51.5072, lng: -0.1285 },
            { lat: 51.5089, lng: -0.1285 },
            { lat: 51.5089, lng: -0.126 },
            { lat: 51.5072, lng: -0.126 },
          ],
          altitudeFloorFt: 0,
          altitudeCeilingFt: 1200,
        },
        metadata: {
          areaId: "zone-7007",
          label: "City event exclusion area",
          areaType: "event_restriction",
          description: null,
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
        observedAt: "2026-04-21T10:05:00.000Z",
        geometry: {
          type: "point",
          lat: 51.5068,
          lng: -0.1186,
          altitudeMslFt: 390,
        },
        headingDegrees: 140,
        speedKnots: 32,
        metadata: {
          trafficId: "drone-5005",
          trackSource: "remote_id",
          vehicleType: "multirotor",
          operatorReference: "fleet-4",
          verticalRateFpm: 90,
        },
      });

    const listAllResponse = await request(app).get(
      `/missions/${missionId}/external-overlays`,
    );

    expect(listAllResponse.status).toBe(200);
    expect(listAllResponse.body.overlays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "weather" }),
        expect.objectContaining({ kind: "crewed_traffic" }),
        expect.objectContaining({ kind: "drone_traffic" }),
        expect.objectContaining({ kind: "area_conflict" }),
      ]),
    );
  });

  it("returns 404 for missing missions on external overlay reads", async () => {
    const response = await request(app).get(
      `/missions/${randomUUID()}/external-overlays`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
  });
});
