import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearPilotTables = async () => {
  await pool.query("delete from missions");
  await pool.query("delete from pilot_readiness_evidence");
  await pool.query("delete from pilots");
};

const createPilot = async (params: {
  displayName: string;
  status?: string;
}) => {
  const response = await request(app).post("/pilots").send(params);
  expect(response.status).toBe(201);
  return response.body.pilot as { id: string };
};

const countPilotRows = async (pilotId: string) => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from pilots where id = $1) as pilot_count,
      (select count(*)::int from pilot_readiness_evidence where pilot_id = $1) as evidence_count
    `,
    [pilotId],
  );

  return result.rows[0] as {
    pilot_count: number;
    evidence_count: number;
  };
};

describe("pilot readiness integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearPilotTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("passes readiness for an active pilot with current evidence", async () => {
    const pilot = await createPilot({
      displayName: "Ready Pilot",
      status: "active",
    });

    const evidenceResponse = await request(app)
      .post(`/pilots/${pilot.id}/readiness-evidence`)
      .send({
        evidenceType: "operator_authorisation",
        title: "Current operator authorisation",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

    expect(evidenceResponse.status).toBe(201);
    const evidenceId = evidenceResponse.body.evidence.id;
    const before = await countPilotRows(pilot.id);

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "pass",
      reasons: [
        {
          code: "PILOT_ACTIVE",
          severity: "pass",
          relatedEvidenceIds: [evidenceId],
        },
      ],
    });
    expect(response.body.readinessStatus.currentEvidence).toHaveLength(1);
    expect(await countPilotRows(pilot.id)).toEqual(before);
  });

  it("fails readiness for an active pilot with no current evidence", async () => {
    const pilot = await createPilot({
      displayName: "No Evidence Pilot",
      status: "active",
    });
    const before = await countPilotRows(pilot.id);

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "fail",
      reasons: [
        {
          code: "PILOT_EVIDENCE_MISSING",
          severity: "fail",
        },
      ],
    });
    expect(await countPilotRows(pilot.id)).toEqual(before);
  });

  it("fails readiness for expired pilot evidence", async () => {
    const pilot = await createPilot({
      displayName: "Expired Pilot",
      status: "active",
    });

    const evidenceResponse = await request(app)
      .post(`/pilots/${pilot.id}/readiness-evidence`)
      .send({
        evidenceType: "operator_authorisation",
        title: "Expired operator authorisation",
        expiresAt: "2020-01-01T00:00:00.000Z",
      });

    expect(evidenceResponse.status).toBe(201);
    const evidenceId = evidenceResponse.body.evidence.id;

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("fail");
    expect(response.body.reasons).toContainEqual({
      code: "PILOT_EVIDENCE_MISSING",
      severity: "fail",
      message: "Pilot has no current readiness evidence",
    });
    expect(response.body.reasons).toContainEqual({
      code: "PILOT_EVIDENCE_EXPIRED",
      severity: "fail",
      message: "Pilot has expired readiness evidence",
      relatedEvidenceIds: [evidenceId],
    });
  });

  it("warns readiness for an inactive pilot with current evidence", async () => {
    const pilot = await createPilot({
      displayName: "Inactive Pilot",
      status: "inactive",
    });

    await request(app)
      .post(`/pilots/${pilot.id}/readiness-evidence`)
      .send({
        evidenceType: "operator_authorisation",
        title: "Current operator authorisation",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "warning",
      reasons: [
        {
          code: "PILOT_INACTIVE",
          severity: "warning",
        },
      ],
    });
  });

  it.each([
    {
      status: "suspended",
      code: "PILOT_SUSPENDED",
    },
    {
      status: "retired",
      code: "PILOT_RETIRED",
    },
  ])("fails readiness for a $status pilot", async ({ status, code }) => {
    const pilot = await createPilot({
      displayName: `${status} Pilot`,
      status,
    });

    const response = await request(app).get(`/pilots/${pilot.id}/readiness`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pilotId: pilot.id,
      result: "fail",
      reasons: [
        {
          code,
          severity: "fail",
        },
      ],
    });
  });

  it("returns not found for unknown pilots", async () => {
    const response = await request(app).get(
      "/pilots/7a2ed2c4-e238-4743-aa60-5bcd5a50d7b7/readiness",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "pilot_not_found",
      },
    });
  });
});
