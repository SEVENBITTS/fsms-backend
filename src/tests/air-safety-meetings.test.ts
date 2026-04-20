import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";
import { randomUUID } from "crypto";

const parseBinaryResponse = (
  res: NodeJS.ReadableStream,
  callback: (error: Error | null, body?: Buffer) => void,
) => {
  const chunks: Buffer[] = [];

  res.on("data", (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  res.on("end", () => callback(null, Buffer.concat(chunks)));
  res.on("error", (error) => callback(error));
};

const clearTables = async () => {
  await pool.query("delete from air_safety_meeting_signoffs");
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

const countRows = async () => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from air_safety_meetings) as meeting_count,
      (select count(*)::int from air_safety_meeting_signoffs) as signoff_count,
      (select count(*)::int from safety_events) as safety_event_count,
      (select count(*)::int from safety_event_meeting_triggers) as trigger_count,
      (select count(*)::int from safety_event_agenda_links) as agenda_link_count,
      (select count(*)::int from safety_action_proposals) as proposal_count,
      (select count(*)::int from safety_action_decisions) as decision_count,
      (select count(*)::int from safety_action_implementation_evidence) as implementation_evidence_count
    `,
  );

  return result.rows[0] as {
    meeting_count: number;
    signoff_count: number;
    safety_event_count: number;
    trigger_count: number;
    agenda_link_count: number;
    proposal_count: number;
    decision_count: number;
    implementation_evidence_count: number;
  };
};

const createEventTriggeredMeeting = async () => {
  const response = await request(app).post("/air-safety-meetings").send({
    meetingType: "event_triggered_safety_review",
    dueAt: "2026-04-20T10:00:00.000Z",
    chairperson: "Safety Manager",
    attendees: ["Accountable Manager", "Chief Pilot"],
    agenda: ["Review safety events", "Review action closure"],
    createdBy: "safety-admin",
  });

  expect(response.status).toBe(201);
  return response.body.meeting as { id: string };
};

const createMeetingSignoff = async (
  meetingId: string,
  overrides?: {
    accountableManagerName?: string;
    accountableManagerRole?: string;
    reviewDecision?: string;
    signedAt?: string;
    signatureReference?: string | null;
    reviewNotes?: string | null;
    createdBy?: string | null;
  },
) => {
  const response = await request(app)
    .post(`/air-safety-meetings/${meetingId}/signoffs`)
    .send({
      accountableManagerName:
        overrides?.accountableManagerName ?? "Alex Morgan",
      accountableManagerRole:
        overrides?.accountableManagerRole ?? "Accountable Manager",
      reviewDecision: overrides?.reviewDecision ?? "approved",
      signedAt: overrides?.signedAt ?? "2026-04-20T17:00:00.000Z",
      signatureReference:
        overrides?.signatureReference ??
        "signature://accountable-manager/alex-morgan",
      reviewNotes:
        overrides?.reviewNotes ?? "Meeting pack reviewed and approved.",
      createdBy: overrides?.createdBy ?? "safety-admin",
    });

  expect(response.status).toBe(201);
  return response.body.signoff;
};

const createAgendaLinkedEvent = async (
  meetingId: string,
  params?: {
    eventType?: string;
    severity?: string;
    summary?: string;
    agendaItem?: string;
  },
) => {
  const eventResponse = await request(app).post("/safety-events").send({
    eventType: params?.eventType ?? "sop_breach",
    severity: params?.severity ?? "high",
    eventOccurredAt: "2026-04-19T09:00:00.000Z",
    reportedBy: "safety-manager",
    summary: params?.summary ?? "Safety event for meeting pack",
    sopReference: "OPS-SOP-LAUNCH-001",
  });

  expect(eventResponse.status).toBe(201);

  const triggerResponse = await request(app)
    .post(`/safety-events/${eventResponse.body.event.id}/meeting-trigger`)
    .send({
      assessedBy: "safety-manager",
    });

  expect(triggerResponse.status).toBe(201);

  const agendaLinkResponse = await request(app)
    .post(`/safety-events/${eventResponse.body.event.id}/meeting-triggers/${triggerResponse.body.trigger.id}/agenda-links`)
    .send({
      airSafetyMeetingId: meetingId,
      agendaItem: params?.agendaItem ?? "Review safety action",
      linkedBy: "safety-coordinator",
    });

  expect(agendaLinkResponse.status).toBe(201);

  return {
    event: eventResponse.body.event,
    trigger: triggerResponse.body.trigger,
    agendaLink: agendaLinkResponse.body.link,
  };
};

const createCompletedActionWithEvidence = async (
  meetingId: string,
  params?: {
    eventType?: string;
    proposalType?: string;
    evidenceCategory?: string;
    implementationSummary?: string;
  },
) => {
  const source = await createAgendaLinkedEvent(meetingId, {
    eventType: params?.eventType ?? "sop_breach",
    agendaItem: "Review completed action evidence",
  });

  const proposalResponse = await request(app)
    .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals`)
    .send({
      proposalType: params?.proposalType ?? "sop_change",
      summary: "Update safety procedure",
      rationale: "Meeting review identified required follow-up.",
      proposedOwner: "Safety Manager",
      proposedDueAt: "2026-05-01T10:00:00.000Z",
      createdBy: "safety-manager",
    });

  expect(proposalResponse.status).toBe(201);

  const acceptResponse = await request(app)
    .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${proposalResponse.body.proposal.id}/decisions`)
    .send({
      decision: "accepted",
      decidedBy: "accountable-manager",
      decisionNotes: "Accepted for implementation.",
    });

  expect(acceptResponse.status).toBe(201);

  const completeResponse = await request(app)
    .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${proposalResponse.body.proposal.id}/decisions`)
    .send({
      decision: "completed",
      decidedBy: "safety-manager",
      decisionNotes: "Action completed.",
    });

  expect(completeResponse.status).toBe(201);

  const evidenceResponse = await request(app)
    .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${proposalResponse.body.proposal.id}/implementation-evidence`)
    .send({
      evidenceCategory: params?.evidenceCategory ?? "sop_implementation",
      implementationSummary:
        params?.implementationSummary ?? "Procedure update completed",
      evidenceReference: "DOC-SAFETY-001",
      completedBy: "safety-manager",
      completedAt: "2026-05-02T09:00:00.000Z",
      reviewedBy: "accountable-manager",
      reviewNotes: "Closure evidence reviewed.",
    });

  expect(evidenceResponse.status).toBe(201);

  return {
    ...source,
    proposal: completeResponse.body.proposal,
    acceptDecision: acceptResponse.body.decision,
    completeDecision: completeResponse.body.decision,
    implementationEvidence: evidenceResponse.body.evidence,
  };
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

  it("creates and lists stored air safety meeting sign-offs without mutating linked records", async () => {
    const meeting = await createEventTriggeredMeeting();
    const before = await countRows();

    const signoff = await createMeetingSignoff(meeting.id);

    expect(signoff).toMatchObject({
      airSafetyMeetingId: meeting.id,
      accountableManagerName: "Alex Morgan",
      accountableManagerRole: "Accountable Manager",
      reviewDecision: "approved",
      signedAt: "2026-04-20T17:00:00.000Z",
      signatureReference: "signature://accountable-manager/alex-morgan",
      reviewNotes: "Meeting pack reviewed and approved.",
      createdBy: "safety-admin",
    });
    expect(signoff.id).toEqual(expect.any(String));
    expect(signoff.createdAt).toEqual(expect.any(String));

    const listResponse = await request(app).get(
      `/air-safety-meetings/${meeting.id}/signoffs`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.signoffs).toHaveLength(1);
    expect(listResponse.body.signoffs[0]).toEqual(signoff);
    expect(await countRows()).toEqual({
      ...before,
      signoff_count: before.signoff_count + 1,
    });
  });

  it("allows multiple stored sign-offs on the same meeting ordered newest first", async () => {
    const meeting = await createEventTriggeredMeeting();
    const before = await countRows();

    const firstResponse = await request(app)
      .post(`/air-safety-meetings/${meeting.id}/signoffs`)
      .send({
        accountableManagerName: "Alex Morgan",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "requires_follow_up",
        signedAt: "2026-04-20T10:00:00.000Z",
        reviewNotes: "Follow-up required before approval.",
      });
    const secondResponse = await request(app)
      .post(`/air-safety-meetings/${meeting.id}/signoffs`)
      .send({
        accountableManagerName: "Alex Morgan",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-20T12:00:00.000Z",
        signatureReference: "signature://accountable-manager/alex-morgan",
        reviewNotes: "Follow-up completed and approved.",
      });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);

    const listResponse = await request(app).get(
      `/air-safety-meetings/${meeting.id}/signoffs`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.signoffs).toHaveLength(2);
    expect(listResponse.body.signoffs[0].id).toBe(secondResponse.body.signoff.id);
    expect(listResponse.body.signoffs[1].id).toBe(firstResponse.body.signoff.id);
    expect(await countRows()).toEqual({
      ...before,
      signoff_count: before.signoff_count + 2,
    });
  });

  it("does not leak stored air safety meeting sign-offs across meetings", async () => {
    const firstMeeting = await createEventTriggeredMeeting();
    const secondMeeting = await createEventTriggeredMeeting();
    const before = await countRows();

    const secondResponse = await request(app)
      .post(`/air-safety-meetings/${secondMeeting.id}/signoffs`)
      .send({
        accountableManagerName: "Alex Morgan",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-20T17:00:00.000Z",
        reviewNotes: "Second meeting approved.",
      });

    expect(secondResponse.status).toBe(201);

    const listResponse = await request(app).get(
      `/air-safety-meetings/${firstMeeting.id}/signoffs`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.signoffs).toEqual([]);
    expect(await countRows()).toEqual({
      ...before,
      signoff_count: before.signoff_count + 1,
    });
  });

  it("rejects invalid stored air safety meeting sign-off requests", async () => {
    const meeting = await createEventTriggeredMeeting();
    const before = await countRows();
    const endpoint = `/air-safety-meetings/${meeting.id}/signoffs`;

    const missingNameResponse = await request(app).post(endpoint).send({
      accountableManagerRole: "Accountable Manager",
      reviewDecision: "approved",
      signedAt: "2026-04-20T17:00:00.000Z",
    });
    const invalidDecisionResponse = await request(app).post(endpoint).send({
      accountableManagerName: "Alex Morgan",
      accountableManagerRole: "Accountable Manager",
      reviewDecision: "maybe",
      signedAt: "2026-04-20T17:00:00.000Z",
    });
    const invalidDateResponse = await request(app).post(endpoint).send({
      accountableManagerName: "Alex Morgan",
      accountableManagerRole: "Accountable Manager",
      reviewDecision: "approved",
      signedAt: "not-a-date",
    });

    expect(missingNameResponse.status).toBe(400);
    expect(invalidDecisionResponse.status).toBe(400);
    expect(invalidDateResponse.status).toBe(400);
    expect(missingNameResponse.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
    expect(invalidDecisionResponse.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
    expect(invalidDateResponse.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
    expect(await countRows()).toEqual(before);
  });

  it("returns 404 for unknown stored air safety meeting sign-off meetings", async () => {
    const meeting = await createEventTriggeredMeeting();
    const before = await countRows();
    const invalidCreateResponse = await request(app)
      .post("/air-safety-meetings/not-a-uuid/signoffs")
      .send({
        accountableManagerName: "Alex Morgan",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-20T17:00:00.000Z",
      });
    const invalidListResponse = await request(app).get(
      "/air-safety-meetings/not-a-uuid/signoffs",
    );

    const missingCreateResponse = await request(app)
      .post(`/air-safety-meetings/${randomUUID()}/signoffs`)
      .send({
        accountableManagerName: "Alex Morgan",
        accountableManagerRole: "Accountable Manager",
        reviewDecision: "approved",
        signedAt: "2026-04-20T17:00:00.000Z",
      });
    const missingListResponse = await request(app).get(
      `/air-safety-meetings/${randomUUID()}/signoffs`,
    );

    expect(invalidCreateResponse.status).toBe(400);
    expect(invalidListResponse.status).toBe(400);
    expect(missingCreateResponse.status).toBe(404);
    expect(missingListResponse.status).toBe(404);
    expect(invalidCreateResponse.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
    expect(invalidListResponse.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
    expect(missingCreateResponse.body.error).toMatchObject({
      type: "air_safety_meeting_not_found",
    });
    expect(missingListResponse.body.error).toMatchObject({
      type: "air_safety_meeting_not_found",
    });
    expect(await countRows()).toEqual(before);
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

  it("exports an empty safety meeting approval rollup without mutating source records", async () => {
    const before = await countRows();

    const response = await request(app).get(
      "/air-safety-meetings/approval-rollup",
    );

    expect(response.status).toBe(200);
    expect(response.body.export).toMatchObject({
      exportType: "air_safety_meeting_approval_rollup",
      formatVersion: 1,
      records: [],
    });
    expect(response.body.export.generatedAt).toEqual(expect.any(String));
    expect(await countRows()).toEqual(before);
  });

  it("exports governance approval rollup records for approved, rejected, follow-up, and unsigned meetings", async () => {
    const approvedMeeting = await request(app).post("/air-safety-meetings").send({
      meetingType: "event_triggered_safety_review",
      dueAt: "2026-04-24T10:00:00.000Z",
      chairperson: "Safety Manager",
      createdBy: "safety-admin",
    });
    const rejectedMeeting = await request(app).post("/air-safety-meetings").send({
      meetingType: "sop_breach_review",
      dueAt: "2026-04-23T10:00:00.000Z",
      chairperson: "Chief Pilot",
      createdBy: "safety-admin",
    });
    const followUpMeeting = await request(app).post("/air-safety-meetings").send({
      meetingType: "training_review",
      dueAt: "2026-04-22T10:00:00.000Z",
      chairperson: "Training Manager",
      createdBy: "safety-admin",
    });
    const unsignedMeeting = await request(app).post("/air-safety-meetings").send({
      meetingType: "maintenance_safety_review",
      dueAt: "2026-04-21T10:00:00.000Z",
      chairperson: "Engineering Lead",
      createdBy: "safety-admin",
    });

    expect(approvedMeeting.status).toBe(201);
    expect(rejectedMeeting.status).toBe(201);
    expect(followUpMeeting.status).toBe(201);
    expect(unsignedMeeting.status).toBe(201);

    const approvedSignoff = await createMeetingSignoff(approvedMeeting.body.meeting.id, {
      accountableManagerName: "Alex Morgan",
      reviewDecision: "approved",
      signedAt: "2026-04-24T11:00:00.000Z",
      reviewNotes: "Approved for governance closure.",
    });
    const rejectedSignoff = await createMeetingSignoff(rejectedMeeting.body.meeting.id, {
      accountableManagerName: "Jordan Lee",
      reviewDecision: "rejected",
      signedAt: "2026-04-23T11:00:00.000Z",
      signatureReference: null,
      reviewNotes: "Rejected pending corrective action.",
    });
    const followUpSignoff = await createMeetingSignoff(followUpMeeting.body.meeting.id, {
      accountableManagerName: "Taylor Shaw",
      reviewDecision: "requires_follow_up",
      signedAt: "2026-04-22T11:00:00.000Z",
      reviewNotes: "Follow-up review required.",
    });
    const before = await countRows();

    const response = await request(app).get(
      "/air-safety-meetings/approval-rollup",
    );

    expect(response.status).toBe(200);
    expect(response.body.export.records).toEqual([
      {
        meetingId: approvedMeeting.body.meeting.id,
        meetingType: "event_triggered_safety_review",
        meetingStatus: "scheduled",
        dueAt: "2026-04-24T10:00:00.000Z",
        heldAt: null,
        chairperson: "Safety Manager",
        createdAt: approvedMeeting.body.meeting.createdAt,
        latestSignoffApprovalStatus: "approved",
        latestSignoffId: approvedSignoff.id,
        accountableManagerName: "Alex Morgan",
        accountableManagerRole: "Accountable Manager",
        signedAt: "2026-04-24T11:00:00.000Z",
        signatureReference: approvedSignoff.signatureReference,
        reviewNotes: "Approved for governance closure.",
      },
      {
        meetingId: rejectedMeeting.body.meeting.id,
        meetingType: "sop_breach_review",
        meetingStatus: "scheduled",
        dueAt: "2026-04-23T10:00:00.000Z",
        heldAt: null,
        chairperson: "Chief Pilot",
        createdAt: rejectedMeeting.body.meeting.createdAt,
        latestSignoffApprovalStatus: "rejected",
        latestSignoffId: rejectedSignoff.id,
        accountableManagerName: "Jordan Lee",
        accountableManagerRole: "Accountable Manager",
        signedAt: "2026-04-23T11:00:00.000Z",
        signatureReference: rejectedSignoff.signatureReference,
        reviewNotes: "Rejected pending corrective action.",
      },
      {
        meetingId: followUpMeeting.body.meeting.id,
        meetingType: "training_review",
        meetingStatus: "scheduled",
        dueAt: "2026-04-22T10:00:00.000Z",
        heldAt: null,
        chairperson: "Training Manager",
        createdAt: followUpMeeting.body.meeting.createdAt,
        latestSignoffApprovalStatus: "requires_follow_up",
        latestSignoffId: followUpSignoff.id,
        accountableManagerName: "Taylor Shaw",
        accountableManagerRole: "Accountable Manager",
        signedAt: "2026-04-22T11:00:00.000Z",
        signatureReference: followUpSignoff.signatureReference,
        reviewNotes: "Follow-up review required.",
      },
      {
        meetingId: unsignedMeeting.body.meeting.id,
        meetingType: "maintenance_safety_review",
        meetingStatus: "scheduled",
        dueAt: "2026-04-21T10:00:00.000Z",
        heldAt: null,
        chairperson: "Engineering Lead",
        createdAt: unsignedMeeting.body.meeting.createdAt,
        latestSignoffApprovalStatus: "unsigned",
        latestSignoffId: null,
        accountableManagerName: null,
        accountableManagerRole: null,
        signedAt: null,
        signatureReference: null,
        reviewNotes: null,
      },
    ]);
    expect(await countRows()).toEqual(before);
  });

  it("uses the newest sign-off when multiple approvals exist on one meeting", async () => {
    const meeting = await createEventTriggeredMeeting();
    await createMeetingSignoff(meeting.id, {
      reviewDecision: "requires_follow_up",
      signedAt: "2026-04-20T10:00:00.000Z",
      reviewNotes: "Initial follow-up required.",
    });
    const latestSignoff = await createMeetingSignoff(meeting.id, {
      reviewDecision: "approved",
      signedAt: "2026-04-20T12:00:00.000Z",
      reviewNotes: "Follow-up completed and approved.",
    });
    const before = await countRows();

    const response = await request(app).get(
      "/air-safety-meetings/approval-rollup",
    );

    expect(response.status).toBe(200);
    expect(response.body.export.records).toHaveLength(1);
    expect(response.body.export.records[0]).toMatchObject({
      meetingId: meeting.id,
      latestSignoffApprovalStatus: "approved",
      latestSignoffId: latestSignoff.id,
      signedAt: latestSignoff.signedAt,
      reviewNotes: "Follow-up completed and approved.",
    });
    expect(await countRows()).toEqual(before);
  });

  it("renders an empty governance approval rollup without mutating source records", async () => {
    const before = await countRows();

    const response = await request(app).get(
      "/air-safety-meetings/approval-rollup/render",
    );

    expect(response.status).toBe(200);
    expect(response.body.report).toMatchObject({
      renderType: "air_safety_meeting_approval_rollup_report",
      formatVersion: 1,
      sourceExport: {
        exportType: "air_safety_meeting_approval_rollup",
        records: [],
      },
      report: {
        title: "Air safety meeting approval assurance summary",
        sections: expect.arrayContaining([
          expect.objectContaining({
            heading: "Approval rollup summary",
            fields: expect.arrayContaining([
              { label: "Total meetings", value: 0 },
              { label: "Approved meetings", value: 0 },
              { label: "Rejected meetings", value: 0 },
              { label: "Requires follow-up meetings", value: 0 },
              { label: "Unsigned meetings", value: 0 },
            ]),
          }),
          {
            heading: "Approval rollup records",
            fields: [
              {
                label: "Meetings",
                value: "No air safety meetings recorded",
              },
            ],
          },
        ]),
      },
    });
    expect(response.body.report.generatedAt).toEqual(expect.any(String));
    expect(response.body.report.report.plainText).toContain(
      "Meetings: No air safety meetings recorded",
    );
    expect(await countRows()).toEqual(before);
  });

  it("renders governance approval rollup as an assurance summary with stable ordering", async () => {
    const approvedMeeting = await request(app).post("/air-safety-meetings").send({
      meetingType: "event_triggered_safety_review",
      dueAt: "2026-04-24T10:00:00.000Z",
      chairperson: "Safety Manager",
      createdBy: "safety-admin",
    });
    const rejectedMeeting = await request(app).post("/air-safety-meetings").send({
      meetingType: "sop_breach_review",
      dueAt: "2026-04-23T10:00:00.000Z",
      chairperson: "Chief Pilot",
      createdBy: "safety-admin",
    });
    const followUpMeeting = await request(app).post("/air-safety-meetings").send({
      meetingType: "training_review",
      dueAt: "2026-04-22T10:00:00.000Z",
      chairperson: "Training Manager",
      createdBy: "safety-admin",
    });
    const unsignedMeeting = await request(app).post("/air-safety-meetings").send({
      meetingType: "maintenance_safety_review",
      dueAt: "2026-04-21T10:00:00.000Z",
      chairperson: "Engineering Lead",
      createdBy: "safety-admin",
    });

    expect(approvedMeeting.status).toBe(201);
    expect(rejectedMeeting.status).toBe(201);
    expect(followUpMeeting.status).toBe(201);
    expect(unsignedMeeting.status).toBe(201);

    const approvedSignoff = await createMeetingSignoff(approvedMeeting.body.meeting.id, {
      accountableManagerName: "Alex Morgan",
      reviewDecision: "approved",
      signedAt: "2026-04-24T11:00:00.000Z",
      reviewNotes: "Approved for governance closure.",
    });
    const rejectedSignoff = await createMeetingSignoff(rejectedMeeting.body.meeting.id, {
      accountableManagerName: "Jordan Lee",
      reviewDecision: "rejected",
      signedAt: "2026-04-23T11:00:00.000Z",
      reviewNotes: "Rejected pending corrective action.",
    });
    const followUpSignoff = await createMeetingSignoff(followUpMeeting.body.meeting.id, {
      accountableManagerName: "Taylor Shaw",
      reviewDecision: "requires_follow_up",
      signedAt: "2026-04-22T11:00:00.000Z",
      reviewNotes: "Follow-up review required.",
    });
    const before = await countRows();

    const response = await request(app).get(
      "/air-safety-meetings/approval-rollup/render",
    );

    expect(response.status).toBe(200);
    expect(response.body.report.sourceExport.records).toEqual([
      expect.objectContaining({
        meetingId: approvedMeeting.body.meeting.id,
        latestSignoffId: approvedSignoff.id,
        latestSignoffApprovalStatus: "approved",
      }),
      expect.objectContaining({
        meetingId: rejectedMeeting.body.meeting.id,
        latestSignoffId: rejectedSignoff.id,
        latestSignoffApprovalStatus: "rejected",
      }),
      expect.objectContaining({
        meetingId: followUpMeeting.body.meeting.id,
        latestSignoffId: followUpSignoff.id,
        latestSignoffApprovalStatus: "requires_follow_up",
      }),
      expect.objectContaining({
        meetingId: unsignedMeeting.body.meeting.id,
        latestSignoffId: null,
        latestSignoffApprovalStatus: "unsigned",
      }),
    ]);
    expect(response.body.report.report.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          heading: "Approval rollup summary",
          fields: expect.arrayContaining([
            { label: "Total meetings", value: 4 },
            { label: "Approved meetings", value: 1 },
            { label: "Rejected meetings", value: 1 },
            { label: "Requires follow-up meetings", value: 1 },
            { label: "Unsigned meetings", value: 1 },
          ]),
        }),
        expect.objectContaining({
          heading: "Approved meetings",
          fields: [
            {
              label: "Meetings",
              value: expect.stringContaining(approvedMeeting.body.meeting.id),
            },
          ],
        }),
        expect.objectContaining({
          heading: "Rejected meetings",
          fields: [
            {
              label: "Meetings",
              value: expect.stringContaining(rejectedMeeting.body.meeting.id),
            },
          ],
        }),
        expect.objectContaining({
          heading: "Requires follow-up meetings",
          fields: [
            {
              label: "Meetings",
              value: expect.stringContaining(followUpMeeting.body.meeting.id),
            },
          ],
        }),
        expect.objectContaining({
          heading: "Unsigned meetings",
          fields: [
            {
              label: "Meetings",
              value: expect.stringContaining(unsignedMeeting.body.meeting.id),
            },
          ],
        }),
      ]),
    );
    expect(response.body.report.report.plainText).toContain(
      `Meetings: ${approvedMeeting.body.meeting.id} | event_triggered_safety_review | scheduled | 2026-04-24T10:00:00.000Z`,
    );
    expect(response.body.report.report.plainText).toContain(
      `Meetings: ${rejectedMeeting.body.meeting.id} | sop_breach_review | scheduled | 2026-04-23T10:00:00.000Z`,
    );
    expect(response.body.report.report.plainText).toContain(
      `Meetings: ${followUpMeeting.body.meeting.id} | training_review | scheduled | 2026-04-22T10:00:00.000Z`,
    );
    expect(response.body.report.report.plainText).toContain(
      `Meetings: ${unsignedMeeting.body.meeting.id} | maintenance_safety_review | scheduled | 2026-04-21T10:00:00.000Z`,
    );
    expect(await countRows()).toEqual(before);
  });

  it("exports an empty safety meeting pack without mutating source records", async () => {
    const meeting = await createEventTriggeredMeeting();
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export).toMatchObject({
      exportType: "air_safety_meeting_pack",
      formatVersion: 1,
      meetingId: meeting.id,
      meeting: {
        id: meeting.id,
        meetingType: "event_triggered_safety_review",
        status: "scheduled",
        chairperson: "Safety Manager",
      },
      agendaItems: [],
    });
    expect(response.body.export.generatedAt).toEqual(expect.any(String));
    expect(await countRows()).toEqual(before);
  });

  it("exports agenda-linked safety events, triggers, proposals, decisions, and closure evidence", async () => {
    const meeting = await createEventTriggeredMeeting();
    const source = await createCompletedActionWithEvidence(meeting.id);
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.agendaItems).toHaveLength(1);
    expect(response.body.export.agendaItems[0]).toMatchObject({
      link: {
        id: source.agendaLink.id,
        safetyEventId: source.event.id,
        safetyEventMeetingTriggerId: source.trigger.id,
        airSafetyMeetingId: meeting.id,
        agendaItem: "Review completed action evidence",
        linkedBy: "safety-coordinator",
      },
      safetyEvent: {
        id: source.event.id,
        eventType: "sop_breach",
        severity: "high",
        status: "open",
        summary: "Safety event for meeting pack",
        sopReference: "OPS-SOP-LAUNCH-001",
      },
      meetingTrigger: {
        id: source.trigger.id,
        safetyEventId: source.event.id,
        meetingRequired: true,
        recommendedMeetingType: "sop_breach_review",
        triggerReasons: expect.arrayContaining([
          "severity:high",
          "event_type:sop_breach",
        ]),
        reviewFlags: {
          sopReviewRequired: true,
        },
        assessedBy: "safety-manager",
      },
      actionProposals: [
        {
          id: source.proposal.id,
          proposalType: "sop_change",
          status: "completed",
          summary: "Update safety procedure",
          rationale: "Meeting review identified required follow-up.",
          proposedOwner: "Safety Manager",
          createdBy: "safety-manager",
          decisions: [
            expect.objectContaining({
              id: source.acceptDecision.id,
              decision: "accepted",
              decidedBy: "accountable-manager",
              decisionNotes: "Accepted for implementation.",
            }),
            expect.objectContaining({
              id: source.completeDecision.id,
              decision: "completed",
              decidedBy: "safety-manager",
              decisionNotes: "Action completed.",
            }),
          ],
          implementationEvidence: [
            expect.objectContaining({
              id: source.implementationEvidence.id,
              evidenceCategory: "sop_implementation",
              implementationSummary: "Procedure update completed",
              evidenceReference: "DOC-SAFETY-001",
              completedBy: "safety-manager",
              reviewedBy: "accountable-manager",
              reviewNotes: "Closure evidence reviewed.",
            }),
          ],
        },
      ],
    });
    expect(await countRows()).toEqual(before);
  });

  it("exports multiple agenda-linked safety events for one meeting", async () => {
    const meeting = await createEventTriggeredMeeting();
    const sop = await createAgendaLinkedEvent(meeting.id, {
      eventType: "sop_breach",
      summary: "SOP breach review",
      agendaItem: "Review SOP breach",
    });
    const training = await createAgendaLinkedEvent(meeting.id, {
      eventType: "training_need",
      severity: "medium",
      summary: "Training action review",
      agendaItem: "Review training need",
    });
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.agendaItems).toHaveLength(2);
    expect(
      response.body.export.agendaItems.map(
        (item: { safetyEvent: { id: string } }) => item.safetyEvent.id,
      ),
    ).toEqual(expect.arrayContaining([sop.event.id, training.event.id]));
    expect(
      response.body.export.agendaItems.map(
        (item: { link: { agendaItem: string } }) => item.link.agendaItem,
      ),
    ).toEqual(
      expect.arrayContaining(["Review SOP breach", "Review training need"]),
    );
    expect(await countRows()).toEqual(before);
  });

  it("represents missing proposals, decisions, and closure evidence as empty arrays", async () => {
    const meeting = await createEventTriggeredMeeting();
    const source = await createAgendaLinkedEvent(meeting.id);
    const proposalResponse = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals`)
      .send({
        proposalType: "general_safety_action",
        summary: "Track meeting action without decision yet",
      });

    expect(proposalResponse.status).toBe(201);
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.agendaItems[0].actionProposals).toEqual([
      expect.objectContaining({
        id: proposalResponse.body.proposal.id,
        status: "proposed",
        decisions: [],
        implementationEvidence: [],
      }),
    ]);
    expect(await countRows()).toEqual(before);
  });

  it("exports an unsigned sign-off approval context when no meeting sign-off exists", async () => {
    const meeting = await createEventTriggeredMeeting();
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.signoffApproval).toEqual({
      status: "unsigned",
      latestSignoff: null,
    });
    expect(await countRows()).toEqual(before);
  });

  it("exports approved meeting sign-off approval context", async () => {
    const meeting = await createEventTriggeredMeeting();
    const signoff = await createMeetingSignoff(meeting.id, {
      reviewDecision: "approved",
      reviewNotes: "Approved for closure.",
    });
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.signoffApproval).toEqual({
      status: "approved",
      latestSignoff: signoff,
    });
    expect(await countRows()).toEqual(before);
  });

  it("exports rejected meeting sign-off approval context", async () => {
    const meeting = await createEventTriggeredMeeting();
    const signoff = await createMeetingSignoff(meeting.id, {
      reviewDecision: "rejected",
      signatureReference: null,
      reviewNotes: "Rejected pending corrective action.",
    });
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.signoffApproval).toEqual({
      status: "rejected",
      latestSignoff: signoff,
    });
    expect(await countRows()).toEqual(before);
  });

  it("exports requires-follow-up meeting sign-off approval context", async () => {
    const meeting = await createEventTriggeredMeeting();
    const signoff = await createMeetingSignoff(meeting.id, {
      reviewDecision: "requires_follow_up",
      reviewNotes: "Further review required before approval.",
    });
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.signoffApproval).toEqual({
      status: "requires_follow_up",
      latestSignoff: signoff,
    });
    expect(await countRows()).toEqual(before);
  });

  it("does not leak meeting pack records from other meetings", async () => {
    const firstMeeting = await createEventTriggeredMeeting();
    const secondMeeting = await createEventTriggeredMeeting();
    const secondSource = await createCompletedActionWithEvidence(
      secondMeeting.id,
      {
        eventType: "maintenance_concern",
        proposalType: "maintenance_action",
        evidenceCategory: "maintenance_completion",
      },
    );
    const secondSignoff = await createMeetingSignoff(secondMeeting.id, {
      accountableManagerName: "Jordan Lee",
      signatureReference: "signature://accountable-manager/jordan-lee",
      reviewDecision: "approved",
      reviewNotes: "Second meeting approved.",
    });
    const firstBefore = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${firstMeeting.id}/export`,
    );

    expect(response.status).toBe(200);
    expect(response.body.export.meetingId).toBe(firstMeeting.id);
    expect(response.body.export.signoffApproval).toEqual({
      status: "unsigned",
      latestSignoff: null,
    });
    expect(response.body.export.agendaItems).toEqual([]);
    expect(JSON.stringify(response.body.export)).not.toContain(
      secondSource.event.id,
    );
    expect(JSON.stringify(response.body.export)).not.toContain(
      secondSignoff.id,
    );
    expect(await countRows()).toEqual(firstBefore);
  });

  it("rejects invalid or missing meeting pack export IDs", async () => {
    const before = await countRows();
    const invalidResponse = await request(app).get(
      "/air-safety-meetings/not-a-uuid/export",
    );
    const missingResponse = await request(app).get(
      `/air-safety-meetings/${randomUUID()}/export`,
    );

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error).toMatchObject({
      type: "air_safety_meeting_not_found",
    });
    expect(await countRows()).toEqual(before);
  });

  it("renders an empty safety meeting pack without mutating source records", async () => {
    const meeting = await createEventTriggeredMeeting();
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report).toMatchObject({
      renderType: "air_safety_meeting_pack_report",
      formatVersion: 1,
      sourceExport: {
        exportType: "air_safety_meeting_pack",
        meetingId: meeting.id,
        agendaItems: [],
      },
      report: {
        title: `Air safety meeting pack for meeting ${meeting.id}`,
        sections: expect.arrayContaining([
          expect.objectContaining({
            heading: "Meeting summary",
            fields: expect.arrayContaining([
              { label: "Meeting ID", value: meeting.id },
              { label: "Meeting type", value: "event_triggered_safety_review" },
              { label: "Status", value: "scheduled" },
            ]),
          }),
          expect.objectContaining({
            heading: "Meeting metadata",
            fields: expect.arrayContaining([
              {
                label: "Standing agenda",
                value: "Review safety events; Review action closure",
              },
            ]),
          }),
          expect.objectContaining({
            heading: "Accountable manager sign-off",
            fields: expect.arrayContaining([
              {
                label: "Accountable manager name",
                value: "Pending sign-off",
              },
              { label: "Role/title", value: "Pending sign-off" },
              { label: "Signature", value: "Pending sign-off" },
              { label: "Signed date/time", value: "Pending sign-off" },
              {
                label: "Review decision/status",
                value: "Pending sign-off",
              },
              {
                label: "Review notes/comments",
                value: "Pending sign-off",
              },
            ]),
          }),
          {
            heading: "Agenda-linked safety events",
            fields: [
              {
                label: "Agenda items",
                value: "No agenda-linked safety events recorded",
              },
              {
                label: "Action proposals",
                value: "No safety action proposals recorded",
              },
              {
                label: "Implementation closure evidence",
                value: "No implementation closure evidence recorded",
              },
            ],
          },
        ]),
      },
    });
    expect(response.body.report.generatedAt).toEqual(expect.any(String));
    expect(response.body.report.report.plainText).toContain(
      "Agenda items: No agenda-linked safety events recorded",
    );
    expect(await countRows()).toEqual(before);
  });

  it("renders agenda events, trigger rationale, decisions, and closure evidence", async () => {
    const meeting = await createEventTriggeredMeeting();
    const source = await createCompletedActionWithEvidence(meeting.id);
    const signoff = await createMeetingSignoff(meeting.id, {
      reviewDecision: "requires_follow_up",
      signedAt: "2026-04-20T18:00:00.000Z",
      signatureReference: "signature://accountable-manager/alex-follow-up",
      reviewNotes: "Additional corrective action review required.",
    });
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report.report.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          heading: "Agenda item 1",
          fields: expect.arrayContaining([
            { label: "Agenda link ID", value: source.agendaLink.id },
            {
              label: "Agenda item",
              value: "Review completed action evidence",
            },
            { label: "Safety event ID", value: source.event.id },
            { label: "Safety event type", value: "sop_breach" },
            { label: "Severity", value: "high" },
            { label: "Event summary", value: "Safety event for meeting pack" },
            { label: "Recommended meeting type", value: "sop_breach_review" },
            {
              label: "Trigger reasons",
              value: "severity:high, event_type:sop_breach",
            },
            { label: "Review flags", value: "sopReviewRequired" },
          ]),
        }),
        expect.objectContaining({
          heading: "Agenda item 1 action 1",
          fields: expect.arrayContaining([
            { label: "Action proposal ID", value: source.proposal.id },
            { label: "Proposal type", value: "sop_change" },
            { label: "Proposal status", value: "completed" },
            { label: "Proposal summary", value: "Update safety procedure" },
            {
              label: "Decision history",
              value: expect.stringContaining("accepted | accountable-manager"),
            },
            {
              label: "Implementation closure evidence",
              value: expect.stringContaining(
                "sop_implementation | Procedure update completed",
              ),
            },
          ]),
        }),
      ]),
    );
    expect(response.body.report.report.plainText).toContain(
      "Meeting summary",
    );
    expect(response.body.report.report.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          heading: "Accountable manager sign-off",
          fields: expect.arrayContaining([
            {
              label: "Accountable manager name",
              value: signoff.accountableManagerName,
            },
            { label: "Role/title", value: signoff.accountableManagerRole },
            { label: "Signature", value: signoff.signatureReference },
            { label: "Signed date/time", value: signoff.signedAt },
            {
              label: "Review decision/status",
              value: signoff.reviewDecision,
            },
            {
              label: "Review notes/comments",
              value: signoff.reviewNotes,
            },
          ]),
        }),
      ]),
    );
    expect(response.body.report.report.plainText).toContain(
      "Accountable manager sign-off",
    );
    expect(response.body.report.report.plainText).toContain(
      `Review decision/status: ${signoff.reviewDecision}`,
    );
    expect(response.body.report.report.plainText).toContain(
      `Signature: ${signoff.signatureReference}`,
    );
    expect(response.body.report.report.plainText).toContain(
      "Decision history: accepted | accountable-manager",
    );
    expect(response.body.report.report.plainText).toContain(
      "Implementation closure evidence: sop_implementation | Procedure update completed",
    );
    expect(response.body.report.report.title).toBe(
      `Air safety meeting pack for meeting ${meeting.id}`,
    );
    expect(await countRows()).toEqual(before);
  });

  it("renders multiple agenda items and empty action states clearly", async () => {
    const meeting = await createEventTriggeredMeeting();
    const sop = await createAgendaLinkedEvent(meeting.id, {
      eventType: "sop_breach",
      agendaItem: "Review SOP breach",
    });
    const training = await createAgendaLinkedEvent(meeting.id, {
      eventType: "training_need",
      severity: "medium",
      agendaItem: "Review training need",
    });
    const proposalResponse = await request(app)
      .post(`/safety-events/${training.event.id}/agenda-links/${training.agendaLink.id}/action-proposals`)
      .send({
        proposalType: "training_action",
        summary: "Training action proposed",
      });

    expect(proposalResponse.status).toBe(201);
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${meeting.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report.sourceExport.agendaItems).toHaveLength(2);
    expect(response.body.report.report.plainText).toContain(
      `Safety event ID: ${sop.event.id}`,
    );
    expect(response.body.report.report.plainText).toContain(
      `Safety event ID: ${training.event.id}`,
    );
    expect(response.body.report.report.plainText).toContain(
      "Decision history: No action decisions recorded",
    );
    expect(response.body.report.report.plainText).toContain(
      "Implementation closure evidence: No implementation closure evidence recorded",
    );
    expect(await countRows()).toEqual(before);
  });

  it("does not leak rendered safety meeting pack records from other meetings", async () => {
    const firstMeeting = await createEventTriggeredMeeting();
    const secondMeeting = await createEventTriggeredMeeting();
    const secondSource = await createCompletedActionWithEvidence(
      secondMeeting.id,
      {
        eventType: "maintenance_concern",
        proposalType: "maintenance_action",
        evidenceCategory: "maintenance_completion",
      },
    );
    const before = await countRows();

    const response = await request(app).get(
      `/air-safety-meetings/${firstMeeting.id}/export/render`,
    );

    expect(response.status).toBe(200);
    expect(response.body.report.sourceExport.meetingId).toBe(firstMeeting.id);
    expect(response.body.report.sourceExport.agendaItems).toEqual([]);
    expect(JSON.stringify(response.body.report)).not.toContain(
      secondSource.event.id,
    );
    expect(await countRows()).toEqual(before);
  });

  it("generates a populated safety meeting pack PDF without mutating source records", async () => {
    const meeting = await createEventTriggeredMeeting();
    const source = await createCompletedActionWithEvidence(meeting.id);
    const signoff = await createMeetingSignoff(meeting.id, {
      signedAt: "2026-04-20T18:30:00.000Z",
      signatureReference: "signature://accountable-manager/alex-approved",
      reviewNotes: "Meeting pack approved for formal review.",
    });
    const before = await countRows();

    const response = await request(app)
      .get(`/air-safety-meetings/${meeting.id}/export/pdf`)
      .buffer(true)
      .parse(parseBinaryResponse);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-disposition"]).toContain(
      `air-safety-meeting-${meeting.id}-pack.pdf`,
    );
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.toString("latin1", 0, 8)).toBe("%PDF-1.4");
    expect(response.body.toString("latin1")).toContain(
      `Air safety meeting pack for meeting ${meeting.id}`,
    );
    expect(response.body.toString("latin1")).toContain(
      "Accountable manager sign-off",
    );
    expect(response.body.toString("latin1")).toContain(
      "Accountable manager name:",
    );
    expect(response.body.toString("latin1")).toContain(
      signoff.accountableManagerName,
    );
    expect(response.body.toString("latin1")).toContain(
      "Signature:",
    );
    expect(response.body.toString("latin1")).toContain(
      signoff.signatureReference!,
    );
    expect(response.body.toString("latin1")).toContain(
      `Review decision/status: ${signoff.reviewDecision}`,
    );
    expect(response.body.toString("latin1")).toContain(
      "Signed date/time:",
    );
    expect(response.body.toString("latin1")).toContain(
      signoff.signedAt,
    );
    expect(response.body.toString("latin1")).toContain(
      "Agenda link ID:",
    );
    expect(response.body.toString("latin1")).toContain(
      source.agendaLink.id,
    );
    expect(response.body.toString("latin1")).toContain(
      "Decision history: accepted |",
    );
    expect(response.body.toString("latin1")).toContain(
      "accountable-manager",
    );
    expect(response.body.toString("latin1")).toContain(
      "Implementation closure evidence: sop_implementation | Procedure update completed",
    );
    expect(await countRows()).toEqual(before);
  });

  it("generates an empty safety meeting pack PDF with explicit empty-state wording", async () => {
    const meeting = await createEventTriggeredMeeting();
    const before = await countRows();

    const response = await request(app)
      .get(`/air-safety-meetings/${meeting.id}/export/pdf`)
      .buffer(true)
      .parse(parseBinaryResponse);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.body.toString("latin1")).toContain(
      `Air safety meeting pack for meeting ${meeting.id}`,
    );
    expect(response.body.toString("latin1")).toContain(
      "Accountable manager sign-off",
    );
    expect(response.body.toString("latin1")).toContain(
      "Pending sign-off",
    );
    expect(response.body.toString("latin1")).toContain(
      "Agenda-linked safety events",
    );
    expect(response.body.toString("latin1")).toContain(
      "Agenda items: No agenda-linked safety events",
    );
    expect(response.body.toString("latin1")).toContain(
      "No safety action proposals",
    );
    expect(response.body.toString("latin1")).toContain(
      "No implementation closure evidence recorded",
    );
    expect(await countRows()).toEqual(before);
  });

  it("does not leak safety meeting pack PDF records from other meetings", async () => {
    const firstMeeting = await createEventTriggeredMeeting();
    const secondMeeting = await createEventTriggeredMeeting();
    const secondSource = await createCompletedActionWithEvidence(
      secondMeeting.id,
      {
        eventType: "maintenance_concern",
        proposalType: "maintenance_action",
        evidenceCategory: "maintenance_completion",
      },
    );
    const secondSignoff = await createMeetingSignoff(secondMeeting.id, {
      accountableManagerName: "Jordan Lee",
      signatureReference: "signature://accountable-manager/jordan-lee",
      reviewNotes: "Second meeting approved.",
    });
    const before = await countRows();

    const response = await request(app)
      .get(`/air-safety-meetings/${firstMeeting.id}/export/pdf`)
      .buffer(true)
      .parse(parseBinaryResponse);

    expect(response.status).toBe(200);
    expect(response.body.toString("latin1")).toContain(
      `Air safety meeting pack for meeting ${firstMeeting.id}`,
    );
    expect(response.body.toString("latin1")).not.toContain(secondSource.event.id);
    expect(response.body.toString("latin1")).not.toContain(
      secondSignoff.signatureReference!,
    );
    expect(response.body.toString("latin1")).toContain(
      "Review decision/status: Pending sign-off",
    );
    expect(await countRows()).toEqual(before);
  });

  it("rejects invalid or missing safety meeting pack PDF IDs", async () => {
    const before = await countRows();
    const invalidResponse = await request(app).get(
      "/air-safety-meetings/not-a-uuid/export/pdf",
    );
    const missingResponse = await request(app).get(
      `/air-safety-meetings/${randomUUID()}/export/pdf`,
    );

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error).toMatchObject({
      type: "air_safety_meeting_not_found",
    });
    expect(await countRows()).toEqual(before);
  });

  it("rejects invalid or missing rendered meeting pack IDs", async () => {
    const before = await countRows();
    const invalidResponse = await request(app).get(
      "/air-safety-meetings/not-a-uuid/export/render",
    );
    const missingResponse = await request(app).get(
      `/air-safety-meetings/${randomUUID()}/export/render`,
    );

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error).toMatchObject({
      type: "air_safety_meeting_validation_failed",
    });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error).toMatchObject({
      type: "air_safety_meeting_not_found",
    });
    expect(await countRows()).toEqual(before);
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
