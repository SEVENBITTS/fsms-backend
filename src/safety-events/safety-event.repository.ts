import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  SafetyActionDecision,
  SafetyActionDecisionType,
  SafetyActionProposal,
  SafetyActionProposalStatus,
  SafetyActionProposalType,
  SafetyEvent,
  SafetyEventAgendaLink,
  SafetyEventMeetingTrigger,
  SafetyEventMeetingTriggerReviewFlags,
  SafetyEventMeetingType,
  SafetyEventSeverity,
  SafetyEventStatus,
  SafetyEventType,
} from "./safety-event.types";

interface SafetyEventRow extends QueryResultRow {
  id: string;
  event_type: SafetyEventType;
  severity: SafetyEventSeverity;
  status: SafetyEventStatus;
  mission_id: string | null;
  platform_id: string | null;
  pilot_id: string | null;
  post_operation_evidence_snapshot_id: string | null;
  air_safety_meeting_id: string | null;
  reported_by: string | null;
  event_occurred_at: Date;
  reported_at: Date;
  summary: string;
  description: string | null;
  immediate_action_taken: string | null;
  sop_reference: string | null;
  meeting_required: boolean;
  sop_review_required: boolean;
  training_required: boolean;
  maintenance_review_required: boolean;
  accountable_manager_review_required: boolean;
  regulator_reportable_review_required: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateSafetyEventRow {
  eventType: SafetyEventType;
  severity: SafetyEventSeverity;
  status: SafetyEventStatus;
  missionId: string | null;
  platformId: string | null;
  pilotId: string | null;
  postOperationEvidenceSnapshotId: string | null;
  airSafetyMeetingId: string | null;
  reportedBy: string | null;
  eventOccurredAt: Date;
  summary: string;
  description: string | null;
  immediateActionTaken: string | null;
  sopReference: string | null;
  meetingRequired: boolean;
  sopReviewRequired: boolean;
  trainingRequired: boolean;
  maintenanceReviewRequired: boolean;
  accountableManagerReviewRequired: boolean;
  regulatorReportableReviewRequired: boolean;
}

interface SafetyEventMeetingTriggerRow extends QueryResultRow {
  id: string;
  safety_event_id: string;
  meeting_required: boolean;
  recommended_meeting_type: SafetyEventMeetingType | null;
  trigger_reasons: string[];
  review_flags: SafetyEventMeetingTriggerReviewFlags;
  assessed_by: string | null;
  assessed_at: Date;
  created_at: Date;
}

interface CreateSafetyEventMeetingTriggerRow {
  safetyEventId: string;
  meetingRequired: boolean;
  recommendedMeetingType: SafetyEventMeetingType | null;
  triggerReasons: string[];
  reviewFlags: SafetyEventMeetingTriggerReviewFlags;
  assessedBy: string | null;
}

interface SafetyEventAgendaLinkRow extends QueryResultRow {
  id: string;
  safety_event_id: string;
  safety_event_meeting_trigger_id: string;
  air_safety_meeting_id: string;
  agenda_item: string;
  linked_by: string | null;
  linked_at: Date;
  created_at: Date;
}

interface CreateSafetyEventAgendaLinkRow {
  safetyEventId: string;
  safetyEventMeetingTriggerId: string;
  airSafetyMeetingId: string;
  agendaItem: string;
  linkedBy: string | null;
}

interface SafetyActionProposalRow extends QueryResultRow {
  id: string;
  safety_event_agenda_link_id: string;
  safety_event_id: string;
  safety_event_meeting_trigger_id: string;
  air_safety_meeting_id: string;
  proposal_type: SafetyActionProposalType;
  status: SafetyActionProposalStatus;
  summary: string;
  rationale: string | null;
  proposed_owner: string | null;
  proposed_due_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CreateSafetyActionProposalRow {
  safetyEventAgendaLinkId: string;
  safetyEventId: string;
  safetyEventMeetingTriggerId: string;
  airSafetyMeetingId: string;
  proposalType: SafetyActionProposalType;
  status: SafetyActionProposalStatus;
  summary: string;
  rationale: string | null;
  proposedOwner: string | null;
  proposedDueAt: Date | null;
  createdBy: string | null;
}

interface SafetyActionDecisionRow extends QueryResultRow {
  id: string;
  safety_action_proposal_id: string;
  safety_event_agenda_link_id: string;
  safety_event_id: string;
  safety_event_meeting_trigger_id: string;
  air_safety_meeting_id: string;
  decision: SafetyActionDecisionType;
  decided_by: string | null;
  decision_notes: string | null;
  decided_at: Date;
  created_at: Date;
}

interface CreateSafetyActionDecisionRow {
  safetyActionProposalId: string;
  safetyEventAgendaLinkId: string;
  safetyEventId: string;
  safetyEventMeetingTriggerId: string;
  airSafetyMeetingId: string;
  decision: SafetyActionDecisionType;
  decidedBy: string | null;
  decisionNotes: string | null;
}

const toSafetyEvent = (row: SafetyEventRow): SafetyEvent => ({
  id: row.id,
  eventType: row.event_type,
  severity: row.severity,
  status: row.status,
  missionId: row.mission_id,
  platformId: row.platform_id,
  pilotId: row.pilot_id,
  postOperationEvidenceSnapshotId: row.post_operation_evidence_snapshot_id,
  airSafetyMeetingId: row.air_safety_meeting_id,
  reportedBy: row.reported_by,
  eventOccurredAt: row.event_occurred_at.toISOString(),
  reportedAt: row.reported_at.toISOString(),
  summary: row.summary,
  description: row.description,
  immediateActionTaken: row.immediate_action_taken,
  sopReference: row.sop_reference,
  meetingRequired: row.meeting_required,
  sopReviewRequired: row.sop_review_required,
  trainingRequired: row.training_required,
  maintenanceReviewRequired: row.maintenance_review_required,
  accountableManagerReviewRequired: row.accountable_manager_review_required,
  regulatorReportableReviewRequired: row.regulator_reportable_review_required,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toSafetyEventMeetingTrigger = (
  row: SafetyEventMeetingTriggerRow,
): SafetyEventMeetingTrigger => ({
  id: row.id,
  safetyEventId: row.safety_event_id,
  meetingRequired: row.meeting_required,
  recommendedMeetingType: row.recommended_meeting_type,
  triggerReasons: row.trigger_reasons,
  reviewFlags: row.review_flags,
  assessedBy: row.assessed_by,
  assessedAt: row.assessed_at.toISOString(),
  createdAt: row.created_at.toISOString(),
});

const toSafetyEventAgendaLink = (
  row: SafetyEventAgendaLinkRow,
): SafetyEventAgendaLink => ({
  id: row.id,
  safetyEventId: row.safety_event_id,
  safetyEventMeetingTriggerId: row.safety_event_meeting_trigger_id,
  airSafetyMeetingId: row.air_safety_meeting_id,
  agendaItem: row.agenda_item,
  linkedBy: row.linked_by,
  linkedAt: row.linked_at.toISOString(),
  createdAt: row.created_at.toISOString(),
});

const toSafetyActionProposal = (
  row: SafetyActionProposalRow,
): SafetyActionProposal => ({
  id: row.id,
  safetyEventAgendaLinkId: row.safety_event_agenda_link_id,
  safetyEventId: row.safety_event_id,
  safetyEventMeetingTriggerId: row.safety_event_meeting_trigger_id,
  airSafetyMeetingId: row.air_safety_meeting_id,
  proposalType: row.proposal_type,
  status: row.status,
  summary: row.summary,
  rationale: row.rationale,
  proposedOwner: row.proposed_owner,
  proposedDueAt: row.proposed_due_at?.toISOString() ?? null,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toSafetyActionDecision = (
  row: SafetyActionDecisionRow,
): SafetyActionDecision => ({
  id: row.id,
  safetyActionProposalId: row.safety_action_proposal_id,
  safetyEventAgendaLinkId: row.safety_event_agenda_link_id,
  safetyEventId: row.safety_event_id,
  safetyEventMeetingTriggerId: row.safety_event_meeting_trigger_id,
  airSafetyMeetingId: row.air_safety_meeting_id,
  decision: row.decision,
  decidedBy: row.decided_by,
  decisionNotes: row.decision_notes,
  decidedAt: row.decided_at.toISOString(),
  createdAt: row.created_at.toISOString(),
});

export class SafetyEventRepository {
  async insertSafetyEvent(
    tx: PoolClient,
    input: CreateSafetyEventRow,
  ): Promise<SafetyEvent> {
    const result = await tx.query<SafetyEventRow>(
      `
      insert into safety_events (
        id,
        event_type,
        severity,
        status,
        mission_id,
        platform_id,
        pilot_id,
        post_operation_evidence_snapshot_id,
        air_safety_meeting_id,
        reported_by,
        event_occurred_at,
        summary,
        description,
        immediate_action_taken,
        sop_reference,
        meeting_required,
        sop_review_required,
        training_required,
        maintenance_review_required,
        accountable_manager_review_required,
        regulator_reportable_review_required
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      returning *
      `,
      [
        randomUUID(),
        input.eventType,
        input.severity,
        input.status,
        input.missionId,
        input.platformId,
        input.pilotId,
        input.postOperationEvidenceSnapshotId,
        input.airSafetyMeetingId,
        input.reportedBy,
        input.eventOccurredAt,
        input.summary,
        input.description,
        input.immediateActionTaken,
        input.sopReference,
        input.meetingRequired,
        input.sopReviewRequired,
        input.trainingRequired,
        input.maintenanceReviewRequired,
        input.accountableManagerReviewRequired,
        input.regulatorReportableReviewRequired,
      ],
    );

    return toSafetyEvent(result.rows[0]);
  }

  async listSafetyEvents(tx: PoolClient): Promise<SafetyEvent[]> {
    const result = await tx.query<SafetyEventRow>(
      `
      select *
      from safety_events
      order by event_occurred_at desc, reported_at desc, id desc
      `,
    );

    return result.rows.map(toSafetyEvent);
  }

  async getSafetyEventById(
    tx: PoolClient,
    eventId: string,
  ): Promise<SafetyEvent | null> {
    const result = await tx.query<SafetyEventRow>(
      `
      select *
      from safety_events
      where id = $1
      `,
      [eventId],
    );

    return result.rows[0] ? toSafetyEvent(result.rows[0]) : null;
  }

  async insertSafetyEventMeetingTrigger(
    tx: PoolClient,
    input: CreateSafetyEventMeetingTriggerRow,
  ): Promise<SafetyEventMeetingTrigger> {
    const result = await tx.query<SafetyEventMeetingTriggerRow>(
      `
      insert into safety_event_meeting_triggers (
        id,
        safety_event_id,
        meeting_required,
        recommended_meeting_type,
        trigger_reasons,
        review_flags,
        assessed_by
      )
      values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
      returning *
      `,
      [
        randomUUID(),
        input.safetyEventId,
        input.meetingRequired,
        input.recommendedMeetingType,
        JSON.stringify(input.triggerReasons),
        JSON.stringify(input.reviewFlags),
        input.assessedBy,
      ],
    );

    return toSafetyEventMeetingTrigger(result.rows[0]);
  }

  async listSafetyEventMeetingTriggers(
    tx: PoolClient,
    eventId: string,
  ): Promise<SafetyEventMeetingTrigger[]> {
    const result = await tx.query<SafetyEventMeetingTriggerRow>(
      `
      select *
      from safety_event_meeting_triggers
      where safety_event_id = $1
      order by assessed_at desc, created_at desc, id desc
      `,
      [eventId],
    );

    return result.rows.map(toSafetyEventMeetingTrigger);
  }

  async getSafetyEventMeetingTriggerById(
    tx: PoolClient,
    triggerId: string,
  ): Promise<SafetyEventMeetingTrigger | null> {
    const result = await tx.query<SafetyEventMeetingTriggerRow>(
      `
      select *
      from safety_event_meeting_triggers
      where id = $1
      `,
      [triggerId],
    );

    return result.rows[0] ? toSafetyEventMeetingTrigger(result.rows[0]) : null;
  }

  async insertSafetyEventAgendaLink(
    tx: PoolClient,
    input: CreateSafetyEventAgendaLinkRow,
  ): Promise<SafetyEventAgendaLink> {
    const result = await tx.query<SafetyEventAgendaLinkRow>(
      `
      insert into safety_event_agenda_links (
        id,
        safety_event_id,
        safety_event_meeting_trigger_id,
        air_safety_meeting_id,
        agenda_item,
        linked_by
      )
      values ($1, $2, $3, $4, $5, $6)
      returning *
      `,
      [
        randomUUID(),
        input.safetyEventId,
        input.safetyEventMeetingTriggerId,
        input.airSafetyMeetingId,
        input.agendaItem,
        input.linkedBy,
      ],
    );

    return toSafetyEventAgendaLink(result.rows[0]);
  }

  async listSafetyEventAgendaLinks(
    tx: PoolClient,
    eventId: string,
  ): Promise<SafetyEventAgendaLink[]> {
    const result = await tx.query<SafetyEventAgendaLinkRow>(
      `
      select *
      from safety_event_agenda_links
      where safety_event_id = $1
      order by linked_at desc, created_at desc, id desc
      `,
      [eventId],
    );

    return result.rows.map(toSafetyEventAgendaLink);
  }

  async getSafetyEventAgendaLinkById(
    tx: PoolClient,
    agendaLinkId: string,
  ): Promise<SafetyEventAgendaLink | null> {
    const result = await tx.query<SafetyEventAgendaLinkRow>(
      `
      select *
      from safety_event_agenda_links
      where id = $1
      `,
      [agendaLinkId],
    );

    return result.rows[0] ? toSafetyEventAgendaLink(result.rows[0]) : null;
  }

  async insertSafetyActionProposal(
    tx: PoolClient,
    input: CreateSafetyActionProposalRow,
  ): Promise<SafetyActionProposal> {
    const result = await tx.query<SafetyActionProposalRow>(
      `
      insert into safety_action_proposals (
        id,
        safety_event_agenda_link_id,
        safety_event_id,
        safety_event_meeting_trigger_id,
        air_safety_meeting_id,
        proposal_type,
        status,
        summary,
        rationale,
        proposed_owner,
        proposed_due_at,
        created_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *
      `,
      [
        randomUUID(),
        input.safetyEventAgendaLinkId,
        input.safetyEventId,
        input.safetyEventMeetingTriggerId,
        input.airSafetyMeetingId,
        input.proposalType,
        input.status,
        input.summary,
        input.rationale,
        input.proposedOwner,
        input.proposedDueAt,
        input.createdBy,
      ],
    );

    return toSafetyActionProposal(result.rows[0]);
  }

  async listSafetyActionProposalsByAgendaLink(
    tx: PoolClient,
    agendaLinkId: string,
  ): Promise<SafetyActionProposal[]> {
    const result = await tx.query<SafetyActionProposalRow>(
      `
      select *
      from safety_action_proposals
      where safety_event_agenda_link_id = $1
      order by created_at desc, id desc
      `,
      [agendaLinkId],
    );

    return result.rows.map(toSafetyActionProposal);
  }

  async getSafetyActionProposalById(
    tx: PoolClient,
    proposalId: string,
  ): Promise<SafetyActionProposal | null> {
    const result = await tx.query<SafetyActionProposalRow>(
      `
      select *
      from safety_action_proposals
      where id = $1
      `,
      [proposalId],
    );

    return result.rows[0] ? toSafetyActionProposal(result.rows[0]) : null;
  }

  async updateSafetyActionProposalStatus(
    tx: PoolClient,
    proposalId: string,
    status: SafetyActionProposalStatus,
  ): Promise<SafetyActionProposal> {
    const result = await tx.query<SafetyActionProposalRow>(
      `
      update safety_action_proposals
      set status = $2,
          updated_at = now()
      where id = $1
      returning *
      `,
      [proposalId, status],
    );

    return toSafetyActionProposal(result.rows[0]);
  }

  async insertSafetyActionDecision(
    tx: PoolClient,
    input: CreateSafetyActionDecisionRow,
  ): Promise<SafetyActionDecision> {
    const result = await tx.query<SafetyActionDecisionRow>(
      `
      insert into safety_action_decisions (
        id,
        safety_action_proposal_id,
        safety_event_agenda_link_id,
        safety_event_id,
        safety_event_meeting_trigger_id,
        air_safety_meeting_id,
        decision,
        decided_by,
        decision_notes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        randomUUID(),
        input.safetyActionProposalId,
        input.safetyEventAgendaLinkId,
        input.safetyEventId,
        input.safetyEventMeetingTriggerId,
        input.airSafetyMeetingId,
        input.decision,
        input.decidedBy,
        input.decisionNotes,
      ],
    );

    return toSafetyActionDecision(result.rows[0]);
  }

  async listSafetyActionDecisionsByProposal(
    tx: PoolClient,
    proposalId: string,
  ): Promise<SafetyActionDecision[]> {
    const result = await tx.query<SafetyActionDecisionRow>(
      `
      select *
      from safety_action_decisions
      where safety_action_proposal_id = $1
      order by decided_at desc, created_at desc, id desc
      `,
      [proposalId],
    );

    return result.rows.map(toSafetyActionDecision);
  }

  async referenceExists(
    tx: PoolClient,
    tableName:
      | "missions"
      | "platforms"
      | "pilots"
      | "post_operation_evidence_snapshots"
      | "air_safety_meetings",
    id: string,
  ): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from ${tableName}
      where id = $1
      `,
      [id],
    );

    return result.rowCount === 1;
  }
}
