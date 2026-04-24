import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const lowRiskInput = {
  operatingCategory: "open",
  missionComplexity: "low",
  populationExposure: "low",
  airspaceComplexity: "low",
  weatherRisk: "low",
  payloadRisk: "low",
};

const clearAirspaceInput = {
  airspaceClass: "g",
  maxAltitudeFt: 300,
  restrictionStatus: "clear",
  permissionStatus: "not_required",
};

async function expectStatus(
  label: string,
  promise: Promise<request.Response>,
  expectedStatus: number,
) {
  const response = await promise;

  if (response.status !== expectedStatus) {
    throw new Error(
      `${label} failed: expected ${expectedStatus}, got ${response.status} ${JSON.stringify(
        response.body,
      )}`,
    );
  }

  return response;
}

async function createPlatform() {
  const response = await expectStatus(
    "create platform",
    request(app).post("/platforms").send({
      name: `Live Ops Demo Platform ${Date.now()}`,
      status: "active",
    }),
    201,
  );

  return response.body.platform as { id: string };
}

async function createPilot() {
  const response = await expectStatus(
    "create pilot",
    request(app).post("/pilots").send({
      displayName: `Live Ops Demo Pilot ${Date.now()}`,
      status: "active",
    }),
    201,
  );

  return response.body.pilot as { id: string };
}

async function createPilotReadinessEvidence(pilotId: string) {
  await expectStatus(
    "create pilot readiness evidence",
    request(app)
      .post(`/pilots/${pilotId}/readiness-evidence`)
      .send({
        evidenceType: "operator_authorisation",
        title: "Current operator authorisation",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    201,
  );
}

const demoAreaSourceRecords = [
  {
    source: {
      provider: "synthetic-caa-airspace",
      sourceType: "danger_area",
      sourceRecordId: "DA-312-20260421",
    },
    observedAt: "2026-04-21T11:55:00.000Z",
    validFrom: "2026-04-21T11:30:00.000Z",
    validTo: "2026-04-21T13:30:00.000Z",
    geometry: {
      type: "polygon",
      points: [
        { lat: 51.5102, lng: -0.132 },
        { lat: 51.5134, lng: -0.1288 },
        { lat: 51.5122, lng: -0.1239 },
        { lat: 51.5089, lng: -0.1253 },
      ],
      altitudeFloorFt: 0,
      altitudeCeilingFt: 1960,
    },
    severity: "caution",
    confidence: 0.96,
    freshnessSeconds: 120,
    area: {
      areaId: "DA-312",
      label: "DA 312",
      areaType: "danger_area",
      description: "Synthetic demo danger area near the live ops route",
      authorityName: "Synthetic CAA Airspace",
      sourceReference: "Demo UK AIP ENR 5.1 package",
    },
  },
  {
    source: {
      provider: "synthetic-danger-area-feed",
      sourceType: "temporary_danger_area",
      sourceRecordId: "TDA-625A-20260421",
    },
    observedAt: "2026-04-21T11:56:00.000Z",
    validFrom: "2026-04-21T11:45:00.000Z",
    validTo: "2026-04-21T13:15:00.000Z",
    geometry: {
      type: "polygon",
      points: [
        { lat: 51.5093, lng: -0.1282 },
        { lat: 51.5117, lng: -0.1266 },
        { lat: 51.5109, lng: -0.1226 },
        { lat: 51.5078, lng: -0.1239 },
      ],
      altitudeFloorFt: 0,
      altitudeCeilingFt: 1400,
    },
    severity: "critical",
    confidence: 0.94,
    freshnessSeconds: 180,
    area: {
      areaId: "TDA-625A",
      label: "TDA 625A",
      areaType: "temporary_danger_area",
      description: "Synthetic temporary activation used for live ops review",
      authorityName: "Synthetic Airspace Coordination Cell",
      sourceReference: "Demo temporary activation notice",
    },
  },
  {
    source: {
      provider: "synthetic-notam-feed",
      sourceType: "notam_restriction",
      sourceRecordId: "DEMO-A0421-26",
    },
    observedAt: "2026-04-21T11:57:00.000Z",
    validFrom: "2026-04-21T11:50:00.000Z",
    validTo: "2026-04-21T12:50:00.000Z",
    severity: "caution",
    confidence: 0.91,
    freshnessSeconds: 240,
    altitudeFloorFt: 0,
    altitudeCeilingFt: 2000,
    area: {
      areaId: "NOTAM-DEMO-A0421-26",
      label: "NOTAM DEMO LOW LEVEL",
      areaType: "notam_restriction",
      description: "Synthetic NOTAM restriction derived from Q-line geometry",
      authorityName: "Synthetic NOTAM Office",
      notamNumber: "A0421/26",
      sourceReference: "Demo NOTAM A0421/26",
    },
    notamGeometry: {
      qLine: {
        centerLat: 51.4833,
        centerLng: -0.1333,
        radiusNm: 5,
      },
    },
  },
];

async function main() {
  try {
    await runMigrations(pool);

    const platform = await createPlatform();
    const pilot = await createPilot();
    await createPilotReadinessEvidence(pilot.id);

    const draftResponse = await expectStatus(
      "create mission draft",
      request(app).post("/mission-plans/drafts").send({
        missionPlanId: `live-ops-demo-${Date.now()}`,
        platformId: platform.id,
        pilotId: pilot.id,
        riskInput: lowRiskInput,
        airspaceInput: clearAirspaceInput,
      }),
      201,
    );

    const missionId = draftResponse.body.draft.missionId as string;

    const handoffResponse = await expectStatus(
      "create approval handoff",
      request(app)
        .post(`/mission-plans/drafts/${missionId}/approval-handoff`)
        .send({
          createdBy: "live-ops-demo-seed",
        }),
      201,
    );

    await expectStatus(
      "submit mission",
      request(app).post(`/missions/${missionId}/submit`).send({
        userId: "live-ops-demo-operator",
      }),
      204,
    );

    await expectStatus(
      "approve mission",
      request(app).post(`/missions/${missionId}/approve`).send({
        reviewerId: "live-ops-demo-reviewer",
        decisionEvidenceLinkId:
          handoffResponse.body.handoff.approvalEvidenceLink.id,
        notes: "Demo mission approved for live ops review",
      }),
      204,
    );

    const snapshotResponse = await expectStatus(
      "create dispatch readiness snapshot",
      request(app)
        .post(`/missions/${missionId}/readiness/audit-snapshots`)
        .send({
          createdBy: "live-ops-demo-dispatch",
        }),
      201,
    );

    const dispatchEvidenceResponse = await expectStatus(
      "create dispatch evidence link",
      request(app)
        .post(`/missions/${missionId}/decision-evidence-links`)
        .send({
          snapshotId: snapshotResponse.body.snapshot.id,
          decisionType: "dispatch",
          createdBy: "live-ops-demo-dispatch",
        }),
      201,
    );

    await expectStatus(
      "launch mission",
      request(app).post(`/missions/${missionId}/launch`).send({
        operatorId: "live-ops-demo-operator",
        vehicleId: "demo-vehicle-1",
        lat: 51.5074,
        lng: -0.1278,
        decisionEvidenceLinkId: dispatchEvidenceResponse.body.link.id,
      }),
      204,
    );

    await expectStatus(
      "record telemetry",
      request(app).post(`/missions/${missionId}/telemetry`).send({
        records: [
          {
            timestamp: "2026-04-21T12:00:00.000Z",
            lat: 51.5074,
            lng: -0.1278,
            altitudeM: 120,
            speedMps: 18,
            headingDeg: 92,
            progressPct: 8,
            payload: { segment: "departure" },
          },
          {
            timestamp: "2026-04-21T12:01:00.000Z",
            lat: 51.5076,
            lng: -0.1276,
            altitudeM: 123,
            speedMps: 22,
            headingDeg: 96,
            progressPct: 28,
            payload: { segment: "mission-leg-1" },
          },
          {
            timestamp: "2026-04-21T12:02:00.000Z",
            lat: 51.5078,
            lng: -0.1274,
            altitudeM: 125,
            speedMps: 55,
            headingDeg: 101,
            progressPct: 52,
            payload: { segment: "mission-leg-2" },
          },
          {
            timestamp: "2026-04-21T12:03:00.000Z",
            lat: 51.5081,
            lng: -0.1271,
            altitudeM: 124,
            speedMps: 54,
            headingDeg: 107,
            progressPct: 76,
            payload: { segment: "return" },
          },
        ],
      }),
      202,
    );

    await expectStatus(
      "create weather overlay",
      request(app)
        .post(`/missions/${missionId}/external-overlays`)
        .send({
          kind: "weather",
          source: {
            provider: "met-office",
            sourceType: "surface_observation",
            sourceRecordId: `weather-${missionId}`,
          },
          observedAt: "2026-04-21T12:01:00.000Z",
          validFrom: "2026-04-21T12:00:00.000Z",
          validTo: "2026-04-21T12:20:00.000Z",
          geometry: {
            type: "point",
            lat: 51.5077,
            lng: -0.1275,
            altitudeMslFt: 410,
          },
          severity: "caution",
          confidence: 0.92,
          freshnessSeconds: 180,
          metadata: {
            windSpeedKnots: 28,
            windDirectionDegrees: 235,
            temperatureC: 9,
            precipitation: "rain",
          },
        }),
      201,
    );

    await expectStatus(
      "create crewed traffic overlay",
      request(app)
        .post(`/missions/${missionId}/external-overlays`)
        .send({
          kind: "crewed_traffic",
          source: {
            provider: "traffic-hub",
            sourceType: "adsb_exchange",
            sourceRecordId: `crewed-${missionId}`,
          },
          observedAt: "2026-04-21T12:02:15.000Z",
          geometry: {
            type: "point",
            lat: 51.5125,
            lng: -0.1218,
            altitudeMslFt: 620,
          },
          headingDegrees: 110,
          speedKnots: 145,
          severity: "info",
          freshnessSeconds: 45,
          metadata: {
            trafficId: "crewed-demo-22",
            callsign: "HELIMED21",
            trackSource: "adsb_exchange",
            aircraftCategory: "helicopter",
            verticalRateFpm: 150,
          },
        }),
      201,
    );

    await expectStatus(
      "create drone traffic overlay",
      request(app)
        .post(`/missions/${missionId}/external-overlays`)
        .send({
          kind: "drone_traffic",
          source: {
            provider: "utm-hub",
            sourceType: "remote_id",
            sourceRecordId: `drone-${missionId}`,
          },
          observedAt: "2026-04-21T12:02:05.000Z",
          geometry: {
            type: "point",
            lat: 51.5077,
            lng: -0.1275,
            altitudeMslFt: 410,
          },
          headingDegrees: 38,
          speedKnots: 24,
          severity: "caution",
          freshnessSeconds: 25,
          metadata: {
            trafficId: "drone-demo-44",
            trackSource: "remote_id",
            vehicleType: "multirotor",
            operatorReference: "op-44",
            verticalRateFpm: 80,
          },
        }),
      201,
    );

    const freshAreaRefreshResponse = await expectStatus(
      "normalize fresh demo area overlays",
      request(app)
        .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
        .send({
          records: demoAreaSourceRecords,
          refresh: { status: "fresh" },
        }),
      201,
    );

    const partialAreaRefreshResponse = await expectStatus(
      "normalize partial demo area overlays",
      request(app)
        .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
        .send({
          records: demoAreaSourceRecords.slice(0, 2).map((record) => ({
            ...record,
            observedAt: "2026-04-21T12:01:30.000Z",
            freshnessSeconds: 90,
          })),
          refresh: { status: "partial" },
        }),
      201,
    );

    const failedAreaRefreshResponse = await expectStatus(
      "record failed demo area overlay refresh",
      request(app)
        .post(`/missions/${missionId}/external-overlays/normalize-area-sources`)
        .send({
          records: [],
          refresh: { status: "failed" },
        }),
      201,
    );

    const alertsResponse = await expectStatus(
      "list mission alerts",
      request(app).get(`/missions/${missionId}/alerts`),
      200,
    );

    const conflictResponse = await expectStatus(
      "get conflict assessment",
      request(app).get(`/missions/${missionId}/conflict-assessment`),
      200,
    );

    const replayResponse = await expectStatus(
      "get mission replay",
      request(app).get(`/missions/${missionId}/replay`),
      200,
    );

    const areaOverlaysResponse = await expectStatus(
      "list demo area overlays",
      request(app).get(
        `/missions/${missionId}/external-overlays?kind=area_conflict&includeRetired=true`,
      ),
      200,
    );

    const areaRefreshRunsResponse = await expectStatus(
      "list demo area refresh runs",
      request(app).get(`/missions/${missionId}/external-overlays/refresh-runs`),
      200,
    );

    console.log(
      JSON.stringify(
        {
          missionId,
          missionPlanId: draftResponse.body.draft.missionPlanId,
          review: {
            workspaceUrl: `/operator/missions/${missionId}`,
            liveOperationsUrl: `/operator/missions/${missionId}/live-operations`,
            replayApiUrl: `/missions/${missionId}/replay`,
          },
          seeded: {
            replayPointCount: replayResponse.body.replay?.length ?? 0,
            alertCount: alertsResponse.body.alerts?.length ?? 0,
            conflictCount:
              conflictResponse.body.assessment?.conflicts?.length ?? 0,
            areaOverlayCount: areaOverlaysResponse.body.overlays?.length ?? 0,
            areaRefreshRunCount:
              areaRefreshRunsResponse.body.refreshRuns?.length ?? 0,
            areaRefreshRunIds: {
              fresh: freshAreaRefreshResponse.body.refreshRunId,
              partial: partialAreaRefreshResponse.body.refreshRunId,
              failed: failedAreaRefreshResponse.body.refreshRunId,
            },
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Live ops demo seed failed:", error);
  process.exit(1);
});
