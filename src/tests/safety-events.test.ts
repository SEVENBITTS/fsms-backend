import { randomUUID } from "crypto";
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
  await pool.query("delete from post_operation_audit_signoffs");
  await pool.query("delete from post_operation_evidence_snapshots");
  await pool.query("delete from air_safety_meetings");
  await pool.query("delete from mission_planning_approval_handoffs");
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

const countRows = async (ids: {
  missionId?: string;
  platformId?: string;
  pilotId?: string;
  meetingId?: string;
}) => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from safety_events) as safety_event_count,
      (select count(*)::int from safety_event_meeting_triggers) as safety_event_trigger_count,
      (select count(*)::int from safety_event_agenda_links) as safety_event_agenda_link_count,
      (select count(*)::int from safety_action_proposals) as safety_action_proposal_count,
      (select count(*)::int from safety_action_decisions) as safety_action_decision_count,
      (select count(*)::int from safety_action_implementation_evidence) as safety_action_implementation_evidence_count,
      (select count(*)::int from missions where ($1::uuid is null or id = $1)) as mission_count,
      (select count(*)::int from platforms where ($2::uuid is null or id = $2)) as platform_count,
      (select count(*)::int from pilots where ($3::uuid is null or id = $3)) as pilot_count,
      (select count(*)::int from air_safety_meetings where ($4::uuid is null or id = $4)) as meeting_count,
      (select count(*)::int from mission_events where ($1::uuid is null or mission_id = $1)) as mission_event_count
    `,
    [
      ids.missionId ?? null,
      ids.platformId ?? null,
      ids.pilotId ?? null,
      ids.meetingId ?? null,
    ],
  );

  return result.rows[0] as {
    safety_event_count: number;
    safety_event_trigger_count: number;
    safety_event_agenda_link_count: number;
    safety_action_proposal_count: number;
    safety_action_decision_count: number;
    safety_action_implementation_evidence_count: number;
    mission_count: number;
    platform_count: number;
    pilot_count: number;
    meeting_count: number;
    mission_event_count: number;
  };
};

const createPlatform = async () => {
  const response = await request(app).post("/platforms").send({
    name: "Safety Event UAV",
    status: "active",
  });

  expect(response.status).toBe(201);
  return response.body.platform as { id: string };
};

const createPilot = async () => {
  const response = await request(app).post("/pilots").send({
    displayName: "Safety Event Pilot",
    status: "active",
  });

  expect(response.status).toBe(201);
  return response.body.pilot as { id: string };
};

const insertMission = async (params: {
  platformId?: string | null;
  pilotId?: string | null;
}) => {
  const missionId = randomUUID();

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
    values ($1, 'completed', 'safety-event-plan', $2, $3, 0)
    `,
    [missionId, params.platformId ?? null, params.pilotId ?? null],
  );

  return missionId;
};

const insertPostOperationSnapshot = async (missionId: string) => {
  const snapshotId = randomUUID();

  await pool.query(
    `
    insert into post_operation_evidence_snapshots (
      id,
      mission_id,
      lifecycle_state,
      completion_snapshot,
      created_by
    )
    values ($1, $2, 'completed', $3::jsonb, 'safety-reviewer')
    `,
    [
      snapshotId,
      missionId,
      JSON.stringify({
        missionId,
        status: "completed",
        capturedAt: "2026-04-01T10:00:00.000Z",
      }),
    ],
  );

  return snapshotId;
};

const createAirSafetyMeeting = async () => {
  const response = await request(app).post("/air-safety-meetings").send({
    meetingType: "event_triggered_safety_review",
    dueAt: "2026-04-15T10:00:00.000Z",
    chairperson: "Safety Manager",
  });

  expect(response.status).toBe(201);
  return response.body.meeting as { id: string };
};

const createTriggeredSafetyEvent = async (params?: {
  eventType?: string;
  severity?: string;
  summary?: string;
}) => {
  const eventResponse = await request(app).post("/safety-events").send({
    eventType: params?.eventType ?? "near_miss",
    severity: params?.severity ?? "high",
    eventOccurredAt: "2026-04-14T09:00:00.000Z",
    summary: params?.summary ?? "Near miss requires safety review",
  });

  expect(eventResponse.status).toBe(201);

  const triggerResponse = await request(app)
    .post(`/safety-events/${eventResponse.body.event.id}/meeting-trigger`)
    .send({
      assessedBy: "safety-manager",
    });

  expect(triggerResponse.status).toBe(201);

  return {
    event: eventResponse.body.event as { id: string },
    trigger: triggerResponse.body.trigger as { id: string },
  };
};

const createAgendaLinkedSafetyEvent = async (params?: {
  eventType?: string;
  severity?: string;
  summary?: string;
  agendaItem?: string;
}) => {
  const meeting = await createAirSafetyMeeting();
  const { event, trigger } = await createTriggeredSafetyEvent(params);
  const linkResponse = await request(app)
    .post(`/safety-events/${event.id}/meeting-triggers/${trigger.id}/agenda-links`)
    .send({
      airSafetyMeetingId: meeting.id,
      agendaItem: params?.agendaItem ?? "Review safety event follow-up",
      linkedBy: "safety-coordinator",
    });

  expect(linkResponse.status).toBe(201);

  return {
    meeting,
    event,
    trigger,
    agendaLink: linkResponse.body.link as { id: string },
  };
};

const createSafetyActionProposal = async (params?: {
  proposalType?: string;
  summary?: string;
}) => {
  const source = await createAgendaLinkedSafetyEvent();
  const proposalResponse = await request(app)
    .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals`)
    .send({
      proposalType: params?.proposalType ?? "general_safety_action",
      summary: params?.summary ?? "Review safety follow-up",
      createdBy: "safety-manager",
    });

  expect(proposalResponse.status).toBe(201);

  return {
    ...source,
    proposal: proposalResponse.body.proposal as { id: string; status: string },
  };
};

const createCompletedSafetyActionProposal = async (params?: {
  proposalType?: string;
  summary?: string;
}) => {
  const source = await createSafetyActionProposal(params);

  const acceptResponse = await request(app)
    .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/decisions`)
    .send({
      decision: "accepted",
      decidedBy: "safety-manager",
    });
  const completeResponse = await request(app)
    .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/decisions`)
    .send({
      decision: "completed",
      decidedBy: "safety-manager",
      decisionNotes: "Action implemented.",
    });

  expect(acceptResponse.status).toBe(201);
  expect(completeResponse.status).toBe(201);

  return {
    ...source,
    proposal: completeResponse.body.proposal as { id: string; status: string },
  };
};

describe("safety events", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("captures and lists SOP breach safety events with review triggers", async () => {
    const response = await request(app).post("/safety-events").send({
      eventType: "sop_breach",
      severity: "high",
      eventOccurredAt: "2026-04-10T09:30:00.000Z",
      reportedBy: " chief pilot ",
      summary: " Launch checklist step missed ",
      description: "Pilot skipped second-person checklist confirmation.",
      immediateActionTaken: "Mission paused and checklist restarted.",
      sopReference: "OPS-SOP-LAUNCH-001",
      meetingRequired: true,
      sopReviewRequired: true,
      trainingRequired: true,
      accountableManagerReviewRequired: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.event).toMatchObject({
      eventType: "sop_breach",
      severity: "high",
      status: "open",
      missionId: null,
      platformId: null,
      pilotId: null,
      reportedBy: "chief pilot",
      eventOccurredAt: "2026-04-10T09:30:00.000Z",
      summary: "Launch checklist step missed",
      description: "Pilot skipped second-person checklist confirmation.",
      immediateActionTaken: "Mission paused and checklist restarted.",
      sopReference: "OPS-SOP-LAUNCH-001",
      meetingRequired: true,
      sopReviewRequired: true,
      trainingRequired: true,
      maintenanceReviewRequired: false,
      accountableManagerReviewRequired: true,
      regulatorReportableReviewRequired: false,
    });
    expect(response.body.event.id).toEqual(expect.any(String));
    expect(response.body.event.reportedAt).toEqual(expect.any(String));

    const listResponse = await request(app).get("/safety-events");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.events).toHaveLength(1);
    expect(listResponse.body.events[0]).toEqual(response.body.event);
  });

  it("stores meeting trigger decisions for serious safety events", async () => {
    const response = await request(app).post("/safety-events").send({
      eventType: "near_miss",
      severity: "high",
      eventOccurredAt: "2026-04-13T09:00:00.000Z",
      reportedBy: "safety-manager",
      summary: "Loss of separation during recovery",
    });

    expect(response.status).toBe(201);

    const triggerResponse = await request(app)
      .post(`/safety-events/${response.body.event.id}/meeting-trigger`)
      .send({
        assessedBy: " accountable manager ",
      });

    expect(triggerResponse.status).toBe(201);
    expect(triggerResponse.body.trigger).toMatchObject({
      safetyEventId: response.body.event.id,
      meetingRequired: true,
      recommendedMeetingType: "event_triggered_safety_review",
      triggerReasons: ["severity:high"],
      reviewFlags: {
        sopReviewRequired: false,
        trainingRequired: false,
        maintenanceReviewRequired: false,
        accountableManagerReviewRequired: false,
        regulatorReportableReviewRequired: false,
      },
      assessedBy: "accountable manager",
    });
    expect(triggerResponse.body.trigger.id).toEqual(expect.any(String));
    expect(triggerResponse.body.trigger.assessedAt).toEqual(expect.any(String));

    const listResponse = await request(app).get(
      `/safety-events/${response.body.event.id}/meeting-triggers`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.triggers).toHaveLength(1);
    expect(listResponse.body.triggers[0]).toEqual(
      triggerResponse.body.trigger,
    );
  });

  it("stores SOP breach, training, and maintenance trigger decisions", async () => {
    const cases = [
      {
        eventType: "sop_breach",
        severity: "low",
        summary: "Dispatch checklist missed",
        recommendedMeetingType: "sop_breach_review",
        triggerReason: "event_type:sop_breach",
        reviewFlag: "sopReviewRequired",
      },
      {
        eventType: "training_need",
        severity: "medium",
        summary: "Manual mode recovery refresher required",
        recommendedMeetingType: "training_review",
        triggerReason: "event_type:training_need",
        reviewFlag: "trainingRequired",
      },
      {
        eventType: "maintenance_concern",
        severity: "medium",
        summary: "Motor bearing noise after landing",
        recommendedMeetingType: "maintenance_safety_review",
        triggerReason: "event_type:maintenance_concern",
        reviewFlag: "maintenanceReviewRequired",
      },
    ];

    for (const testCase of cases) {
      const response = await request(app).post("/safety-events").send({
        eventType: testCase.eventType,
        severity: testCase.severity,
        eventOccurredAt: "2026-04-13T10:00:00.000Z",
        summary: testCase.summary,
      });

      expect(response.status).toBe(201);

      const triggerResponse = await request(app)
        .post(`/safety-events/${response.body.event.id}/meeting-trigger`)
        .send({});

      expect(triggerResponse.status).toBe(201);
      expect(triggerResponse.body.trigger).toMatchObject({
        safetyEventId: response.body.event.id,
        meetingRequired: true,
        recommendedMeetingType: testCase.recommendedMeetingType,
        triggerReasons: [testCase.triggerReason],
      });
      expect(triggerResponse.body.trigger.reviewFlags[testCase.reviewFlag]).toBe(
        true,
      );
    }
  });

  it("stores non-triggering low-risk event decisions without requiring meetings", async () => {
    const response = await request(app).post("/safety-events").send({
      eventType: "mission_planning_issue",
      severity: "low",
      eventOccurredAt: "2026-04-13T11:00:00.000Z",
      summary: "Minor planning note corrected before review",
    });

    expect(response.status).toBe(201);

    const triggerResponse = await request(app)
      .post(`/safety-events/${response.body.event.id}/meeting-trigger`)
      .send({});

    expect(triggerResponse.status).toBe(201);
    expect(triggerResponse.body.trigger).toMatchObject({
      safetyEventId: response.body.event.id,
      meetingRequired: false,
      recommendedMeetingType: null,
      triggerReasons: [],
      reviewFlags: {
        sopReviewRequired: false,
        trainingRequired: false,
        maintenanceReviewRequired: false,
        accountableManagerReviewRequired: false,
        regulatorReportableReviewRequired: false,
      },
      assessedBy: null,
    });
  });

  it("links a triggered safety event to an air safety meeting agenda record", async () => {
    const meeting = await createAirSafetyMeeting();
    const { event, trigger } = await createTriggeredSafetyEvent();

    const response = await request(app)
      .post(`/safety-events/${event.id}/meeting-triggers/${trigger.id}/agenda-links`)
      .send({
        airSafetyMeetingId: meeting.id,
        agendaItem: " Review near miss recovery actions ",
        linkedBy: " safety coordinator ",
      });

    expect(response.status).toBe(201);
    expect(response.body.link).toMatchObject({
      safetyEventId: event.id,
      safetyEventMeetingTriggerId: trigger.id,
      airSafetyMeetingId: meeting.id,
      agendaItem: "Review near miss recovery actions",
      linkedBy: "safety coordinator",
    });
    expect(response.body.link.id).toEqual(expect.any(String));
    expect(response.body.link.linkedAt).toEqual(expect.any(String));

    const listResponse = await request(app).get(
      `/safety-events/${event.id}/agenda-links`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.links).toHaveLength(1);
    expect(listResponse.body.links[0]).toEqual(response.body.link);
  });

  it("links multiple safety event triggers to the same air safety meeting", async () => {
    const meeting = await createAirSafetyMeeting();
    const first = await createTriggeredSafetyEvent({
      eventType: "sop_breach",
      severity: "low",
      summary: "Checklist step missed",
    });
    const second = await createTriggeredSafetyEvent({
      eventType: "training_need",
      severity: "medium",
      summary: "Manual recovery refresher needed",
    });

    const firstLink = await request(app)
      .post(`/safety-events/${first.event.id}/meeting-triggers/${first.trigger.id}/agenda-links`)
      .send({
        airSafetyMeetingId: meeting.id,
        agendaItem: "Review SOP breach",
      });
    const secondLink = await request(app)
      .post(`/safety-events/${second.event.id}/meeting-triggers/${second.trigger.id}/agenda-links`)
      .send({
        airSafetyMeetingId: meeting.id,
        agendaItem: "Review training action",
      });

    expect(firstLink.status).toBe(201);
    expect(secondLink.status).toBe(201);
    expect(firstLink.body.link.airSafetyMeetingId).toBe(meeting.id);
    expect(secondLink.body.link.airSafetyMeetingId).toBe(meeting.id);
    expect(firstLink.body.link.safetyEventId).not.toBe(
      secondLink.body.link.safetyEventId,
    );
  });

  it("rejects agenda linkage for missing trigger or missing meeting", async () => {
    const meeting = await createAirSafetyMeeting();
    const { event, trigger } = await createTriggeredSafetyEvent();
    const missingTrigger = randomUUID();
    const missingMeeting = randomUUID();

    const missingTriggerResponse = await request(app)
      .post(`/safety-events/${event.id}/meeting-triggers/${missingTrigger}/agenda-links`)
      .send({
        airSafetyMeetingId: meeting.id,
        agendaItem: "Review missing trigger",
      });
    const missingMeetingResponse = await request(app)
      .post(`/safety-events/${event.id}/meeting-triggers/${trigger.id}/agenda-links`)
      .send({
        airSafetyMeetingId: missingMeeting,
        agendaItem: "Review missing meeting",
      });

    expect(missingTriggerResponse.status).toBe(404);
    expect(missingTriggerResponse.body.error).toMatchObject({
      type: "safety_event_meeting_trigger_not_found",
    });
    expect(missingMeetingResponse.status).toBe(404);
    expect(missingMeetingResponse.body.error).toMatchObject({
      type: "safety_event_reference_not_found",
    });
  });

  it("rejects duplicate agenda linkage for the same trigger and meeting", async () => {
    const meeting = await createAirSafetyMeeting();
    const { event, trigger } = await createTriggeredSafetyEvent();

    const firstResponse = await request(app)
      .post(`/safety-events/${event.id}/meeting-triggers/${trigger.id}/agenda-links`)
      .send({
        airSafetyMeetingId: meeting.id,
        agendaItem: "Initial review",
      });
    const duplicateResponse = await request(app)
      .post(`/safety-events/${event.id}/meeting-triggers/${trigger.id}/agenda-links`)
      .send({
        airSafetyMeetingId: meeting.id,
        agendaItem: "Duplicate review",
      });

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.error).toMatchObject({
      type: "safety_event_agenda_link_conflict",
    });
  });

  it("creates SOP, training, and maintenance action proposals from agenda links", async () => {
    const cases = [
      {
        eventType: "sop_breach",
        proposalType: "sop_change",
        summary: "Update launch checklist confirmation wording",
      },
      {
        eventType: "training_need",
        proposalType: "training_action",
        summary: "Schedule manual recovery refresher",
      },
      {
        eventType: "maintenance_concern",
        proposalType: "maintenance_action",
        summary: "Inspect propulsion system before next dispatch",
      },
    ];

    for (const testCase of cases) {
      const { event, trigger, meeting, agendaLink } =
        await createAgendaLinkedSafetyEvent({
          eventType: testCase.eventType,
          severity: "medium",
          summary: testCase.summary,
        });

      const response = await request(app)
        .post(`/safety-events/${event.id}/agenda-links/${agendaLink.id}/action-proposals`)
        .send({
          proposalType: testCase.proposalType,
          summary: ` ${testCase.summary} `,
          rationale: "Required by safety meeting review.",
          proposedOwner: " Safety Manager ",
          proposedDueAt: "2026-05-01T10:00:00.000Z",
          createdBy: " accountable-manager ",
        });

      expect(response.status).toBe(201);
      expect(response.body.proposal).toMatchObject({
        safetyEventAgendaLinkId: agendaLink.id,
        safetyEventId: event.id,
        safetyEventMeetingTriggerId: trigger.id,
        airSafetyMeetingId: meeting.id,
        proposalType: testCase.proposalType,
        status: "proposed",
        summary: testCase.summary,
        rationale: "Required by safety meeting review.",
        proposedOwner: "Safety Manager",
        proposedDueAt: "2026-05-01T10:00:00.000Z",
        createdBy: "accountable-manager",
      });
      expect(response.body.proposal.id).toEqual(expect.any(String));
      expect(response.body.proposal.createdAt).toEqual(expect.any(String));
    }
  });

  it("lists multiple action proposals from one agenda-linked safety event", async () => {
    const { event, agendaLink } = await createAgendaLinkedSafetyEvent({
      eventType: "sop_breach",
      severity: "high",
      summary: "Repeated dispatch briefing SOP breach",
    });

    const first = await request(app)
      .post(`/safety-events/${event.id}/agenda-links/${agendaLink.id}/action-proposals`)
      .send({
        proposalType: "sop_change",
        summary: "Clarify dispatch briefing SOP",
      });
    const second = await request(app)
      .post(`/safety-events/${event.id}/agenda-links/${agendaLink.id}/action-proposals`)
      .send({
        proposalType: "training_action",
        summary: "Brief flight team on dispatch changes",
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const listResponse = await request(app).get(
      `/safety-events/${event.id}/agenda-links/${agendaLink.id}/action-proposals`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.proposals).toHaveLength(2);
    expect(listResponse.body.proposals.map((proposal: { id: string }) => proposal.id))
      .toEqual(expect.arrayContaining([
        first.body.proposal.id,
        second.body.proposal.id,
      ]));
  });

  it("rejects invalid safety action proposal input", async () => {
    const { event, agendaLink } = await createAgendaLinkedSafetyEvent();

    const badType = await request(app)
      .post(`/safety-events/${event.id}/agenda-links/${agendaLink.id}/action-proposals`)
      .send({
        proposalType: "unsupported",
        summary: "Bad type",
      });
    const badStatus = await request(app)
      .post(`/safety-events/${event.id}/agenda-links/${agendaLink.id}/action-proposals`)
      .send({
        proposalType: "general_safety_action",
        status: "started",
        summary: "Bad status",
      });
    const badDate = await request(app)
      .post(`/safety-events/${event.id}/agenda-links/${agendaLink.id}/action-proposals`)
      .send({
        proposalType: "general_safety_action",
        summary: "Bad date",
        proposedDueAt: "not-a-date",
      });

    expect(badType.status).toBe(400);
    expect(badType.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
    expect(badStatus.status).toBe(400);
    expect(badStatus.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
    expect(badDate.status).toBe(400);
    expect(badDate.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
  });

  it("rejects safety action proposals for missing agenda links", async () => {
    const { event } = await createAgendaLinkedSafetyEvent();
    const missingAgendaLinkId = randomUUID();
    const before = await countRows({});

    const response = await request(app)
      .post(`/safety-events/${event.id}/agenda-links/${missingAgendaLinkId}/action-proposals`)
      .send({
        proposalType: "general_safety_action",
        summary: "Missing agenda link",
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      type: "safety_event_agenda_link_not_found",
    });
    expect(await countRows({})).toEqual(before);
  });

  it("accepts and rejects safety action proposals with decision records", async () => {
    const acceptedSource = await createSafetyActionProposal({
      proposalType: "sop_change",
      summary: "Update launch SOP",
    });
    const rejectedSource = await createSafetyActionProposal({
      proposalType: "training_action",
      summary: "Training action not required",
    });

    const acceptResponse = await request(app)
      .post(`/safety-events/${acceptedSource.event.id}/agenda-links/${acceptedSource.agendaLink.id}/action-proposals/${acceptedSource.proposal.id}/decisions`)
      .send({
        decision: "accepted",
        decidedBy: " accountable-manager ",
        decisionNotes: " Accepted for implementation. ",
      });
    const rejectResponse = await request(app)
      .post(`/safety-events/${rejectedSource.event.id}/agenda-links/${rejectedSource.agendaLink.id}/action-proposals/${rejectedSource.proposal.id}/decisions`)
      .send({
        decision: "rejected",
        decidedBy: "safety-manager",
        decisionNotes: "Covered by existing controls.",
      });

    expect(acceptResponse.status).toBe(201);
    expect(acceptResponse.body.decision).toMatchObject({
      safetyActionProposalId: acceptedSource.proposal.id,
      safetyEventAgendaLinkId: acceptedSource.agendaLink.id,
      safetyEventId: acceptedSource.event.id,
      safetyEventMeetingTriggerId: acceptedSource.trigger.id,
      airSafetyMeetingId: acceptedSource.meeting.id,
      decision: "accepted",
      decidedBy: "accountable-manager",
      decisionNotes: "Accepted for implementation.",
    });
    expect(acceptResponse.body.proposal).toMatchObject({
      id: acceptedSource.proposal.id,
      status: "accepted",
    });

    expect(rejectResponse.status).toBe(201);
    expect(rejectResponse.body.decision).toMatchObject({
      safetyActionProposalId: rejectedSource.proposal.id,
      decision: "rejected",
      decidedBy: "safety-manager",
      decisionNotes: "Covered by existing controls.",
    });
    expect(rejectResponse.body.proposal).toMatchObject({
      id: rejectedSource.proposal.id,
      status: "rejected",
    });
  });

  it("completes accepted safety action proposals and lists decisions", async () => {
    const source = await createSafetyActionProposal({
      proposalType: "maintenance_action",
      summary: "Inspect motor mounts",
    });

    const acceptResponse = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/decisions`)
      .send({
        decision: "accepted",
        decidedBy: "maintenance-lead",
      });
    const completeResponse = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/decisions`)
      .send({
        decision: "completed",
        decidedBy: "maintenance-lead",
        decisionNotes: "Inspection completed and recorded.",
      });

    expect(acceptResponse.status).toBe(201);
    expect(completeResponse.status).toBe(201);
    expect(completeResponse.body.proposal).toMatchObject({
      id: source.proposal.id,
      status: "completed",
    });

    const listResponse = await request(app).get(
      `/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/decisions`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.decisions).toHaveLength(2);
    expect(listResponse.body.decisions.map((decision: { decision: string }) => decision.decision))
      .toEqual(expect.arrayContaining(["accepted", "completed"]));
  });

  it("rejects invalid safety action decision input and invalid transitions", async () => {
    const source = await createSafetyActionProposal();

    const badDecision = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/decisions`)
      .send({
        decision: "paused",
      });
    const prematureComplete = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/decisions`)
      .send({
        decision: "completed",
      });

    expect(badDecision.status).toBe(400);
    expect(badDecision.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
    expect(prematureComplete.status).toBe(409);
    expect(prematureComplete.body.error).toMatchObject({
      type: "safety_action_decision_transition_invalid",
    });
  });

  it("rejects safety action decisions for missing proposals", async () => {
    const source = await createSafetyActionProposal();
    const missingProposalId = randomUUID();
    const before = await countRows({});

    const response = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${missingProposalId}/decisions`)
      .send({
        decision: "accepted",
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      type: "safety_action_proposal_not_found",
    });
    expect(await countRows({})).toEqual(before);
  });

  it("stores SOP, training, and maintenance implementation evidence for completed safety actions", async () => {
    const cases = [
      {
        proposalType: "sop_change",
        evidenceCategory: "sop_implementation",
        summary: "Launch checklist SOP updated",
      },
      {
        proposalType: "training_action",
        evidenceCategory: "training_completion",
        summary: "Manual recovery refresher completed",
      },
      {
        proposalType: "maintenance_action",
        evidenceCategory: "maintenance_completion",
        summary: "Motor mount inspection completed",
      },
    ];

    for (const testCase of cases) {
      const source = await createCompletedSafetyActionProposal({
        proposalType: testCase.proposalType,
        summary: testCase.summary,
      });

      const response = await request(app)
        .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/implementation-evidence`)
        .send({
          evidenceCategory: testCase.evidenceCategory,
          implementationSummary: ` ${testCase.summary} `,
          evidenceReference: " DOC-REF-001 ",
          completedBy: " safety-manager ",
          completedAt: "2026-05-20T09:00:00.000Z",
          reviewedBy: " accountable-manager ",
          reviewNotes: " Closure evidence reviewed. ",
        });

      expect(response.status).toBe(201);
      expect(response.body.evidence).toMatchObject({
        safetyActionProposalId: source.proposal.id,
        safetyEventAgendaLinkId: source.agendaLink.id,
        safetyEventId: source.event.id,
        safetyEventMeetingTriggerId: source.trigger.id,
        airSafetyMeetingId: source.meeting.id,
        evidenceCategory: testCase.evidenceCategory,
        implementationSummary: testCase.summary,
        evidenceReference: "DOC-REF-001",
        completedBy: "safety-manager",
        completedAt: "2026-05-20T09:00:00.000Z",
        reviewedBy: "accountable-manager",
        reviewNotes: "Closure evidence reviewed.",
      });
      expect(response.body.evidence.id).toEqual(expect.any(String));
      expect(response.body.evidence.createdAt).toEqual(expect.any(String));
    }
  });

  it("lists implementation evidence for the requested completed safety action", async () => {
    const source = await createCompletedSafetyActionProposal({
      proposalType: "general_safety_action",
      summary: "Complete safety review follow-up",
    });

    const first = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/implementation-evidence`)
      .send({
        evidenceCategory: "general_safety_action_closure",
        implementationSummary: "Initial closure evidence captured",
        completedAt: "2026-05-20T09:00:00.000Z",
      });
    const second = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/implementation-evidence`)
      .send({
        evidenceCategory: "accountable_manager_review",
        implementationSummary: "Accountable manager review completed",
        completedAt: "2026-05-21T09:00:00.000Z",
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const listResponse = await request(app).get(
      `/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/implementation-evidence`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.evidence).toHaveLength(2);
    expect(
      listResponse.body.evidence.map((evidence: { id: string }) => evidence.id),
    ).toEqual(
      expect.arrayContaining([
        first.body.evidence.id,
        second.body.evidence.id,
      ]),
    );
  });

  it("rejects implementation evidence unless the safety action proposal is completed", async () => {
    const proposedSource = await createSafetyActionProposal();
    const acceptedSource = await createSafetyActionProposal();
    const rejectedSource = await createSafetyActionProposal();

    const acceptedDecision = await request(app)
      .post(`/safety-events/${acceptedSource.event.id}/agenda-links/${acceptedSource.agendaLink.id}/action-proposals/${acceptedSource.proposal.id}/decisions`)
      .send({
        decision: "accepted",
      });
    const rejectedDecision = await request(app)
      .post(`/safety-events/${rejectedSource.event.id}/agenda-links/${rejectedSource.agendaLink.id}/action-proposals/${rejectedSource.proposal.id}/decisions`)
      .send({
        decision: "rejected",
      });

    expect(acceptedDecision.status).toBe(201);
    expect(rejectedDecision.status).toBe(201);

    for (const source of [proposedSource, acceptedSource, rejectedSource]) {
      const response = await request(app)
        .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/implementation-evidence`)
        .send({
          evidenceCategory: "general_safety_action_closure",
          implementationSummary: "Closure evidence attempted too early",
          completedAt: "2026-05-20T09:00:00.000Z",
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({
        type: "safety_action_implementation_evidence_state_invalid",
      });
    }
  });

  it("rejects invalid implementation evidence input and missing proposals", async () => {
    const source = await createCompletedSafetyActionProposal();
    const missingProposalId = randomUUID();

    const badCategory = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/implementation-evidence`)
      .send({
        evidenceCategory: "unsupported",
        implementationSummary: "Bad category",
        completedAt: "2026-05-20T09:00:00.000Z",
      });
    const badDate = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/implementation-evidence`)
      .send({
        evidenceCategory: "general_safety_action_closure",
        implementationSummary: "Bad date",
        completedAt: "not-a-date",
      });
    const missingSummary = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${source.proposal.id}/implementation-evidence`)
      .send({
        evidenceCategory: "general_safety_action_closure",
        completedAt: "2026-05-20T09:00:00.000Z",
      });
    const missingProposal = await request(app)
      .post(`/safety-events/${source.event.id}/agenda-links/${source.agendaLink.id}/action-proposals/${missingProposalId}/implementation-evidence`)
      .send({
        evidenceCategory: "general_safety_action_closure",
        implementationSummary: "Missing proposal",
        completedAt: "2026-05-20T09:00:00.000Z",
      });

    expect(badCategory.status).toBe(400);
    expect(badDate.status).toBe(400);
    expect(missingSummary.status).toBe(400);
    expect(badCategory.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
    expect(badDate.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
    expect(missingSummary.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
    expect(missingProposal.status).toBe(404);
    expect(missingProposal.body.error).toMatchObject({
      type: "safety_action_proposal_not_found",
    });
  });

  it("captures linked post-operation safety findings without mutating linked records", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    const snapshotId = await insertPostOperationSnapshot(missionId);
    const meeting = await createAirSafetyMeeting();
    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    });

    const response = await request(app).post("/safety-events").send({
      eventType: "post_operation_finding",
      severity: "medium",
      status: "under_review",
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      postOperationEvidenceSnapshotId: snapshotId,
      airSafetyMeetingId: meeting.id,
      eventOccurredAt: "2026-04-12T11:00:00.000Z",
      reportedBy: "accountable-manager",
      summary: "Post-operation review identified training follow-up",
      trainingRequired: true,
      meetingRequired: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.event).toMatchObject({
      eventType: "post_operation_finding",
      severity: "medium",
      status: "under_review",
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      postOperationEvidenceSnapshotId: snapshotId,
      airSafetyMeetingId: meeting.id,
      trainingRequired: true,
      meetingRequired: true,
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    })).toEqual({
      ...before,
      safety_event_count: before.safety_event_count + 1,
    });
  });

  it("assesses linked safety events without mutating linked records", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    const meeting = await createAirSafetyMeeting();
    const safetyEvent = await request(app).post("/safety-events").send({
      eventType: "maintenance_concern",
      severity: "critical",
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      airSafetyMeetingId: meeting.id,
      eventOccurredAt: "2026-04-13T12:00:00.000Z",
      summary: "Propeller damage found during post-flight inspection",
    });

    expect(safetyEvent.status).toBe(201);

    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    });

    const triggerResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/meeting-trigger`)
      .send({});

    expect(triggerResponse.status).toBe(201);
    expect(triggerResponse.body.trigger).toMatchObject({
      safetyEventId: safetyEvent.body.event.id,
      meetingRequired: true,
      recommendedMeetingType: "accountable_manager_review",
      triggerReasons: [
        "severity:critical",
        "event_type:maintenance_concern",
      ],
      reviewFlags: {
        maintenanceReviewRequired: true,
      },
    });
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    })).toEqual({
      ...before,
      safety_event_trigger_count: before.safety_event_trigger_count + 1,
    });
  });

  it("links agenda records without mutating safety event, trigger, meeting, or linked records", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    const meeting = await createAirSafetyMeeting();
    const safetyEvent = await request(app).post("/safety-events").send({
      eventType: "sop_breach",
      severity: "high",
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      eventOccurredAt: "2026-04-14T12:00:00.000Z",
      summary: "Dispatch briefing step missed",
    });

    expect(safetyEvent.status).toBe(201);

    const triggerResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/meeting-trigger`)
      .send({});

    expect(triggerResponse.status).toBe(201);

    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    });

    const linkResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/meeting-triggers/${triggerResponse.body.trigger.id}/agenda-links`)
      .send({
        airSafetyMeetingId: meeting.id,
        agendaItem: "Review dispatch briefing SOP breach",
      });

    expect(linkResponse.status).toBe(201);
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    })).toEqual({
      ...before,
      safety_event_agenda_link_count:
        before.safety_event_agenda_link_count + 1,
    });
  });

  it("creates action proposals without mutating source safety records", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    const meeting = await createAirSafetyMeeting();
    const safetyEvent = await request(app).post("/safety-events").send({
      eventType: "maintenance_concern",
      severity: "critical",
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      eventOccurredAt: "2026-04-15T12:00:00.000Z",
      summary: "Motor vibration exceeded limit",
    });

    expect(safetyEvent.status).toBe(201);

    const triggerResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/meeting-trigger`)
      .send({});

    expect(triggerResponse.status).toBe(201);

    const agendaLinkResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/meeting-triggers/${triggerResponse.body.trigger.id}/agenda-links`)
      .send({
        airSafetyMeetingId: meeting.id,
        agendaItem: "Review vibration exceedance",
      });

    expect(agendaLinkResponse.status).toBe(201);

    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    });

    const proposalResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals`)
      .send({
        proposalType: "maintenance_action",
        summary: "Inspect motor mounts before next flight",
      });

    expect(proposalResponse.status).toBe(201);
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    })).toEqual({
      ...before,
      safety_action_proposal_count:
        before.safety_action_proposal_count + 1,
    });
  });

  it("creates action decisions without mutating unrelated source safety records", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    const meeting = await createAirSafetyMeeting();
    const safetyEvent = await request(app).post("/safety-events").send({
      eventType: "training_need",
      severity: "medium",
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      eventOccurredAt: "2026-04-16T12:00:00.000Z",
      summary: "Crew training follow-up required",
    });

    expect(safetyEvent.status).toBe(201);

    const triggerResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/meeting-trigger`)
      .send({});
    const agendaLinkResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/meeting-triggers/${triggerResponse.body.trigger.id}/agenda-links`)
      .send({
        airSafetyMeetingId: meeting.id,
        agendaItem: "Review training follow-up",
      });
    const proposalResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals`)
      .send({
        proposalType: "training_action",
        summary: "Schedule refresher training",
      });

    expect(triggerResponse.status).toBe(201);
    expect(agendaLinkResponse.status).toBe(201);
    expect(proposalResponse.status).toBe(201);

    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    });

    const decisionResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals/${proposalResponse.body.proposal.id}/decisions`)
      .send({
        decision: "accepted",
        decidedBy: "training-manager",
      });

    expect(decisionResponse.status).toBe(201);
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    })).toEqual({
      ...before,
      safety_action_decision_count:
        before.safety_action_decision_count + 1,
    });
  });

  it("creates implementation evidence without mutating source safety records", async () => {
    const platform = await createPlatform();
    const pilot = await createPilot();
    const missionId = await insertMission({
      platformId: platform.id,
      pilotId: pilot.id,
    });
    const meeting = await createAirSafetyMeeting();
    const safetyEvent = await request(app).post("/safety-events").send({
      eventType: "sop_breach",
      severity: "high",
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      eventOccurredAt: "2026-04-17T12:00:00.000Z",
      summary: "Launch SOP breach requires closure evidence",
    });

    expect(safetyEvent.status).toBe(201);

    const triggerResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/meeting-trigger`)
      .send({});
    const agendaLinkResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/meeting-triggers/${triggerResponse.body.trigger.id}/agenda-links`)
      .send({
        airSafetyMeetingId: meeting.id,
        agendaItem: "Review launch SOP breach",
      });
    const proposalResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals`)
      .send({
        proposalType: "sop_change",
        summary: "Update launch SOP",
      });
    const acceptResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals/${proposalResponse.body.proposal.id}/decisions`)
      .send({
        decision: "accepted",
      });
    const completeResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals/${proposalResponse.body.proposal.id}/decisions`)
      .send({
        decision: "completed",
      });

    expect(triggerResponse.status).toBe(201);
    expect(agendaLinkResponse.status).toBe(201);
    expect(proposalResponse.status).toBe(201);
    expect(acceptResponse.status).toBe(201);
    expect(completeResponse.status).toBe(201);

    const before = await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    });

    const evidenceResponse = await request(app)
      .post(`/safety-events/${safetyEvent.body.event.id}/agenda-links/${agendaLinkResponse.body.link.id}/action-proposals/${proposalResponse.body.proposal.id}/implementation-evidence`)
      .send({
        evidenceCategory: "sop_implementation",
        implementationSummary: "Launch SOP update completed",
        completedAt: "2026-05-20T09:00:00.000Z",
      });

    expect(evidenceResponse.status).toBe(201);
    expect(await countRows({
      missionId,
      platformId: platform.id,
      pilotId: pilot.id,
      meetingId: meeting.id,
    })).toEqual({
      ...before,
      safety_action_implementation_evidence_count:
        before.safety_action_implementation_evidence_count + 1,
    });
  });

  it("captures maintenance concerns and regulator-reportable review flags", async () => {
    const platform = await createPlatform();

    const response = await request(app).post("/safety-events").send({
      eventType: "maintenance_concern",
      severity: "critical",
      platformId: platform.id,
      eventOccurredAt: "2026-04-12T12:00:00.000Z",
      summary: "Battery swelling found after landing",
      immediateActionTaken: "Platform grounded pending engineering review.",
      maintenanceReviewRequired: true,
      accountableManagerReviewRequired: true,
      regulatorReportableReviewRequired: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.event).toMatchObject({
      eventType: "maintenance_concern",
      severity: "critical",
      platformId: platform.id,
      maintenanceReviewRequired: true,
      accountableManagerReviewRequired: true,
      regulatorReportableReviewRequired: true,
    });
  });

  it("rejects invalid safety events", async () => {
    const missingType = await request(app).post("/safety-events").send({
      severity: "high",
      eventOccurredAt: "2026-04-10T09:30:00.000Z",
      summary: "Missing type",
    });
    const badFlag = await request(app).post("/safety-events").send({
      eventType: "training_need",
      severity: "medium",
      eventOccurredAt: "2026-04-10T09:30:00.000Z",
      summary: "Training issue",
      trainingRequired: "yes",
    });
    const badUuid = await request(app).post("/safety-events").send({
      eventType: "training_need",
      severity: "medium",
      eventOccurredAt: "2026-04-10T09:30:00.000Z",
      summary: "Training issue",
      pilotId: "not-a-uuid",
    });

    expect(missingType.status).toBe(400);
    expect(missingType.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
    expect(badFlag.status).toBe(400);
    expect(badFlag.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
    expect(badUuid.status).toBe(400);
    expect(badUuid.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
  });

  it("rejects missing optional references without side effects", async () => {
    const before = await countRows({});

    const response = await request(app).post("/safety-events").send({
      eventType: "pilot_readiness_issue",
      severity: "medium",
      eventOccurredAt: "2026-04-10T09:30:00.000Z",
      summary: "Pilot currency concern",
      pilotId: randomUUID(),
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      type: "safety_event_reference_not_found",
    });
    expect(await countRows({})).toEqual(before);
  });

  it("rejects meeting trigger assessment for invalid or missing safety events", async () => {
    const invalidId = await request(app)
      .post("/safety-events/not-a-uuid/meeting-trigger")
      .send({});
    const missingId = randomUUID();
    const before = await countRows({});
    const missingEvent = await request(app)
      .post(`/safety-events/${missingId}/meeting-trigger`)
      .send({});

    expect(invalidId.status).toBe(400);
    expect(invalidId.body.error).toMatchObject({
      type: "safety_event_validation_failed",
    });
    expect(missingEvent.status).toBe(404);
    expect(missingEvent.body.error).toMatchObject({
      type: "safety_event_not_found",
    });
    expect(await countRows({})).toEqual(before);
  });
});
