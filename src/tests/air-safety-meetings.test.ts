import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from safety_action_implementation_evidence");
  await pool.query("delete from safety_action_decisions");
  await pool.query("delete from safety_action_proposals");
  await pool.query("delete from safety_event_agenda_links");
  await pool.query("delete from safety_event_meeting_triggers");
  await pool.query("delete from safety_events");
  await pool.query("delete from air_safety_meetings");
};

const createCompletedQuarterlyMeeting = async (heldAt: string) => {
  const response = await request(app).post("/air-safety-meetings").send({
    meetingType: "quarterly_air_safety_review",
    dueAt: heldAt,
    heldAt,
    status: "completed",
    chairperson: "Head of Flight Safety",
    attendees: ["Accountable Manager", "Chief Pilot"],
    agenda: ["Review safety events", "Review open safety actions"],
    minutes: "Quarterly review completed.",
    createdBy: "safety-admin",
  });

  expect(response.status).toBe(201);
  return response.body.meeting;
};

describe("air safety meetings", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates and lists quarterly air safety meeting records", async () => {
    const response = await request(app).post("/air-safety-meetings").send({
      dueAt: "2026-06-30T10:00:00.000Z",
      scheduledPeriodStart: "2026-04-01",
      scheduledPeriodEnd: "2026-06-30",
      chairperson: " Safety Manager ",
      attendees: [" Accountable Manager ", "Chief Pilot", ""],
      agenda: ["Review SOP breaches", "Training needs"],
      createdBy: " safety-admin ",
    });

    expect(response.status).toBe(201);
    expect(response.body.meeting).toMatchObject({
      meetingType: "quarterly_air_safety_review",
      scheduledPeriodStart: "2026-04-01",
      scheduledPeriodEnd: "2026-06-30",
      dueAt: "2026-06-30T10:00:00.000Z",
      heldAt: null,
      status: "scheduled",
      chairperson: "Safety Manager",
      attendees: ["Accountable Manager", "Chief Pilot"],
      agenda: ["Review SOP breaches", "Training needs"],
      createdBy: "safety-admin",
    });
    expect(response.body.meeting.id).toEqual(expect.any(String));
    expect(response.body.meeting.createdAt).toEqual(expect.any(String));

    const listResponse = await request(app).get("/air-safety-meetings");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meetings).toHaveLength(1);
    expect(listResponse.body.meetings[0]).toEqual(response.body.meeting);
  });

  it("reports overdue quarterly compliance when no completed quarterly meeting exists", async () => {
    const response = await request(app).get(
      "/air-safety-meetings/quarterly-compliance?asOf=2026-04-01T00:00:00.000Z",
    );

    expect(response.status).toBe(200);
    expect(response.body.compliance).toMatchObject({
      status: "overdue",
      requirement: "quarterly_air_safety_meeting",
      requirementMonths: 3,
      dueSoonWindowDays: 30,
      asOf: "2026-04-01T00:00:00.000Z",
      lastCompletedMeeting: null,
      nextDueAt: null,
    });
  });

  it("reports compliant quarterly status when the next review is more than 30 days away", async () => {
    const meeting = await createCompletedQuarterlyMeeting(
      "2026-01-01T10:00:00.000Z",
    );

    const response = await request(app).get(
      "/air-safety-meetings/quarterly-compliance?asOf=2026-02-01T10:00:00.000Z",
    );

    expect(response.status).toBe(200);
    expect(response.body.compliance).toMatchObject({
      status: "compliant",
      lastCompletedMeeting: {
        id: meeting.id,
        meetingType: "quarterly_air_safety_review",
        status: "completed",
      },
      nextDueAt: "2026-04-01T10:00:00.000Z",
    });
  });

  it("reports due soon when the next quarterly review is within 30 days", async () => {
    await createCompletedQuarterlyMeeting("2026-01-01T10:00:00.000Z");

    const response = await request(app).get(
      "/air-safety-meetings/quarterly-compliance?asOf=2026-03-10T10:00:00.000Z",
    );

    expect(response.status).toBe(200);
    expect(response.body.compliance).toMatchObject({
      status: "due_soon",
      nextDueAt: "2026-04-01T10:00:00.000Z",
    });
  });

  it("reports overdue when the latest quarterly review is older than 3 months", async () => {
    await createCompletedQuarterlyMeeting("2026-01-01T10:00:00.000Z");

    const response = await request(app).get(
      "/air-safety-meetings/quarterly-compliance?asOf=2026-04-02T10:00:00.000Z",
    );

    expect(response.status).toBe(200);
    expect(response.body.compliance).toMatchObject({
      status: "overdue",
      nextDueAt: "2026-04-01T10:00:00.000Z",
    });
  });

  it("does not allow event-triggered meetings to automatically satisfy quarterly compliance", async () => {
    const eventMeeting = await request(app).post("/air-safety-meetings").send({
      meetingType: "event_triggered_safety_review",
      dueAt: "2026-03-20T09:00:00.000Z",
      heldAt: "2026-03-20T09:00:00.000Z",
      status: "completed",
      chairperson: "Safety Manager",
      agenda: ["SOP breach review"],
      minutes: "Event review held.",
    });

    expect(eventMeeting.status).toBe(201);

    const response = await request(app).get(
      "/air-safety-meetings/quarterly-compliance?asOf=2026-03-21T00:00:00.000Z",
    );

    expect(response.status).toBe(200);
    expect(response.body.compliance).toMatchObject({
      status: "overdue",
      lastCompletedMeeting: null,
      nextDueAt: null,
    });
  });

  it("rejects invalid air safety meeting records", async () => {
    const completedWithoutHeldAt = await request(app)
      .post("/air-safety-meetings")
      .send({
        dueAt: "2026-06-30T10:00:00.000Z",
        status: "completed",
      });
    const unsupportedType = await request(app)
      .post("/air-safety-meetings")
      .send({
        meetingType: "daily_standup",
        dueAt: "2026-06-30T10:00:00.000Z",
      });
    const invalidQuery = await request(app).get(
      "/air-safety-meetings/quarterly-compliance?asOf=not-a-date",
    );

    expect(completedWithoutHeldAt.status).toBe(400);
    expect(completedWithoutHeldAt.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
    expect(unsupportedType.status).toBe(400);
    expect(unsupportedType.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
    expect(invalidQuery.status).toBe(400);
    expect(invalidQuery.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
  });
});
