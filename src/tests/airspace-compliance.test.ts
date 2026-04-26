import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from airspace_compliance_inputs");
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
      (select count(*)::int from airspace_compliance_inputs where mission_id = $1) as airspace_input_count
    `,
    [missionId],
  );

  return result.rows[0] as {
    mission_status: string;
    mission_sequence: number;
    mission_event_count: number;
    airspace_input_count: number;
  };
};

describe("airspace compliance integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("passes compliance for clear airspace inputs", async () => {
    const missionId = await insertMission();

    const createResponse = await request(app)
      .post(`/missions/${missionId}/airspace-inputs`)
      .send({
        airspaceClass: "g",
        maxAltitudeFt: 300,
        restrictionStatus: "clear",
        permissionStatus: "not_required",
      });

    expect(createResponse.status).toBe(201);
    const before = await countRows(missionId);

    const response = await request(app).get(`/missions/${missionId}/airspace`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      result: "pass",
      reasons: [
        {
          code: "AIRSPACE_CLEAR",
          severity: "pass",
        },
      ],
      input: {
        missionId,
        airspaceClass: "g",
        maxAltitudeFt: 300,
      },
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("warns compliance for pending permission and controlled airspace", async () => {
    const missionId = await insertMission();

    await request(app).post(`/missions/${missionId}/airspace-inputs`).send({
      airspaceClass: "d",
      maxAltitudeFt: 350,
      restrictionStatus: "permission_required",
      permissionStatus: "pending",
      controlledAirspace: true,
    });

    const response = await request(app).get(`/missions/${missionId}/airspace`);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("warning");
    expect(response.body.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "AIRSPACE_PERMISSION_PENDING",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "AIRSPACE_PERMISSION_REQUIRED",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "AIRSPACE_CONTROLLED",
          severity: "warning",
        }),
      ]),
    );
  });

  it("fails compliance for prohibited airspace", async () => {
    const missionId = await insertMission();

    await request(app).post(`/missions/${missionId}/airspace-inputs`).send({
      airspaceClass: "d",
      maxAltitudeFt: 300,
      restrictionStatus: "prohibited",
      permissionStatus: "denied",
    });

    const response = await request(app).get(`/missions/${missionId}/airspace`);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("fail");
    expect(response.body.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "AIRSPACE_PROHIBITED",
          severity: "fail",
        }),
        expect.objectContaining({
          code: "AIRSPACE_PERMISSION_DENIED",
          severity: "fail",
        }),
      ]),
    );
  });

  it("fails explicitly when airspace compliance inputs are missing", async () => {
    const missionId = await insertMission();
    const before = await countRows(missionId);

    const response = await request(app).get(`/missions/${missionId}/airspace`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      result: "fail",
      reasons: [
        {
          code: "AIRSPACE_INPUT_MISSING",
          severity: "fail",
        },
      ],
      input: null,
    });
    expect(await countRows(missionId)).toEqual(before);
  });

  it("returns not found for unknown missions", async () => {
    const response = await request(app).get(
      "/missions/7a2ed2c4-e238-4743-aa60-5bcd5a50d7b7/airspace",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
  });
});
