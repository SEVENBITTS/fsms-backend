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

  it("summarizes regulatory matrix rows impacted by open amendment alerts", async () => {
    const missionId = await insertMission();

    await request(app)
      .post(`/missions/${missionId}/regulatory-amendments`)
      .send(amendmentBody);

    const response = await request(app).get(
      `/missions/${missionId}/regulatory-review-impact`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      missionId,
      openAmendmentAlertCount: 1,
      impactedMappingCount: 4,
      needsClauseReviewCount: 4,
    });
    expect(
      response.body.impactedMappings.map(
        (item: { mapping: { requirementCode: string } }) =>
          item.mapping.requirementCode,
      ),
    ).toEqual([
      "REG_UAS_OPERATING_SOURCE_BASIS",
      "REG_AIRSPACE_PERMISSION_EVIDENCE",
      "REG_OPERATING_SAFETY_CASE_CONTEXT",
      "REG_POST_OPERATION_RECORDS",
    ]);
    expect(response.body.impactedMappings[0]).toMatchObject({
      reviewReason:
        "Open regulatory amendment matches this source mapping or affected reference context.",
    });
  });

  it("returns an empty regulatory review impact summary when no amendment alerts are open", async () => {
    const missionId = await insertMission();

    const response = await request(app).get(
      `/missions/${missionId}/regulatory-review-impact`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      missionId,
      openAmendmentAlertCount: 0,
      impactedMappingCount: 0,
      needsClauseReviewCount: 0,
      impactedMappings: [],
    });
  });

  it("acknowledges and resolves an alert for the owning mission", async () => {
    const missionId = await insertMission();

    const created = await request(app)
      .post(`/missions/${missionId}/regulatory-amendments`)
      .send(amendmentBody);
    const alertId = created.body.alerts[0].id;

    const acknowledged = await request(app)
      .post(`/missions/${missionId}/alerts/${alertId}/acknowledge`)
      .send({ acknowledgedAt: "2026-04-20T10:00:00Z" });

    expect(acknowledged.status).toBe(200);
    expect(acknowledged.body).toMatchObject({
      missionId,
      alert: {
        id: alertId,
        status: "acknowledged",
        acknowledgedAt: "2026-04-20T10:00:00.000Z",
      },
    });

    const resolved = await request(app)
      .post(`/missions/${missionId}/alerts/${alertId}/resolve`)
      .send({ resolvedAt: "2026-04-20T11:00:00Z" });

    expect(resolved.status).toBe(200);
    expect(resolved.body).toMatchObject({
      missionId,
      alert: {
        id: alertId,
        status: "resolved",
        resolvedAt: "2026-04-20T11:00:00.000Z",
      },
    });
  });

  it("rejects alert lifecycle actions for another mission", async () => {
    const owningMissionId = await insertMission();
    const otherMissionId = await insertMission();

    const created = await request(app)
      .post(`/missions/${owningMissionId}/regulatory-amendments`)
      .send(amendmentBody);
    const alertId = created.body.alerts[0].id;

    const response = await request(app)
      .post(`/missions/${otherMissionId}/alerts/${alertId}/acknowledge`)
      .send({ acknowledgedAt: "2026-04-20T10:00:00Z" });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        type: "alert_not_found",
      },
    });
  });

  it("rejects invalid alert lifecycle timestamps", async () => {
    const missionId = await insertMission();

    const created = await request(app)
      .post(`/missions/${missionId}/regulatory-amendments`)
      .send(amendmentBody);
    const alertId = created.body.alerts[0].id;

    const response = await request(app)
      .post(`/missions/${missionId}/alerts/${alertId}/resolve`)
      .send({ resolvedAt: "not-a-date" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        type: "alert_validation_failed",
      },
    });
  });
});
