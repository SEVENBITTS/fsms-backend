import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from mission_risk_inputs");
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
};

const insertMission = async (missionId = randomUUID()) => {
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
    [missionId, "submitted", "plan-1", 0],
  );

  return missionId;
};

const countRows = async (missionId: string) => {
  const result = await pool.query(
    `
    select
      (select status from missions where id = $1) as mission_status,
      (select last_event_sequence_no from missions where id = $1) as mission_sequence,
      (select count(*)::int from mission_events where mission_id = $1) as mission_event_count,
      (select count(*)::int from mission_risk_inputs where mission_id = $1) as risk_input_count
    `,
    [missionId],
  );

  return result.rows[0] as {
    mission_status: string;
    mission_sequence: number;
    mission_event_count: number;
    risk_input_count: number;
  };
};

describe("mission risk integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("passes risk assessment for low mission risk inputs", async () => {
    const missionId = await insertMission();

    const createResponse = await request(app)
      .post(`/missions/${missionId}/risk-inputs`)
      .send({
        operatingCategory: "open",
        missionComplexity: "low",
        populationExposure: "low",
        airspaceComplexity: "low",
        weatherRisk: "low",
        payloadRisk: "low",
        mitigationSummary: "Standard mitigations in place",
      });

    expect(createResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(`/missions/${missionId}/risk`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      result: "pass",
      score: 5,
      riskBand: "low",
      reasons: [
        {
          code: "MISSION_RISK_ACCEPTABLE",
          severity: "pass",
        },
      ],
      input: {
        missionId,
        operatingCategory: "open",
        missionComplexity: "low",
      },
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("warns risk assessment for moderate mission risk inputs", async () => {
    const missionId = await insertMission();

    await request(app).post(`/missions/${missionId}/risk-inputs`).send({
      operatingCategory: "specific",
      missionComplexity: "medium",
      populationExposure: "medium",
      airspaceComplexity: "medium",
      weatherRisk: "medium",
      payloadRisk: "low",
    });

    const response = await request(app).get(`/missions/${missionId}/risk`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      result: "warning",
      score: 11,
      riskBand: "moderate",
      reasons: [
        {
          code: "MISSION_RISK_ELEVATED",
          severity: "warning",
        },
      ],
    });
  });

  it("fails risk assessment for high mission risk inputs", async () => {
    const missionId = await insertMission();

    await request(app).post(`/missions/${missionId}/risk-inputs`).send({
      operatingCategory: "certified",
      missionComplexity: "high",
      populationExposure: "high",
      airspaceComplexity: "high",
      weatherRisk: "high",
      payloadRisk: "high",
    });

    const response = await request(app).get(`/missions/${missionId}/risk`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      result: "fail",
      score: 19,
      riskBand: "high",
      reasons: [
        {
          code: "MISSION_RISK_HIGH",
          severity: "fail",
        },
      ],
    });
  });

  it("fails explicitly when mission risk inputs are missing", async () => {
    const missionId = await insertMission();
    const before = await countRows(missionId);

    const response = await request(app).get(`/missions/${missionId}/risk`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      result: "fail",
      score: null,
      riskBand: null,
      reasons: [
        {
          code: "MISSION_RISK_MISSING",
          severity: "fail",
        },
      ],
      input: null,
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("returns not found for unknown missions", async () => {
    const response = await request(app).get(
      "/missions/7a2ed2c4-e238-4743-aa60-5bcd5a50d7b7/risk",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
  });
});
