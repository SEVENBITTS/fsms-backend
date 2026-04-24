import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const insertMission = async (id: string = randomUUID()) => {
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
    [id, "active", "plan-1", 0],
  );

  return id;
};

const clearTables = async () => {
  await pool.query("delete from alerts");
  await pool.query("delete from mission_telemetry");
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
};

const amendmentBody = {
  sourceDocument: "CAP 722",
  previousVersion: "9.2",
  currentVersion: "9.3",
  publishedAt: "2026-04-20T09:00:00Z",
  effectiveFrom: "2026-05-01T00:00:00Z",
  amendmentSummary: "Updated UAS operating guidance",
  changeImpact: "Review airspace planning and operating safety case evidence",
  affectedRequirementRefs: ["CAP722:2.1", "CAP722A:OSC"],
  reviewAction: "Compliance owner to assess affected controls before dispatch",
};

describe("alert API", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("records a regulatory amendment alert for a mission", async () => {
    const missionId = await insertMission();

    const response = await request(app)
      .post(`/missions/${missionId}/regulatory-amendments`)
      .send(amendmentBody);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      missionId,
      duplicate: false,
      alerts: [
        {
          missionId,
          alertType: "REGULATORY_AMENDMENT",
          severity: "warning",
          source: "regulatory",
          metadata: {
            sourceDocument: "CAP 722",
            previousVersion: "9.2",
            currentVersion: "9.3",
            changeImpact:
              "Review airspace planning and operating safety case evidence",
            reviewAction:
              "Compliance owner to assess affected controls before dispatch",
          },
        },
      ],
    });
  });

  it("does not duplicate the same open regulatory amendment alert", async () => {
    const missionId = await insertMission();

    await request(app)
      .post(`/missions/${missionId}/regulatory-amendments`)
      .send(amendmentBody);

    const duplicate = await request(app)
      .post(`/missions/${missionId}/regulatory-amendments`)
      .send(amendmentBody);

    expect(duplicate.status).toBe(200);
    expect(duplicate.body).toEqual({
      missionId,
      duplicate: true,
      alerts: [],
    });

    const alerts = await request(app).get(`/missions/${missionId}/alerts`);

    expect(alerts.status).toBe(200);
    expect(alerts.body.alerts).toHaveLength(1);
  });

  it("rejects incomplete regulatory amendment requests", async () => {
    const missionId = await insertMission();

    const response = await request(app)
      .post(`/missions/${missionId}/regulatory-amendments`)
      .send({
        ...amendmentBody,
        changeImpact: "",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        type: "alert_validation_failed",
      },
    });
  });

  it("returns not found for regulatory amendments on unknown missions", async () => {
    const response = await request(app)
      .post(`/missions/${randomUUID()}/regulatory-amendments`)
      .send(amendmentBody);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "mission_not_found",
      },
    });
  });
});
