import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from mission_decision_evidence_links");
  await pool.query("delete from audit_evidence_snapshots");
  await pool.query("delete from airspace_compliance_inputs");
  await pool.query("delete from mission_risk_inputs");
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
  await pool.query("delete from pilot_readiness_evidence");
  await pool.query("delete from pilots");
  await pool.query("delete from maintenance_records");
  await pool.query("delete from maintenance_schedules");
  await pool.query("delete from platforms");
};

const createPlatform = async () => {
  const response = await request(app).post("/platforms").send({
    name: "Planning UAV",
    status: "active",
  });

  expect(response.status).toBe(201);
  return response.body.platform as { id: string };
};

const createPilot = async () => {
  const response = await request(app).post("/pilots").send({
    displayName: "Planning Pilot",
    status: "active",
  });

  expect(response.status).toBe(201);
  return response.body.pilot as { id: string };
};

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

const countRows = async (missionId?: string) => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from missions where ($1::uuid is null or id = $1)) as mission_count,
      (select count(*)::int from mission_events where ($1::uuid is null or mission_id = $1)) as mission_event_count,
      (select count(*)::int from mission_risk_inputs where ($1::uuid is null or mission_id = $1)) as risk_input_count,
      (select count(*)::int from airspace_compliance_inputs where ($1::uuid is null or mission_id = $1)) as airspace_input_count,
      (select count(*)::int from audit_evidence_snapshots where ($1::uuid is null or mission_id = $1)) as snapshot_count,
      (select count(*)::int from mission_decision_evidence_links where ($1::uuid is null or mission_id = $1)) as decision_link_count
    `,
    [missionId ?? null],
  );

  return result.rows[0] as {
    mission_count: number;
    mission_event_count: number;
    risk_input_count: number;
    airspace_input_count: number;
    snapshot_count: number;
    decision_link_count: number;
  };
};

describe("mission planning drafts", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a draft mission with missing planning placeholders", async () => {
    const before = await countRows();

    const response = await request(app).post("/mission-plans/drafts").send({});

    expect(response.status).toBe(201);
    expect(response.body.draft).toMatchObject({
      missionPlanId: null,
      status: "draft",
      platformId: null,
      pilotId: null,
      placeholders: {
        platformAssigned: false,
        pilotAssigned: false,
        riskInputPresent: false,
        airspaceInputPresent: false,
      },
      readinessCheckAvailable: false,
      checklist: [
        { key: "platform", status: "missing" },
        { key: "pilot", status: "missing" },
        { key: "risk", status: "missing" },
        { key: "airspace", status: "missing" },
      ],
    });
    expect(response.body.draft.missionId).toEqual(expect.any(String));

    const after = await countRows(response.body.draft.missionId);
    expect(after).toEqual({
      mission_count: 1,
      mission_event_count: 0,
      risk_input_count: 0,
      airspace_input_count: 0,
      snapshot_count: 0,
      decision_link_count: 0,
    });
    expect((await countRows()).mission_count).toBe(before.mission_count + 1);
  });

  it("creates a draft mission with platform and pilot assignments", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();

    const response = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-alpha",
      platformId: platform.id,
      pilotId: pilot.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.draft).toMatchObject({
      missionPlanId: "plan-alpha",
      status: "draft",
      platformId: platform.id,
      pilotId: pilot.id,
      placeholders: {
        platformAssigned: true,
        pilotAssigned: true,
        riskInputPresent: false,
        airspaceInputPresent: false,
      },
      readinessCheckAvailable: false,
      checklist: [
        { key: "platform", status: "present" },
        { key: "pilot", status: "present" },
        { key: "risk", status: "missing" },
        { key: "airspace", status: "missing" },
      ],
    });
  });

  it("creates a draft mission with risk and airspace placeholders", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();

    const response = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-complete",
      platformId: platform.id,
      pilotId: pilot.id,
      riskInput: lowRiskInput,
      airspaceInput: clearAirspaceInput,
    });

    expect(response.status).toBe(201);
    expect(response.body.draft).toMatchObject({
      missionPlanId: "plan-complete",
      platformId: platform.id,
      pilotId: pilot.id,
      placeholders: {
        platformAssigned: true,
        pilotAssigned: true,
        riskInputPresent: true,
        airspaceInputPresent: true,
      },
      readinessCheckAvailable: true,
      checklist: [
        { key: "platform", status: "present" },
        { key: "pilot", status: "present" },
        { key: "risk", status: "present" },
        { key: "airspace", status: "present" },
      ],
    });

    expect(await countRows(response.body.draft.missionId)).toEqual({
      mission_count: 1,
      mission_event_count: 0,
      risk_input_count: 1,
      airspace_input_count: 1,
      snapshot_count: 0,
      decision_link_count: 0,
    });
  });

  it("returns an existing planning draft by mission id", async () => {
    const createResponse = await request(app).post("/mission-plans/drafts").send({
      missionPlanId: "plan-lookup",
      riskInput: lowRiskInput,
    });

    expect(createResponse.status).toBe(201);

    const getResponse = await request(app).get(
      `/mission-plans/drafts/${createResponse.body.draft.missionId}`,
    );

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.draft).toEqual(createResponse.body.draft);
  });

  it("rejects unknown platform and pilot placeholders", async () => {
    const platformResponse = await request(app).post("/mission-plans/drafts").send({
      platformId: randomUUID(),
    });
    const pilotResponse = await request(app).post("/mission-plans/drafts").send({
      pilotId: randomUUID(),
    });

    expect(platformResponse.status).toBe(404);
    expect(platformResponse.body).toMatchObject({
      error: {
        type: "mission_planning_reference_not_found",
      },
    });
    expect(pilotResponse.status).toBe(404);
    expect(pilotResponse.body).toMatchObject({
      error: {
        type: "mission_planning_reference_not_found",
      },
    });
    expect(await countRows()).toMatchObject({
      mission_count: 0,
      snapshot_count: 0,
      decision_link_count: 0,
    });
  });

  it("returns 404 for missing or non-draft missions", async () => {
    const missingResponse = await request(app).get(
      `/mission-plans/drafts/${randomUUID()}`,
    );
    const missionId = randomUUID();

    await pool.query(
      `
      insert into missions (
        id,
        status,
        mission_plan_id,
        last_event_sequence_no
      )
      values ($1, 'submitted', 'submitted-plan', 0)
      `,
      [missionId],
    );

    const submittedResponse = await request(app).get(
      `/mission-plans/drafts/${missionId}`,
    );

    expect(missingResponse.status).toBe(404);
    expect(submittedResponse.status).toBe(404);
  });
});
