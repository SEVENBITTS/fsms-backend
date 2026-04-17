import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from mission_risk_inputs");
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
  await pool.query("delete from pilot_readiness_evidence");
  await pool.query("delete from pilots");
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

const createReadyPilot = async () => {
  const pilotResponse = await request(app).post("/pilots").send({
    displayName: "Ready Pilot",
    status: "active",
  });

  expect(pilotResponse.status).toBe(201);
  const pilot = pilotResponse.body.pilot as { id: string };

  const evidenceResponse = await request(app)
    .post(`/pilots/${pilot.id}/readiness-evidence`)
    .send({
      evidenceType: "operator_authorisation",
      title: "Current operator authorisation",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

  expect(evidenceResponse.status).toBe(201);
  return pilot;
};

const insertMission = async (params: {
  id?: string;
  status?: string;
  platformId?: string | null;
  pilotId?: string | null;
}) => {
  const missionId = params.id ?? randomUUID();

  await pool.query(
    `
    insert into missions (
      id,
      status,
      mission_plan_id,
      platform_id,
      pilot_id,
      last_event_sequence_no
    )
    values ($1, $2, $3, $4, $5, $6)
    `,
    [
      missionId,
      params.status ?? "submitted",
      "plan-1",
      params.platformId ?? null,
      params.pilotId ?? null,
      0,
    ],
  );

  return missionId;
};

const createLowRiskInput = async (missionId: string) => {
  const response = await request(app)
    .post(`/missions/${missionId}/risk-inputs`)
    .send({
      operatingCategory: "open",
      missionComplexity: "low",
      populationExposure: "low",
      airspaceComplexity: "low",
      weatherRisk: "low",
      payloadRisk: "low",
    });

  expect(response.status).toBe(201);
  return response.body.input as { id: string };
};

const createModerateRiskInput = async (missionId: string) => {
  const response = await request(app)
    .post(`/missions/${missionId}/risk-inputs`)
    .send({
      operatingCategory: "specific",
      missionComplexity: "medium",
      populationExposure: "medium",
      airspaceComplexity: "medium",
      weatherRisk: "medium",
      payloadRisk: "low",
    });

  expect(response.status).toBe(201);
  return response.body.input as { id: string };
};

const createHighRiskInput = async (missionId: string) => {
  const response = await request(app)
    .post(`/missions/${missionId}/risk-inputs`)
    .send({
      operatingCategory: "certified",
      missionComplexity: "high",
      populationExposure: "high",
      airspaceComplexity: "high",
      weatherRisk: "high",
      payloadRisk: "high",
    });

  expect(response.status).toBe(201);
  return response.body.input as { id: string };
};

const countRows = async (params: {
  missionId: string;
  platformId?: string;
  pilotId?: string;
}) => {
  const result = await pool.query(
    `
    select
      (select status from missions where id = $1) as mission_status,
      (select last_event_sequence_no from missions where id = $1) as mission_sequence,
      (select count(*)::int from mission_events where mission_id = $1) as mission_event_count,
      (select count(*)::int from platforms where id = $2) as platform_count,
      (select count(*)::int from maintenance_schedules where platform_id = $2) as schedule_count,
      (select count(*)::int from maintenance_records where platform_id = $2) as record_count,
      (select count(*)::int from pilots where id = $3) as pilot_count,
      (select count(*)::int from pilot_readiness_evidence where pilot_id = $3) as pilot_evidence_count,
      (select count(*)::int from mission_risk_inputs where mission_id = $1) as risk_input_count
    `,
    [params.missionId, params.platformId ?? null, params.pilotId ?? null],
  );

  return result.rows[0] as {
    mission_status: string;
    mission_sequence: number;
    mission_event_count: number;
    platform_count: number;
    schedule_count: number;
    record_count: number;
    pilot_count: number;
    pilot_evidence_count: number;
    risk_input_count: number;
  };
};

describe("mission readiness platform gate integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("passes the mission platform gate when the assigned platform is ready", async () => {
    const platform = await createPlatform({
      name: "Mission Ready UAV",
      status: "active",
    });
    const pilot = await createReadyPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    await createLowRiskInput(missionId);
    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      result: "pass",
      gate: {
        result: "pass",
        blocksApproval: false,
        blocksDispatch: false,
        requiresReview: false,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_READY",
          severity: "pass",
          source: "platform",
          relatedPlatformId: platform.id,
          relatedPlatformReasonCodes: ["PLATFORM_ACTIVE"],
        },
        {
          code: "MISSION_PILOT_READY",
          severity: "pass",
          source: "pilot",
          relatedPilotId: pilot.id,
          relatedPilotReasonCodes: ["PILOT_ACTIVE"],
        },
        {
          code: "MISSION_RISK_READY",
          severity: "pass",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_ACCEPTABLE"],
        },
      ],
      platformReadiness: {
        platformId: platform.id,
        result: "pass",
      },
      pilotReadiness: {
        pilotId: pilot.id,
        result: "pass",
      },
      missionRisk: {
        missionId,
        result: "pass",
        score: 5,
        riskBand: "low",
      },
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    })).toEqual(before);
  });

  it("surfaces a warning when the assigned platform has overdue maintenance", async () => {
    const platform = await createPlatform({
      name: "Maintenance Due UAV",
      status: "active",
      totalFlightHours: 55,
    });
    const pilot = await createReadyPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    await createLowRiskInput(missionId);

    const scheduleResponse = await request(app)
      .post(`/platforms/${platform.id}/maintenance-schedules`)
      .send({
        taskName: "Propulsion inspection",
        nextDueFlightHours: 50,
      });

    expect(scheduleResponse.status).toBe(201);
    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      result: "warning",
      gate: {
        result: "warning",
        blocksApproval: false,
        blocksDispatch: false,
        requiresReview: true,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_WARNING",
          severity: "warning",
          source: "platform",
          relatedPlatformId: platform.id,
          relatedPlatformReasonCodes: ["PLATFORM_MAINTENANCE_DUE"],
        },
        {
          code: "MISSION_PILOT_READY",
          severity: "pass",
          source: "pilot",
          relatedPilotId: pilot.id,
          relatedPilotReasonCodes: ["PILOT_ACTIVE"],
        },
        {
          code: "MISSION_RISK_READY",
          severity: "pass",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_ACCEPTABLE"],
        },
      ],
      platformReadiness: {
        platformId: platform.id,
        result: "warning",
      },
      pilotReadiness: {
        pilotId: pilot.id,
        result: "pass",
      },
      missionRisk: {
        missionId,
        result: "pass",
      },
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    })).toEqual(before);
  });

  it.each([
    {
      status: "grounded",
      platformCode: "PLATFORM_GROUNDED",
    },
    {
      status: "retired",
      platformCode: "PLATFORM_RETIRED",
    },
  ])("fails the mission platform gate for a $status platform", async ({ status, platformCode }) => {
    const platform = await createPlatform({
      name: `${status} UAV`,
      status,
    });
    const pilot = await createReadyPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    await createLowRiskInput(missionId);
    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      result: "fail",
      gate: {
        result: "fail",
        blocksApproval: true,
        blocksDispatch: true,
        requiresReview: false,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_FAILED",
          severity: "fail",
          source: "platform",
          relatedPlatformId: platform.id,
          relatedPlatformReasonCodes: [platformCode],
        },
        {
          code: "MISSION_PILOT_READY",
          severity: "pass",
          source: "pilot",
          relatedPilotId: pilot.id,
          relatedPilotReasonCodes: ["PILOT_ACTIVE"],
        },
        {
          code: "MISSION_RISK_READY",
          severity: "pass",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_ACCEPTABLE"],
        },
      ],
      platformReadiness: {
        platformId: platform.id,
        result: "fail",
      },
      pilotReadiness: {
        pilotId: pilot.id,
        result: "pass",
      },
      missionRisk: {
        missionId,
        result: "pass",
      },
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    })).toEqual(before);
  });

  it("fails explicitly when the mission has no assigned platform", async () => {
    const pilot = await createReadyPilot();
    const missionId = await insertMission({
      platformId: null,
      pilotId: pilot.id,
    });
    await createLowRiskInput(missionId);
    const before = await countRows({ missionId, pilotId: pilot.id });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: null,
      pilotId: pilot.id,
      result: "fail",
      gate: {
        result: "fail",
        blocksApproval: true,
        blocksDispatch: true,
        requiresReview: false,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_NOT_ASSIGNED",
          severity: "fail",
          source: "mission",
        },
        {
          code: "MISSION_PILOT_READY",
          severity: "pass",
          source: "pilot",
          relatedPilotId: pilot.id,
          relatedPilotReasonCodes: ["PILOT_ACTIVE"],
        },
        {
          code: "MISSION_RISK_READY",
          severity: "pass",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_ACCEPTABLE"],
        },
      ],
      platformReadiness: null,
      pilotReadiness: {
        pilotId: pilot.id,
        result: "pass",
      },
      missionRisk: {
        missionId,
        result: "pass",
      },
    });
    expect(await countRows({ missionId, pilotId: pilot.id })).toEqual(before);
  });

  it("fails explicitly when a candidate platform override is unknown", async () => {
    const platform = await createPlatform({
      name: "Assigned UAV",
      status: "active",
    });
    const pilot = await createReadyPilot();
    const missingPlatformId = randomUUID();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    await createLowRiskInput(missionId);
    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    });

    const response = await request(app)
      .get(`/missions/${missionId}/readiness`)
      .query({ platformId: missingPlatformId });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: missingPlatformId,
      pilotId: pilot.id,
      result: "fail",
      gate: {
        result: "fail",
        blocksApproval: true,
        blocksDispatch: true,
        requiresReview: false,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_NOT_FOUND",
          severity: "fail",
          source: "mission",
          relatedPlatformId: missingPlatformId,
        },
        {
          code: "MISSION_PILOT_READY",
          severity: "pass",
          source: "pilot",
          relatedPilotId: pilot.id,
          relatedPilotReasonCodes: ["PILOT_ACTIVE"],
        },
        {
          code: "MISSION_RISK_READY",
          severity: "pass",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_ACCEPTABLE"],
        },
      ],
      platformReadiness: null,
      pilotReadiness: {
        pilotId: pilot.id,
        result: "pass",
      },
      missionRisk: {
        missionId,
        result: "pass",
      },
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    })).toEqual(before);
  });

  it("fails the combined mission gate when the assigned pilot has expired evidence", async () => {
    const platform = await createPlatform({
      name: "Ready UAV",
      status: "active",
    });
    const pilotResponse = await request(app).post("/pilots").send({
      displayName: "Expired Evidence Pilot",
      status: "active",
    });
    expect(pilotResponse.status).toBe(201);
    const pilot = pilotResponse.body.pilot as { id: string };

    await request(app)
      .post(`/pilots/${pilot.id}/readiness-evidence`)
      .send({
        evidenceType: "operator_authorisation",
        title: "Expired operator authorisation",
        expiresAt: "2020-01-01T00:00:00.000Z",
      });

    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    await createLowRiskInput(missionId);
    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      result: "fail",
      gate: {
        result: "fail",
        blocksApproval: true,
        blocksDispatch: true,
        requiresReview: false,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_READY",
          severity: "pass",
          source: "platform",
        },
        {
          code: "MISSION_PILOT_FAILED",
          severity: "fail",
          source: "pilot",
          relatedPilotId: pilot.id,
          relatedPilotReasonCodes: [
            "PILOT_EVIDENCE_MISSING",
            "PILOT_EVIDENCE_EXPIRED",
          ],
        },
        {
          code: "MISSION_RISK_READY",
          severity: "pass",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_ACCEPTABLE"],
        },
      ],
      platformReadiness: {
        result: "pass",
      },
      pilotReadiness: {
        pilotId: pilot.id,
        result: "fail",
      },
      missionRisk: {
        missionId,
        result: "pass",
      },
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    })).toEqual(before);
  });

  it("fails explicitly when the mission has no assigned pilot", async () => {
    const platform = await createPlatform({
      name: "Ready UAV",
      status: "active",
    });
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: null,
    });
    await createLowRiskInput(missionId);
    const before = await countRows({ missionId, platformId: platform.id });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      pilotId: null,
      result: "fail",
      reasons: [
        {
          code: "MISSION_PLATFORM_READY",
          severity: "pass",
          source: "platform",
        },
        {
          code: "MISSION_PILOT_NOT_ASSIGNED",
          severity: "fail",
          source: "mission",
        },
        {
          code: "MISSION_RISK_READY",
          severity: "pass",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_ACCEPTABLE"],
        },
      ],
      pilotReadiness: null,
      missionRisk: {
        missionId,
        result: "pass",
      },
    });
    expect(await countRows({ missionId, platformId: platform.id })).toEqual(before);
  });

  it("fails explicitly when a candidate pilot override is unknown", async () => {
    const platform = await createPlatform({
      name: "Ready UAV",
      status: "active",
    });
    const pilot = await createReadyPilot();
    const missingPilotId = randomUUID();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    await createLowRiskInput(missionId);
    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    });

    const response = await request(app)
      .get(`/missions/${missionId}/readiness`)
      .query({ pilotId: missingPilotId });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      pilotId: missingPilotId,
      result: "fail",
      reasons: [
        {
          code: "MISSION_PLATFORM_READY",
          severity: "pass",
          source: "platform",
        },
        {
          code: "MISSION_PILOT_NOT_FOUND",
          severity: "fail",
          source: "mission",
          relatedPilotId: missingPilotId,
        },
        {
          code: "MISSION_RISK_READY",
          severity: "pass",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_ACCEPTABLE"],
        },
      ],
      pilotReadiness: null,
      missionRisk: {
        missionId,
        result: "pass",
      },
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    })).toEqual(before);
  });

  it("surfaces mission risk warnings in the combined readiness gate", async () => {
    const platform = await createPlatform({
      name: "Ready UAV",
      status: "active",
    });
    const pilot = await createReadyPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    await createModerateRiskInput(missionId);
    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      result: "warning",
      gate: {
        result: "warning",
        blocksApproval: false,
        blocksDispatch: false,
        requiresReview: true,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_READY",
          severity: "pass",
          source: "platform",
        },
        {
          code: "MISSION_PILOT_READY",
          severity: "pass",
          source: "pilot",
        },
        {
          code: "MISSION_RISK_WARNING",
          severity: "warning",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_ELEVATED"],
        },
      ],
      missionRisk: {
        missionId,
        result: "warning",
        score: 11,
        riskBand: "moderate",
      },
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    })).toEqual(before);
  });

  it("fails the combined readiness gate for high mission risk", async () => {
    const platform = await createPlatform({
      name: "Ready UAV",
      status: "active",
    });
    const pilot = await createReadyPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    await createHighRiskInput(missionId);
    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      result: "fail",
      gate: {
        result: "fail",
        blocksApproval: true,
        blocksDispatch: true,
        requiresReview: false,
      },
      reasons: [
        {
          code: "MISSION_PLATFORM_READY",
          severity: "pass",
          source: "platform",
        },
        {
          code: "MISSION_PILOT_READY",
          severity: "pass",
          source: "pilot",
        },
        {
          code: "MISSION_RISK_FAILED",
          severity: "fail",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_HIGH"],
        },
      ],
      missionRisk: {
        missionId,
        result: "fail",
        score: 19,
        riskBand: "high",
      },
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    })).toEqual(before);
  });

  it("fails explicitly when mission risk inputs are missing", async () => {
    const platform = await createPlatform({
      name: "Ready UAV",
      status: "active",
    });
    const pilot = await createReadyPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    });

    const response = await request(app).get(`/missions/${missionId}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      result: "fail",
      reasons: [
        {
          code: "MISSION_PLATFORM_READY",
          severity: "pass",
          source: "platform",
        },
        {
          code: "MISSION_PILOT_READY",
          severity: "pass",
          source: "pilot",
        },
        {
          code: "MISSION_RISK_FAILED",
          severity: "fail",
          source: "risk",
          relatedRiskReasonCodes: ["MISSION_RISK_MISSING"],
        },
      ],
      missionRisk: {
        missionId,
        result: "fail",
        score: null,
        riskBand: null,
        input: null,
      },
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
    })).toEqual(before);
  });
});
